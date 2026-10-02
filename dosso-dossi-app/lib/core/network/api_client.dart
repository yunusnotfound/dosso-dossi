import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/token_storage.dart';
import '../storage/local_storage.dart';
import 'api_endpoints.dart';
import 'mutation_intents.dart';
import 'session_scope.dart';

final onUnauthorizedProvider = Provider<void Function()?>((ref) => null);

BaseOptions _options() => BaseOptions(
  baseUrl: ApiEndpoints.baseUrl,
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 10),
  sendTimeout: const Duration(seconds: 10),
);

final apiClientProvider = Provider<Dio>((ref) {
  final dio = Dio(_options());
  final refreshDio = Dio(_options());
  dio.interceptors.add(
    MutationIntents(
      ref.watch(sharedPreferencesProvider),
      session: ref.watch(sessionScopeProvider),
    ),
  );
  dio.interceptors.add(
    AuthInterceptor(
      dio: dio,
      refreshDio: refreshDio,
      tokenStorage: ref.watch(tokenStorageProvider),
      session: ref.watch(sessionScopeProvider),
      onUnauthorized: () => ref.read(onUnauthorizedProvider)?.call(),
    ),
  );
  ref.onDispose(() {
    dio.close(force: true);
    refreshDio.close(force: true);
  });
  return dio;
});

enum _RefreshResult { renewed, rejected, unavailable, superseded }

/// A single refresh future is shared by concurrent 401s. Retry errors must
/// never queue behind the handler that is awaiting the retry itself.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required this.dio,
    required this.refreshDio,
    required this.tokenStorage,
    required this.session,
    required this.onUnauthorized,
  });
  final Dio dio;
  final Dio refreshDio;
  final TokenStorage tokenStorage;
  final SessionScope session;
  final void Function() onUnauthorized;
  Future<_RefreshResult>? _refreshing;
  static const _retriedFlag = 'auth-retried';
  static const _epoch = 'auth-epoch';

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final revision = session.revision;
    if (options.extra[_epoch] != null && options.extra[_epoch] != revision) {
      handler.reject(
        DioException(requestOptions: options, type: DioExceptionType.cancel),
      );
      return;
    }
    options.extra[_epoch] = revision;
    final token = await tokenStorage.readAccess();
    if (revision != session.revision) {
      handler.reject(
        DioException(requestOptions: options, type: DioExceptionType.cancel),
      );
      return;
    }
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    if (response.requestOptions.extra[_epoch] != session.revision) {
      handler.reject(
        DioException(
          requestOptions: response.requestOptions,
          type: DioExceptionType.cancel,
        ),
      );
    } else {
      handler.next(response);
    }
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;
    if (err.response?.statusCode != 401 ||
        options.path.startsWith('/auth/') ||
        options.extra[_retriedFlag] == true ||
        options.extra[_epoch] != session.revision) {
      handler.next(err);
      return;
    }
    final revision = session.revision;
    try {
      final currentToken = await tokenStorage.readAccess();
      final changed =
          currentToken != null &&
          options.headers['Authorization'] != 'Bearer $currentToken';
      if (!changed) {
        final pending = _refreshing ??= _tryRefresh(revision);
        final result = await pending;
        if (identical(_refreshing, pending)) _refreshing = null;
        if (result != _RefreshResult.renewed) {
          if (result == _RefreshResult.rejected &&
              revision == session.revision) {
            session.advance();
            final invalidatedEpoch = session.revision;
            await tokenStorage.clear();
            if (session.revision == invalidatedEpoch) onUnauthorized();
          }
          handler.next(err);
          return;
        }
      }
      if (revision != session.revision) {
        handler.next(err);
        return;
      }
      options.extra[_retriedFlag] = true;
      handler.resolve(await dio.fetch<dynamic>(options));
    } on DioException catch (error) {
      handler.next(error);
    } catch (_) {
      handler.next(err);
    }
  }

  Future<_RefreshResult> _tryRefresh(int revision) async {
    final refresh = await tokenStorage.readRefresh();
    if (refresh == null) return _RefreshResult.rejected;
    try {
      final response = await refreshDio.post<Map<String, dynamic>>(
        ApiEndpoints.authRefresh,
        data: {'refreshToken': refresh},
      );
      final currentRefresh = await tokenStorage.readRefresh();
      if (session.revision != revision || currentRefresh != refresh) {
        return _RefreshResult.superseded;
      }
      final data = response.data!;
      final saved = await tokenStorage.saveTokensIfCurrent(
        access: data['token'] as String,
        refresh: data['refreshToken'] as String,
        expectedRefresh: refresh,
        isCurrent: () => session.revision == revision,
      );
      return saved ? _RefreshResult.renewed : _RefreshResult.superseded;
    } on DioException catch (error) {
      return {400, 401, 403}.contains(error.response?.statusCode)
          ? _RefreshResult.rejected
          : _RefreshResult.unavailable;
    } catch (_) {
      return _RefreshResult.unavailable;
    }
  }
}
