import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:dosso_dossi/app.dart';
import 'package:dosso_dossi/core/storage/local_storage.dart';

Future<ProviderScope> _buildApp(Map<String, Object> prefsValues) async {
  SharedPreferences.setMockInitialValues(prefsValues);
  final prefs = await SharedPreferences.getInstance();
  return ProviderScope(
    overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    child: const DossoDossiApp(),
  );
}

void main() {
  testWidgets('Giriş yapılmamışsa onboarding gösterilir', (tester) async {
    await tester.pumpWidget(await _buildApp({}));
    await tester.pumpAndSettle();

    expect(find.text('Telefonla Devam Et'), findsOneWidget);
  });

  testWidgets('Oturum varsa ana sayfa ve alt menü gösterilir', (tester) async {
    await tester.pumpWidget(await _buildApp({
      'auth_user': jsonEncode({
        'phone': '5551112233',
        'name': 'Elif Kaya',
        'email': 'elif@example.com',
      }),
    }));
    await tester.pumpAndSettle();

    expect(find.text('Ana Sayfa'), findsWidgets);
    expect(find.text('Sipariş'), findsWidgets);

    // Ana sayfa içeriği: selamlama, damga sayacı (3/5) ve bakiye
    expect(find.textContaining('Elif'), findsOneWidget);
    expect(find.text('3/5', findRichText: true), findsOneWidget);
    expect(find.textContaining('425,50'), findsOneWidget);
    await tester.dragUntilVisible(
      find.text('Beylikdüzü Vadi Loca'),
      find.byType(ListView).first,
      const Offset(0, -100),
    );
    expect(find.text('Beylikdüzü Vadi Loca'), findsOneWidget);
  });

  testWidgets('Sipariş akışı: ürün ekle, öde, damga kazan', (tester) async {
    // Gerçekçi telefon boyutu (iPhone 13 mantıksal çözünürlüğü) —
    // varsayılan 800x600 test alanında ürün kartları ekran dışında kalıyor.
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    // Test fontu (Ahem) her glifi tam kare çizdiği için gerçek cihazda
    // olmayan taşma hataları üretir; yalnızca bu testte yok sayılır.
    final originalOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      if (details.exceptionAsString().contains('overflowed')) return;
      originalOnError?.call(details);
    };
    addTearDown(() => FlutterError.onError = originalOnError);

    await tester.pumpWidget(await _buildApp({
      'auth_user': jsonEncode({'phone': '5551112233', 'name': 'Elif Kaya'}),
    }));
    await tester.pumpAndSettle();

    // Sipariş sekmesine geç, ürünü aç
    await tester.tap(find.text('Sipariş'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Caramel Macchiato'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Caramel Macchiato'));
    await tester.pumpAndSettle();

    // Varsayılan seçeneklerle sepete ekle (liste fiyatı: 250).
    // Vitrin ekranı açık kalır; menüye geri dönmek için geri tuşu.
    await tester.tap(find.textContaining('Sepete Ekle'));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 2));
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();

    // Sepeti aç ve öde ("sepete eklendi" bildirimi tamamen kapansın)
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.shopping_bag_outlined));
    await tester.pumpAndSettle();
    expect(find.text('Sepet (1)'), findsOneWidget);
    expect(find.textContaining('kazanacaksın'), findsOneWidget);
    await tester.tap(find.textContaining('Dosso Kart ile Öde'));
    await tester.pumpAndSettle();

    // Onay ekranı: sipariş no + 1 damga (kahve kategorisi)
    expect(find.text('Siparişin alındı!'), findsOneWidget);
    expect(find.text('+1'), findsOneWidget);

    // Ana sayfada bakiye düşmüş (425,50 - 250,00 = 175,50); damga 3+1=4.
    await tester.tap(find.text('Ana Sayfaya Dön'));
    await tester.pumpAndSettle();
    expect(find.textContaining('175,50'), findsOneWidget);
    expect(find.text('4/5', findRichText: true), findsOneWidget);
    expect(find.textContaining('Kullanılabilir ikramın: 1'), findsOneWidget);
  });

  testWidgets('İsmi eksik kullanıcı isim ekranına yönlenir', (tester) async {
    await tester.pumpWidget(await _buildApp({
      'auth_user': jsonEncode({'phone': '5551112233', 'name': ''}),
    }));
    await tester.pumpAndSettle();

    expect(find.text('Sana nasıl hitap edelim?'), findsOneWidget);
  });
}
