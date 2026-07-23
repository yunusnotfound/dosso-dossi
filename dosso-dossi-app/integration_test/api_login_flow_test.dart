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
///   flutter test integration_test -d "iPhone 13" \
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

  testWidgets('Yeni hesap: OTP girişi → isim adımı → sıfır bakiye ve damga',
      (tester) async {
    expect(AppConfig.useMocks, isFalse,
        reason: 'Bu test --dart-define=USE_MOCKS=false ile çalıştırılmalı');

    // Her koşuda benzersiz, daha önce kayıt olmamış telefon.
    final epoch = DateTime.now().millisecondsSinceEpoch.toString();
    final freshPhone = '5${epoch.substring(epoch.length - 9)}';

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
    await tester.enterText(find.byType(TextField), freshPhone);
    await tester.pump();
    await tester.tap(find.text('Kod Gönder'));
    await pumpUntilFound(tester, find.text('Kodu gir'));

    // OTP doğrula → sunucu yeni kullanıcı oluşturur (adı boş)
    await tester.enterText(find.byType(TextField).first, '111111');

    // Yeni kullanıcı isim adımına düşer. Ekran geçişi sırasında OTP
    // ekranının alanı da ağaçta kalabildiğinden hint metniyle daraltılır.
    await pumpUntilFound(tester, find.text('Sana nasıl hitap edelim?'),
        timeout: const Duration(seconds: 20));
    await tester.pump(const Duration(milliseconds: 600)); // geçiş bitsin
    final nameField = find.byWidgetPredicate(
      (w) => w is TextField && w.decoration?.hintText == 'Adın Soyadın',
    );
    await tester.enterText(nameField, 'Test Kullanıcı');
    await tester.pump();
    await tester.tap(find.text('Başlayalım'));

    // Ana sayfa: yeni hesapta damga 0/5 ve bakiye 0,00 olmalı
    await pumpUntilFound(tester, find.text('Ana Sayfa'),
        timeout: const Duration(seconds: 20));
    await pumpUntilFound(tester, find.text('0/5', findRichText: true));
    await pumpUntilFound(tester, find.textContaining('0,00'));
    expect(find.text('Sipariş'), findsWidgets);
  });
}
