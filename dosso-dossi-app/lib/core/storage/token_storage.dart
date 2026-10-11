import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Oturum token'ları cihazın güvenli deposunda tutulur
/// (iOS Keychain / Android Keystore) — SharedPreferences'ta değil.
/// Access token kısa ömürlüdür (~15 dk); refresh token rotasyonla yenilenir.
final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return TokenStorage(const FlutterSecureStorage());
});

class TokenStorage {
  TokenStorage(this._storage);

  static const _accessKey = 'auth_token';
  static const _refreshKey = 'refresh_token';
  final FlutterSecureStorage _storage;
  Future<void> _writes = Future.value();

  Future<void> _write(Future<void> Function() action) {
    final next = _writes.then((_) => action());
    _writes = next.catchError((_) {});
    return next;
  }

  Future<String?> readAccess() async {
    await _writes;
    return _storage.read(key: _accessKey);
  }

  Future<String?> readRefresh() async {
    await _writes;
    return _storage.read(key: _refreshKey);
  }

  Future<void> saveTokens({required String access, required String refresh}) =>
      _write(() async {
        await _storage.write(key: _accessKey, value: access);
        if (refresh.isNotEmpty) {
          await _storage.write(key: _refreshKey, value: refresh);
        }
      });

  /// The guard is checked inside the storage queue, not only by its caller.
  Future<bool> saveTokensIfCurrent({
    required String access,
    required String refresh,
    required bool Function() isCurrent,
    String? expectedRefresh,
  }) async {
    var saved = false;
    await _write(() async {
      if (!isCurrent()) return;
      if (expectedRefresh != null &&
          await _storage.read(key: _refreshKey) != expectedRefresh) {
        return;
      }
      if (!isCurrent()) return;
      await _storage.write(key: _accessKey, value: access);
      if (refresh.isNotEmpty) {
        await _storage.write(key: _refreshKey, value: refresh);
      }
      saved = isCurrent();
    });
    return saved;
  }

  Future<void> clear() => _write(() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  });
}
