import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:dosso_dossi/core/diagnostics/app_telemetry.dart';
import 'package:dosso_dossi/core/diagnostics/error_handlers.dart';
import 'package:dosso_dossi/core/network/api_exception.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

class _Sink implements TelemetrySink {
  final events = <TelemetryEvent>[];
  @override
  void record(TelemetryEvent event) => events.add(event);
}

void main() {
  test(
    'telemetry never serializes raw messages, paths, tokens or account IDs',
    () {
      final sink = _Sink();
      final telemetry = AppTelemetry(sink: sink);
      telemetry.report(
        TelemetryOperation.giftReceipt,
        DioException(
          requestOptions: RequestOptions(
            path: '/gift/5551112233',
            headers: {'Authorization': 'Bearer private-secret'},
            data: {'phone': '5551112233'},
          ),
          error: 'name@example.com',
        ),
      );
      telemetry.report(
        TelemetryOperation.logout,
        const ApiException(
          code: 'name@example.com',
          message: 'private-secret 5551112233',
        ),
      );
      final encoded = jsonEncode(
        sink.events.map((event) => event.toJson()).toList(),
      );
      for (final secret in [
        '5551112233',
        'private-secret',
        'name@example.com',
        '/gift/',
      ]) {
        expect(encoded, isNot(contains(secret)));
      }
      expect(sink.events.first.code, TelemetryCode.network);
    },
  );

  test(
    'global hooks forward safe events and restore existing debug handlers',
    () {
      final oldFlutter = FlutterError.onError;
      final oldPlatform = PlatformDispatcher.instance.onError;
      var debugCalls = 0;
      FlutterError.onError = (_) => debugCalls++;
      PlatformDispatcher.instance.onError = (_, _) {
        debugCalls++;
        return false;
      };
      final sink = _Sink();
      final restore = installErrorHandlers(AppTelemetry(sink: sink));
      try {
        FlutterError.onError!(
          FlutterErrorDetails(exception: StateError('private-secret')),
        );
        PlatformDispatcher.instance.onError!(
          StateError('5551112233'),
          StackTrace.current,
        );
        expect(sink.events.map((event) => event.operation), [
          TelemetryOperation.framework,
          TelemetryOperation.platform,
        ]);
        expect(debugCalls, 2);
        expect(
          jsonEncode(sink.events.map((event) => event.toJson()).toList()),
          isNot(contains('private-secret')),
        );
      } finally {
        restore();
        FlutterError.onError = oldFlutter;
        PlatformDispatcher.instance.onError = oldPlatform;
      }
    },
  );
}
