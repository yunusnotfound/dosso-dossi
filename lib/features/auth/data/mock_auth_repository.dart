import '../domain/app_user.dart';
import 'auth_repository.dart';

/// Simüle SMS doğrulama: gerçek SMS gönderilmez.
/// Herhangi bir 6 haneli kod kabul edilir; hata akışını denemek için
/// '000000' girildiğinde bilerek hata fırlatır.
class MockAuthRepository implements AuthRepository {
  static const _delay = Duration(milliseconds: 700);

  @override
  Future<void> sendOtp(String phone) async {
    await Future<void>.delayed(_delay);
  }

  @override
  Future<AppUser> verifyOtp({required String phone, required String code}) async {
    await Future<void>.delayed(_delay);
    if (code == '000000') {
      throw Exception('Kod hatalı. Tekrar dene.');
    }
    return AppUser(phone: phone);
  }

  @override
  Future<AppUser> completeProfile({
    required String phone,
    required String name,
  }) async {
    await Future<void>.delayed(_delay);
    return AppUser(phone: phone, name: name);
  }
}
