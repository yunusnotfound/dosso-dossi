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

  Future<String?> readAccess() => _storage.read(key: _accessKey);

  Future<String?> readRefresh() => _storage.read(key: _refreshKey);

  Future<void> saveTokens({
    required String access,
    required String refresh,
  }) async {
    await _storage.write(key: _accessKey, value: access);
    if (refresh.isNotEmpty) {
      await _storage.write(key: _refreshKey, value: refresh);
    }
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}
