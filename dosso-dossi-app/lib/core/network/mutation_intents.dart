import 'dart:convert';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'session_scope.dart';

/// Persist the same intent through an uncertain response or app restart.
/// A confirmed result ends the intent; a deliberate next action gets a new key.
class MutationIntents extends Interceptor {
  MutationIntents(
    this.store, {
    required this.session,
    Future<bool> Function(String, String)? writeIntent,
  }) : _writeIntent = writeIntent ?? store.setString;
  final SessionScope session;
  final Future<bool> Function(String, String) _writeIntent;
  final SharedPreferences store;
  static const _slot = 'mutation-intent-slot';
  static const _paths = {'/orders', '/gifts', '/me/wallet/topup'};
  final _random = Random.secure();

  String _uuid() {
    final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    final h = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
  }

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    options.extra['auth-epoch'] ??= session.revision;
    if (options.method != 'POST' ||
        !_paths.contains(options.path) ||
        options.data is! Map) {
      handler.next(options);
      return;
    }
    try {
      final body = Map<String, dynamic>.from(options.data as Map);
      if (body['idempotencyKey'] == null) {
        final raw = store.getString('auth_user');
        final account = raw == null
            ? 'anonymous'
            : (jsonDecode(raw) as Map)['phone'];
        final slot =
            'pending_intent:${base64Url.encode(utf8.encode('$account|${options.path}|${jsonEncode(body)}'))}';
        final key = store.getString(slot) ?? _uuid();
        await _writeIntent(slot, key);
        body['idempotencyKey'] = key;
        options.extra[_slot] = slot;
        options.data = body;
      }
      if (options.extra['auth-epoch'] != session.revision) {
        handler.reject(
          DioException(requestOptions: options, type: DioExceptionType.cancel),
        );
        return;
      }
      handler.next(options);
    } catch (error) {
      handler.reject(DioException(requestOptions: options, error: error));
    }
  }

  Future<void> _finish(RequestOptions options) async {
    final slot = options.extra[_slot];
    if (slot is String &&
        store.getString(slot) == (options.data as Map?)?['idempotencyKey']) {
      await store.remove(slot);
    }
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) async {
    if (response.data is! Map || response.data['status'] != 'pending') {
      await _finish(response.requestOptions);
    }
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final code = err.response?.statusCode;
    // 401 may be retried by AuthInterceptor. 408/429/5xx are ambiguous/retryable.
    if (code != null &&
        code >= 400 &&
        code < 500 &&
        !{401, 408, 429}.contains(code)) {
      await _finish(err.requestOptions);
    }
    handler.next(err);
  }
}
