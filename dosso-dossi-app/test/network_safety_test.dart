import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:dosso_dossi/core/network/api_client.dart';
import 'package:dosso_dossi/core/network/mutation_intents.dart';
import 'package:dosso_dossi/core/network/session_scope.dart';
import 'package:dosso_dossi/core/storage/token_storage.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MemoryTokens extends TokenStorage {
  MemoryTokens() : super(const FlutterSecureStorage());
  String? access = 'old';
  String? refresh = 'refresh';
  int clears = 0;
  @override
  Future<String?> readAccess() async => access;
  @override
  Future<String?> readRefresh() async => refresh;
  @override
  Future<void> saveTokens({
    required String access,
    required String refresh,
  }) async {
    this.access = access;
    this.refresh = refresh;
  }

  @override
  Future<bool> saveTokensIfCurrent({
    required String access,
    required String refresh,
    required bool Function() isCurrent,
    String? expectedRefresh,
  }) async {
    if (!isCurrent() ||
        (expectedRefresh != null && this.refresh != expectedRefresh)) {
      return false;
    }
    await saveTokens(access: access, refresh: refresh);
    return isCurrent();
  }

  @override
  Future<void> clear() async {
    clears++;
    access = null;
    refresh = null;
  }
}

class OfflineAdapter implements HttpClientAdapter {
  OfflineAdapter(this.reply);
  final FutureOr<ResponseBody> Function(RequestOptions) reply;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => reply(options);
  @override
  void close({bool force = false}) {}
}

ResponseBody jsonResponse(int status, [Map<String, dynamic> body = const {}]) =>
    ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
Dio offlineDio(FutureOr<ResponseBody> Function(RequestOptions) reply) =>
    Dio(BaseOptions(baseUrl: 'http://offline.invalid'))
      ..httpClientAdapter = OfflineAdapter(reply);

class ControlledSecureStorage implements FlutterSecureStorage {
  final values = <String, String>{};
  final gate = Completer<void>();
  @override
  dynamic noSuchMethod(Invocation invocation) {
    final key = invocation.namedArguments[#key] as String;
    if (invocation.memberName == #read) {
      return Future<String?>.value(values[key]);
    }
    if (invocation.memberName == #delete) {
      values.remove(key);
      return Future<void>.value();
    }
    if (invocation.memberName == #write) {
      final value = invocation.namedArguments[#value] as String;
      if (value == 'hold') {
        return gate.future.then((_) {
          values[key] = value;
        });
      }
      values[key] = value;
      return Future<void>.value();
    }
    return super.noSuchMethod(invocation);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final retryStatus in [200, 401, 503]) {
    test(
      'auth retry $retryStatus always completes without queued deadlock',
      () async {
        final tokens = MemoryTokens();
        var requests = 0;
        final dio = offlineDio((options) {
          requests++;
          tokens.access = 'already-refreshed';
          return jsonResponse(requests == 1 ? 401 : retryStatus);
        });
        final refreshDio = offlineDio(
          (_) => throw StateError('Unexpected refresh'),
        );
        dio.interceptors.add(
          AuthInterceptor(
            dio: dio,
            refreshDio: refreshDio,
            tokenStorage: tokens,
            session: SessionScope(),
            onUnauthorized: () {},
          ),
        );
        final future = dio
            .get<dynamic>('/me/wallet')
            .timeout(const Duration(seconds: 1));
        if (retryStatus == 200) {
          expect((await future).statusCode, 200);
        } else {
          await expectLater(
            future,
            throwsA(
              isA<DioException>().having(
                (e) => e.response?.statusCode,
                'status',
                retryStatus,
              ),
            ),
          );
        }
        expect(requests, 2);
      },
    );
  }
  test(
    'parallel 401 requests share one refresh and preserve request bodies',
    () async {
      final tokens = MemoryTokens();
      var refreshCalls = 0;
      final pending = Completer<ResponseBody>();
      final dio = offlineDio(
        (o) => jsonResponse(
          o.headers['Authorization'] == 'Bearer old' ? 401 : 200,
        ),
      );
      final refresh = offlineDio((_) {
        refreshCalls++;
        return pending.future;
      });
      dio.interceptors.add(
        AuthInterceptor(
          dio: dio,
          refreshDio: refresh,
          tokenStorage: tokens,
          session: SessionScope(),
          onUnauthorized: () {},
        ),
      );
      final futures = List.generate(8, (_) => dio.get<dynamic>('/me/wallet'));
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(refreshCalls, 1);
      pending.complete(
        jsonResponse(200, {'token': 'new', 'refreshToken': 'new-refresh'}),
      );
      await Future.wait(futures).timeout(const Duration(seconds: 1));
      expect(refreshCalls, 1);
      expect(tokens.access, 'new');
    },
  );
  test(
    'transient refresh failure preserves tokens; authoritative 401 clears once',
    () async {
      for (final status in [503, 401]) {
        final tokens = MemoryTokens();
        var logouts = 0;
        final dio = offlineDio((_) => jsonResponse(401));
        final refresh = offlineDio((_) => jsonResponse(status));
        dio.interceptors.add(
          AuthInterceptor(
            dio: dio,
            refreshDio: refresh,
            tokenStorage: tokens,
            session: SessionScope(),
            onUnauthorized: () => logouts++,
          ),
        );
        await expectLater(
          dio.get<dynamic>('/me/wallet'),
          throwsA(isA<DioException>()),
        );
        expect(logouts, status == 401 ? 1 : 0);
        expect(tokens.clears, status == 401 ? 1 : 0);
      }
    },
  );
  test(
    'late refresh after account change never overwrites new session',
    () async {
      final tokens = MemoryTokens();
      final scope = SessionScope();
      final pending = Completer<ResponseBody>();
      final dio = offlineDio((_) => jsonResponse(401));
      final refresh = offlineDio((_) => pending.future);
      dio.interceptors.add(
        AuthInterceptor(
          dio: dio,
          refreshDio: refresh,
          tokenStorage: tokens,
          session: scope,
          onUnauthorized: () => fail('New account must not log out'),
        ),
      );
      final request = dio.get<dynamic>('/me/wallet');
      final checked = expectLater(request, throwsA(isA<DioException>()));
      await Future<void>.delayed(const Duration(milliseconds: 20));
      scope.advance();
      tokens.access = 'account-B';
      tokens.refresh = 'refresh-B';
      pending.complete(
        jsonResponse(200, {
          'token': 'stale-A',
          'refreshToken': 'stale-refresh-A',
        }),
      );
      await checked;
      expect(tokens.access, 'account-B');
    },
  );
  test(
    'uncertain mutation retains key through restart, success creates next intent',
    () async {
      SharedPreferences.setMockInitialValues({
        'auth_user': jsonEncode({'phone': '5551112233'}),
      });
      final prefs = await SharedPreferences.getInstance();
      final keys = <String>[];
      var status = 503;
      Dio client() => offlineDio((o) {
        keys.add((o.data as Map)['idempotencyKey'] as String);
        return jsonResponse(status);
      })..interceptors.add(MutationIntents(prefs, session: SessionScope()));
      await expectLater(
        client().post<dynamic>('/orders', data: {'expectedTotal': 190}),
        throwsA(isA<DioException>()),
      );
      status = 200;
      await client().post<dynamic>('/orders', data: {'expectedTotal': 190});
      await client().post<dynamic>('/orders', data: {'expectedTotal': 190});
      expect(keys[0], keys[1]);
      expect(keys[2], isNot(keys[1]));
      expect(
        keys.first,
        matches(
          RegExp(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
          ),
        ),
      );
    },
  );
  test(
    'account change while persisting intent rejects action before transport',
    () async {
      SharedPreferences.setMockInitialValues({
        'auth_user': jsonEncode({'phone': 'A'}),
      });
      final prefs = await SharedPreferences.getInstance();
      final scope = SessionScope();
      final gate = Completer<void>();
      final entered = Completer<void>();
      var transport = 0;
      final dio = offlineDio((_) {
        transport++;
        return jsonResponse(200);
      });
      dio.interceptors.add(
        MutationIntents(
          prefs,
          session: scope,
          writeIntent: (slot, key) async {
            await prefs.setString(slot, key);
            entered.complete();
            await gate.future;
            return true;
          },
        ),
      );
      final tokens = MemoryTokens();
      dio.interceptors.add(
        AuthInterceptor(
          dio: dio,
          refreshDio: offlineDio((_) => throw StateError('unused')),
          tokenStorage: tokens,
          session: scope,
          onUnauthorized: () {},
        ),
      );
      final check = expectLater(
        dio.post<dynamic>('/orders', data: {'expectedTotal': 190}),
        throwsA(
          isA<DioException>().having(
            (e) => e.type,
            'type',
            DioExceptionType.cancel,
          ),
        ),
      );
      await entered.future;
      scope.advance();
      tokens.access = 'account-B';
      await prefs.setString('auth_user', jsonEncode({'phone': 'B'}));
      gate.complete();
      await check;
      expect(transport, 0);
    },
  );
  test(
    'queued stale token save is discarded inside storage write queue',
    () async {
      final storage = ControlledSecureStorage();
      final tokens = TokenStorage(storage);
      final scope = SessionScope();
      final hold = tokens.saveTokens(access: 'hold', refresh: 'old-refresh');
      final stale = tokens.saveTokensIfCurrent(
        access: 'stale-A',
        refresh: 'stale-refresh-A',
        expectedRefresh: 'old-refresh',
        isCurrent: () => scope.revision == 0,
      );
      scope.advance();
      final clear = tokens.clear();
      final fresh = tokens.saveTokensIfCurrent(
        access: 'account-B',
        refresh: 'refresh-B',
        isCurrent: () => scope.revision == 1,
      );
      storage.gate.complete();
      await hold;
      expect(await stale, isFalse);
      await clear;
      expect(await fresh, isTrue);
      expect(await tokens.readAccess(), 'account-B');
      expect(await tokens.readRefresh(), 'refresh-B');
    },
  );
  test(
    'pending topup response keeps intent until a final replay result',
    () async {
      SharedPreferences.setMockInitialValues({
        'auth_user': jsonEncode({'phone': 'A'}),
      });
      final prefs = await SharedPreferences.getInstance();
      final keys = <String>[];
      var status = 'pending';
      final dio = offlineDio((o) {
        keys.add(o.data['idempotencyKey'] as String);
        return jsonResponse(200, {'status': status});
      })..interceptors.add(MutationIntents(prefs, session: SessionScope()));
      await dio.post<dynamic>('/me/wallet/topup', data: {'amount': 100});
      status = 'succeeded';
      await dio.post<dynamic>('/me/wallet/topup', data: {'amount': 100});
      await dio.post<dynamic>('/me/wallet/topup', data: {'amount': 100});
      expect(keys[0], keys[1]);
      expect(keys[2], isNot(keys[1]));
    },
  );
}
