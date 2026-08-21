import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:dosso_dossi/app.dart';
import 'package:dosso_dossi/core/storage/local_storage.dart';

/// Dar ekran (iPhone SE) taşma taraması: tüm sayfalar gezilir, Flutter'ın
/// "RenderFlex overflowed" uyarıları toplanır ve sonunda raporlanır.
/// Çalıştırma:
///   flutter test integration_test/small_screen_overflow_test.dart \
///     -d `iPhone SE simülatör id` --dart-define=USE_MOCKS=true
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Dar ekranda hiçbir sayfada taşma yok', (tester) async {
    final overflows = <String>[];
    var currentPage = 'başlangıç';
    final original = FlutterError.onError;
    FlutterError.onError = (details) {
      final text = details.exceptionAsString();
      if (text.contains('overflowed')) {
        final line = text.split('\n').first;
        final entry = '$currentPage → $line';
        if (!overflows.contains(entry)) overflows.add(entry);
        return; // taşmalar testi düşürmesin, hepsini toplayalım
      }
      original?.call(details);
    };
    addTearDown(() => FlutterError.onError = original);

    SharedPreferences.setMockInitialValues({
      'auth_user': jsonEncode({
        'phone': '5551112233',
        'name': 'Berkay Demir',
        'email': 'berkay@example.com',
      }),
    });
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
        child: const DossoDossiApp(),
      ),
    );

    /// Ekranda "..." ile kırpılan metinleri toplar. Kırpılma Flutter'da
    /// hata üretmez; taşmadan farklı olarak yalnızca render sonucundan
    /// (didExceedMaxLines) anlaşılır.
    void collectClipped() {
      for (final ro in tester.renderObjectList<RenderParagraph>(
        find.byType(RichText),
      )) {
        if (!ro.didExceedMaxLines) continue;
        final text = ro.text.toPlainText().replaceAll('\n', ' ');
        final entry = '$currentPage → KIRPILDI: "$text"';
        if (!overflows.contains(entry)) overflows.add(entry);
      }
    }

    /// Zamanlayıcılı ekranlar (QR yenileme, sayaçlar) pumpAndSettle'ı
    /// kilitleyebilir; sabit süreli pump kullanılır.
    Future<void> settle([int ms = 1200]) async {
      for (var i = 0; i < 6; i++) {
        await tester.pump(Duration(milliseconds: ms ~/ 6));
      }
      collectClipped();
    }

    // Açılış animasyonu + oturum yüklemesi
    for (var i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }

    Future<void> visit(String name, Finder tapTarget) async {
      currentPage = name;
      if (tapTarget.evaluate().isEmpty) {
        overflows.add('$name → SAYFA AÇILAMADI (hedef bulunamadı)');
        return;
      }
      await tester.tap(tapTarget.first, warnIfMissed: false);
      await settle();
      // Sayfayı sonuna kadar kaydır: alt kısımdaki taşmalar da görünsün.
      final scrollables = find.byType(Scrollable);
      if (scrollables.evaluate().isNotEmpty) {
        await tester.drag(scrollables.first, const Offset(0, -600));
        await settle(600);
        await tester.drag(scrollables.first, const Offset(0, -600));
        await settle(600);
      }
    }

    // ── Alt sekmeler ────────────────────────────────────────────
    currentPage = 'Ana Sayfa';
    await settle();
    final home = find.byType(Scrollable);
    if (home.evaluate().isNotEmpty) {
      await tester.drag(home.first, const Offset(0, -500));
      await settle(600);
    }

    await visit('Sipariş sekmesi', find.text('Sipariş'));
    await visit('Online Mağaza sekmesi', find.text('Online Mağaza'));
    await visit('Mağazalar sekmesi', find.text('Mağazalar'));
    await visit('Tara & Öde sekmesi', find.text('Tara & Öde'));

    // ── Üste açılan sayfalar ────────────────────────────────────
    await visit('Ana Sayfa (geri)', find.text('Ana Sayfa'));
    currentPage = 'Profil';
    final avatar = find.byType(CircleAvatar);
    if (avatar.evaluate().isNotEmpty) {
      await tester.tap(avatar.first, warnIfMissed: false);
      await settle();
      final scr = find.byType(Scrollable);
      if (scr.evaluate().isNotEmpty) {
        await tester.drag(scr.first, const Offset(0, -600));
        await settle(600);
      }
    }
    currentPage = 'Profil alt sayfaları';
    for (final label in ['Kişisel Bilgiler', 'Bildirimler', 'Sık Sorulanlar']) {
      final item = find.text(label);
      if (item.evaluate().isNotEmpty) {
        currentPage = 'Profil → $label';
        await tester.tap(item.first, warnIfMissed: false);
        await settle();
        final back = find.byType(BackButton);
        if (back.evaluate().isNotEmpty) {
          await tester.tap(back.first, warnIfMissed: false);
          await settle();
        }
      }
    }

    // Ürün detayı: sipariş sekmesindeki ilk ürün
    await visit('Sipariş (ürün için)', find.text('Sipariş'));
    currentPage = 'Ürün detayı';
    final product = find.text('Caffe Latte');
    if (product.evaluate().isNotEmpty) {
      await tester.tap(product.first, warnIfMissed: false);
      await settle();
      // Sepete ekleyip sepet ekranını da gör
      final add = find.textContaining('Sepete Ekle');
      if (add.evaluate().isNotEmpty) {
        await tester.tap(add.first, warnIfMissed: false);
        await settle();
      }
      final back = find.byType(BackButton);
      if (back.evaluate().isNotEmpty) {
        await tester.tap(back.first, warnIfMissed: false);
        await settle();
      }
    }

    currentPage = 'Sepet';
    final cartIcon = find.byIcon(Icons.shopping_bag_outlined);
    if (cartIcon.evaluate().isNotEmpty) {
      await tester.tap(cartIcon.first, warnIfMissed: false);
      await settle();
      final scr = find.byType(Scrollable);
      if (scr.evaluate().isNotEmpty) {
        await tester.drag(scr.first, const Offset(0, -500));
        await settle(600);
      }
    }

    FlutterError.onError = original;
    // ignore: avoid_print
    print('=== TAŞMA RAPORU (${overflows.length}) ===');
    for (final o in overflows) {
      // ignore: avoid_print
      print('  $o');
    }
    expect(overflows, isEmpty, reason: 'Dar ekranda taşan sayfalar var');
  });
}
