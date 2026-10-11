import 'dart:collection';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_exception.dart';

/// Closed enums prevent user input, URLs, account IDs and server messages from
/// becoming diagnostic attributes. Never pass raw exceptions/stacks to a sink.
enum TelemetryOperation {
  framework,
  platform,
  startup,
  authenticationRefresh,
  logout,
  orderReceipt,
  giftReceipt,
  walletReceipt,
  giftHistory,
  orderHistory,
  orderTracking,
  contentSync,
  userFeedback,
}

enum TelemetryCode {
  network,
  unauthorized,
  rejected,
  cancelled,
  unconfirmedReceipt,
  unexpected,
}

@immutable
class TelemetryEvent {
  const TelemetryEvent({
    required this.operation,
    required this.code,
    required this.fatal,
  });

  final TelemetryOperation operation;
  final TelemetryCode code;
  final bool fatal;

  Map<String, Object> toJson() => {
    'operation': operation.name,
    'code': code.name,
    'fatal': fatal,
  };
}

abstract interface class TelemetrySink {
  void record(TelemetryEvent event);
}

class DeveloperTelemetrySink implements TelemetrySink {
  const DeveloperTelemetrySink();

  @override
  void record(TelemetryEvent event) => developer.log(
    jsonEncode(event.toJson()),
    name: 'dosso.diagnostics',
    level: event.fatal ? 1000 : 900,
  );
}

class AppTelemetry {
  AppTelemetry({TelemetrySink sink = const DeveloperTelemetrySink()})
    : _sink = sink;

  final TelemetrySink _sink;
  final _recent = Queue<TelemetryEvent>();
  List<TelemetryEvent> get recent => List.unmodifiable(_recent);

  void report(
    TelemetryOperation operation,
    Object error, {
    bool fatal = false,
    TelemetryCode? code,
  }) {
    final event = TelemetryEvent(
      operation: operation,
      code: code ?? _classify(error),
      fatal: fatal,
    );
    _recent.addLast(event);
    if (_recent.length > 100) _recent.removeFirst();
    try {
      _sink.record(event);
    } catch (_) {
      // Diagnostics must never interrupt payments or recurse into error hooks.
    }
  }

  static TelemetryCode _classify(Object error) {
    if (error is DioException) {
      if (error.type == DioExceptionType.cancel) return TelemetryCode.cancelled;
      final status = error.response?.statusCode;
      if (status == 401 || status == 403) return TelemetryCode.unauthorized;
      if (status != null && status >= 400 && status < 500) {
        return TelemetryCode.rejected;
      }
      return TelemetryCode.network;
    }
    if (error is ApiException) {
      if (error.isNetworkError) return TelemetryCode.network;
      if (error.statusCode == 401 || error.statusCode == 403) {
        return TelemetryCode.unauthorized;
      }
      if (error.isDefinitiveRejection) return TelemetryCode.rejected;
    }
    return TelemetryCode.unexpected;
  }
}

final appTelemetry = AppTelemetry();
final telemetryProvider = Provider<AppTelemetry>((ref) => appTelemetry);
