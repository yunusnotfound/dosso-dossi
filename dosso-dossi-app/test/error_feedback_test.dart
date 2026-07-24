import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:dosso_dossi/app.dart';
import 'package:dosso_dossi/core/network/api_exception.dart';
import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/auth/data/auth_repository.dart';

/// Ağ hatasını simüle eden sahte auth deposu.
class _FailingAuthRepository implements AuthRepository {
  @override
  Future<void> sendOtp(String phone) async {
    throw const ApiException(
      code: ApiException.networkCode,
      message: 'Bağlantı kurulamadı testi',
    );
  }

  @override
  Future<AuthResult> verifyOtp({required String phone, required String code}) =>
      throw UnimplementedError();

  @override
  Future<void> updateProfile({String? name, String? email}) =>
      throw UnimplementedError();

  @override
  Future<void> logout(String refreshToken) async {}
}

void main() {
  testWidgets('Kod gönderimi başarısız olursa kullanıcı hata mesajı görür',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          authRepositoryProvider.overrideWithValue(_FailingAuthRepository()),
        ],
        child: const DossoDossiApp(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Telefonla Devam Et'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '5551112233');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kod Gönder'));
    await tester.pumpAndSettle();

    // Sessiz başarısızlık YOK: SnackBar hata metnini gösterir,
    // kullanıcı giriş ekranında kalır
    expect(find.text('Bağlantı kurulamadı testi'), findsOneWidget);
    expect(find.text('Kod Gönder'), findsOneWidget);
  });
}
