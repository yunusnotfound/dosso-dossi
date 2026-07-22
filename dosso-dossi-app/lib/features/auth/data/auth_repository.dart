import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/network/api_client.dart';
import '../domain/app_user.dart';
import 'api_auth_repository.dart';
import 'mock_auth_repository.dart';

/// OTP doğrulama sonucu: oturum token'ı + kullanıcı.
/// Mock'ta token boş döner; API'de JWT gelir.
class AuthResult {
  const AuthResult({required this.token, required this.user});

  final String token;
  final AppUser user;
}

/// Kimlik doğrulama veri kaynağı sözleşmesi.
abstract interface class AuthRepository {
  /// Telefona SMS doğrulama kodu gönderir.
  Future<void> sendOtp(String phone);

  /// Kodu doğrular; başarılıysa token + kullanıcıyı döner.
  Future<AuthResult> verifyOtp({required String phone, required String code});

  /// Ad/e-posta günceller (isim adımı ve kişisel bilgiler ekranı).
  Future<void> updateProfile({String? name, String? email});
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AppConfig.useMocks
      ? MockAuthRepository()
      : ApiAuthRepository(ref.watch(apiClientProvider));
});
