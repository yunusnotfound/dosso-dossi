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
    Future<bool> Function(String)? removeIntent,
  }) : _writeIntent = writeIntent ?? store.setString,
       _removeIntent = removeIntent ?? store.remove;
  final SessionScope session;
  final Future<bool> Function(String, String) _writeIntent;
  final Future<bool> Function(String) _removeIntent;
  final SharedPreferences store;
  static const _slot = 'mutation-intent-slot';
  static const deferCompletion = 'defer-mutation-completion';
  static const _paths = {'/orders', '/gifts', '/me/wallet/topup'};
  static const _completedPrefix = 'completed:';
  final _random = Random.secure();
  // SharedPreferences changes its in-memory cache before the platform write
  // completes. Retain the pending key independently when that write fails.
  final _pendingKeys = <String, String>{};

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
        // Billing identity/address must never become a preferences key. A retry
        // of the same amount keeps its identity even if the form was edited.
        final identity = options.path == '/me/wallet/topup'
            ? {'amount': body['amount']}
            : body;
        final slot =
            'pending_intent:${base64Url.encode(utf8.encode('$account|${options.path}|${jsonEncode(identity)}'))}';
        final stored = store.getString(slot);
        final key =
            _pendingKeys[slot] ??
            (stored != null && !stored.startsWith(_completedPrefix)
                ? stored
                : _uuid());
        _pendingKeys[slot] = key;
        if (!await _writeIntent(slot, key)) {
          throw StateError('İşlem güvenli biçimde kaydedilemedi.');
        }
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
    final data = options.data;
    final key = data is Map ? data['idempotencyKey'] : null;
    if (slot is String &&
        key is String &&
        (_pendingKeys[slot] ?? store.getString(slot)) == key) {
      // A durable completion marker separates a confirmed action from the next
      // deliberate purchase even if best-effort deletion fails or the app exits.
      _pendingKeys[slot] = key;
      if (!await _writeIntent(slot, '$_completedPrefix$key')) {
        throw StateError('İşlem sonucu güvenli biçimde kaydedilemedi.');
      }
      if (_pendingKeys[slot] == key) _pendingKeys.remove(slot);
      try {
        if (store.getString(slot) == '$_completedPrefix$key') {
          await _removeIntent(slot);
        }
      } catch (_) {
        // The persisted marker is enough; the next action replaces it safely.
      }
    }
  }

  /// Repositories with structured receipts acknowledge after decoding them.
  Future<void> confirm(RequestOptions options) => _finish(options);

  /// Only a server-authorized receipt for this request can end its retry key.
  Future<void> confirmWalletAmount(
    double amount,
    List<String> receiptKeys,
  ) async {
    final raw = store.getString('auth_user');
    if (raw == null) return;
    final account = (jsonDecode(raw) as Map)['phone'];
    final identity = jsonEncode({'amount': amount});
    final slot =
        'pending_intent:${base64Url.encode(utf8.encode('$account|/me/wallet/topup|$identity'))}';
    final key = _pendingKeys[slot] ?? store.getString(slot);
    if (key == null ||
        key.startsWith(_completedPrefix) ||
        !receiptKeys.contains(key)) {
      return;
    }
    await _finish(
      RequestOptions(
        path: '/me/wallet/topup',
        data: {'idempotencyKey': key},
        extra: {_slot: slot},
      ),
    );
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) async {
    if (response.requestOptions.extra[deferCompletion] != true &&
        (response.data is! Map || response.data['status'] != 'pending')) {
      try {
        await _finish(response.requestOptions);
      } catch (error) {
        handler.reject(
          DioException(
            requestOptions: response.requestOptions,
            response: response,
            error: error,
          ),
        );
        return;
      }
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
      try {
        await _finish(err.requestOptions);
      } catch (_) {
        // Keep the original rejection and its retry key; always settle Dio.
      }
    }
    handler.next(err);
  }
}
