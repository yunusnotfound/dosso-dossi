import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/app_user.dart';
import 'mock_auth_repository.dart';

/// Kimlik doğrulama veri kaynağı sözleşmesi.
/// Gerçek API hazır olduğunda ApiAuthRepository yazılır ve
/// aşağıdaki provider'da tek satır değiştirilir.
abstract interface class AuthRepository {
  /// Telefona SMS doğrulama kodu gönderir.
  Future<void> sendOtp(String phone);

  /// Kodu doğrular; başarılıysa kullanıcıyı döner.
  Future<AppUser> verifyOtp({required String phone, required String code});

  /// Yeni kullanıcının adını kaydeder.
  Future<AppUser> completeProfile({required String phone, required String name});
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return MockAuthRepository();
});
