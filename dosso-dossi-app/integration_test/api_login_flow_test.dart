import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:dosso_dossi/app.dart';
import 'package:dosso_dossi/core/constants/app_config.dart';
import 'package:dosso_dossi/core/storage/local_storage.dart';

/// Gerçek backend'e karşı uçtan uca giriş akışı. Çalıştırma:
///   docker compose up -d db && (cd dosso-dossi-backend && npm run dev)
///   flutter test integration_test -d "iPhone 17" \
///     --dart-define=USE_MOCKS=false --dart-define=API_BASE_URL=http://localhost:3000
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  /// Ekranlardaki periyodik sayaçlar (OTP geri sayımı, QR yenileme)
  /// pumpAndSettle'ı kilitleyebilir; bunun yerine sınırlı bekleme kullanılır.
  Future<void> pumpUntilFound(
    WidgetTester tester,
    Finder finder, {
    Duration timeout = const Duration(seconds: 15),
  }) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      await tester.pump(const Duration(milliseconds: 250));
      if (finder.evaluate().isNotEmpty) return;
    }
    fail('Bulunamadı: $finder');
  }

  testWidgets('API modunda OTP girişi: onboarding → kod → ana sayfa',
      (tester) async {
    expect(AppConfig.useMocks, isFalse,
        reason: 'Bu test --dart-define=USE_MOCKS=false ile çalıştırılmalı');

    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
        child: const DossoDossiApp(),
      ),
    );

    // Splash → onboarding
    await pumpUntilFound(tester, find.text('Telefonla Devam Et'));
    await tester.tap(find.text('Telefonla Devam Et'));
    await pumpUntilFound(tester, find.text('Kod Gönder'));

    // Telefon gir, kodu iste (sunucu konsola yazar; dev'de 111111 geçer)
    await tester.enterText(find.byType(TextField), '5551112233');
    await tester.pump();
    await tester.tap(find.text('Kod Gönder'));
    await pumpUntilFound(tester, find.text('Kodu gir'));

    // OTP doğrula → sunucudan token + kullanıcı gelir
    await tester.enterText(find.byType(TextField).first, '111111');

    // Ana sayfa: alt menü ve sunucudan gelen kullanıcı verisi
    await pumpUntilFound(tester, find.text('Ana Sayfa'),
        timeout: const Duration(seconds: 20));
    expect(find.text('Sipariş'), findsWidgets);
  });
}
