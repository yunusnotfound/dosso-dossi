import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// JWT oturum token'ı cihazın güvenli deposunda tutulur
/// (iOS Keychain / Android Keystore) — SharedPreferences'ta değil.
final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return TokenStorage(const FlutterSecureStorage());
});

class TokenStorage {
  TokenStorage(this._storage);

  static const _tokenKey = 'auth_token';
  final FlutterSecureStorage _storage;

  Future<String?> read() => _storage.read(key: _tokenKey);

  Future<void> save(String token) => _storage.write(key: _tokenKey, value: token);

  Future<void> clear() => _storage.delete(key: _tokenKey);
}
