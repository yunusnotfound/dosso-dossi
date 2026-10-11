import 'package:dio/dio.dart';
import 'package:dosso_dossi/core/diagnostics/app_telemetry.dart';
import 'package:dosso_dossi/core/network/api_exception.dart';
import 'package:dosso_dossi/core/network/financial_receipt.dart';
import 'package:dosso_dossi/core/network/mutation_intents.dart';
import 'package:dosso_dossi/core/network/session_scope.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'network_safety_test.dart' show offlineDio, jsonResponse;

Future<String> receipt(Dio dio) => postFinancialReceipt(
  dio: dio,
  path: '/orders',
  data: {'expectedTotal': 100},
  decode: (data) => data['id'] as String,
  unconfirmed: const ApiException(code: 'UNCONFIRMED', message: 'Retry'),
  operation: TelemetryOperation.orderReceipt,
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'non-financial text bodies pass through without a mutation journal',
    () async {
      SharedPreferences.setMockInitialValues({});
      final store = await SharedPreferences.getInstance();
      final dio = offlineDio((_) => jsonResponse(200));
      addTearDown(dio.close);
      dio.interceptors.add(MutationIntents(store, session: SessionScope()));
      expect(
        (await dio.post<dynamic>('/support', data: 'text')).statusCode,
        200,
      );
      expect(store.getKeys(), isEmpty);
    },
  );

  for (final throwsError in [false, true]) {
    test(
      'failed pending write blocks transport (throws=$throwsError)',
      () async {
        SharedPreferences.setMockInitialValues({});
        final store = await SharedPreferences.getInstance();
        var requests = 0;
        var failed = true;
        final dio = offlineDio((_) {
          requests++;
          return jsonResponse(503);
        });
        addTearDown(dio.close);
        dio.interceptors.add(
          MutationIntents(
            store,
            session: SessionScope(),
            writeIntent: (slot, key) async {
              // The package's memory cache may already contain the failed write.
              await store.setString(slot, key);
              if (failed && throwsError) {
                throw StateError('storage unavailable');
              }
              return !failed;
            },
          ),
        );
        await expectLater(receipt(dio), throwsA(isA<ApiException>()));
        expect(requests, 0);
        failed = false;
        await expectLater(receipt(dio), throwsA(isA<ApiException>()));
        expect(requests, 1);
      },
    );
  }

  test(
    'failed receipt persistence retries the same key despite changed cache',
    () async {
      SharedPreferences.setMockInitialValues({});
      final store = await SharedPreferences.getInstance();
      final keys = <String>[];
      var failed = true;
      final dio = offlineDio((options) {
        keys.add(options.data['idempotencyKey'] as String);
        return jsonResponse(200, {'id': 'DD-1'});
      });
      addTearDown(dio.close);
      dio.interceptors.add(
        MutationIntents(
          store,
          session: SessionScope(),
          writeIntent: (slot, key) async {
            await store.setString(slot, key);
            return !(failed && key.startsWith('completed:'));
          },
        ),
      );
      await expectLater(
        receipt(dio),
        throwsA(
          isA<ApiException>().having(
            (error) => error.code,
            'code',
            'UNCONFIRMED',
          ),
        ),
      );
      failed = false;
      expect(await receipt(dio), 'DD-1');
      expect(keys[0], keys[1]);
      expect(await receipt(dio), 'DD-1');
      expect(keys[2], isNot(keys[1]));
    },
  );

  for (final throwsError in [false, true]) {
    test(
      'completion survives deletion failure and interceptor restart ($throwsError)',
      () async {
        SharedPreferences.setMockInitialValues({});
        final store = await SharedPreferences.getInstance();
        final keys = <String>[];
        Dio client() {
          final dio = offlineDio((options) {
            keys.add(options.data['idempotencyKey'] as String);
            return jsonResponse(200, {'id': 'DD-1'});
          });
          dio.interceptors.add(
            MutationIntents(
              store,
              session: SessionScope(),
              removeIntent: (_) async {
                if (throwsError) throw StateError('remove failed');
                return false;
              },
            ),
          );
          addTearDown(dio.close);
          return dio;
        }

        expect(await receipt(client()), 'DD-1');
        final slot = store.getKeys().single;
        expect(store.getString(slot), startsWith('completed:'));
        expect(await receipt(client()), 'DD-1');
        expect(keys[0], isNot(keys[1]));
      },
    );
  }

  test(
    'failed rejection cleanup still settles the original HTTP failure',
    () async {
      SharedPreferences.setMockInitialValues({});
      final store = await SharedPreferences.getInstance();
      final dio = offlineDio(
        (_) => jsonResponse(400, {
          'error': {'code': 'INVALID', 'message': 'Invalid order'},
        }),
      );
      addTearDown(dio.close);
      dio.interceptors.add(
        MutationIntents(
          store,
          session: SessionScope(),
          writeIntent: (slot, key) async =>
              key.startsWith('completed:') ? false : store.setString(slot, key),
        ),
      );
      await expectLater(
        receipt(dio).timeout(const Duration(seconds: 2)),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'INVALID')),
      );
    },
  );
}
