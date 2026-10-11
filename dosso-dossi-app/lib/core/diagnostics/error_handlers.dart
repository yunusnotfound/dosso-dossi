import 'package:flutter/foundation.dart';

import 'app_telemetry.dart';

/// Release reports contain only the safe event schema. Debug keeps Flutter's
/// normal rendering/test diagnostics. Returns cleanup for embedding and tests.
VoidCallback installErrorHandlers(AppTelemetry telemetry) {
  final previousFlutter = FlutterError.onError;
  final previousPlatform = PlatformDispatcher.instance.onError;
  void flutterHandler(FlutterErrorDetails details) {
    telemetry.report(TelemetryOperation.framework, details.exception);
    if (kDebugMode) previousFlutter?.call(details);
  }

  bool platformHandler(Object error, StackTrace stack) {
    telemetry.report(TelemetryOperation.platform, error, fatal: true);
    if (kDebugMode && previousPlatform != null) {
      return previousPlatform(error, stack);
    }
    return true;
  }

  FlutterError.onError = flutterHandler;
  PlatformDispatcher.instance.onError = platformHandler;
  return () {
    if (FlutterError.onError == flutterHandler) {
      FlutterError.onError = previousFlutter;
    }
    if (PlatformDispatcher.instance.onError == platformHandler) {
      PlatformDispatcher.instance.onError = previousPlatform;
    }
  };
}
