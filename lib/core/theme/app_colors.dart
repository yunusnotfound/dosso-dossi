import 'package:flutter/material.dart';

/// Uygulamanın TÜM renkleri burada tanımlıdır.
/// Renk paletini değiştirmek için SADECE bu dosyayı düzenle.
abstract final class AppColors {
  // ── Marka renkleri ──────────────────────────────────────────
  /// Ana turuncu: butonlar, aktif sekme, vurgular
  static const Color primary = Color(0xFFD9682A);

  /// Turuncu gradyan açık ucu (kart arka planları vb.)
  static const Color primaryLight = Color(0xFFE68A4E);

  /// Koyu kahve: damga kartı zemini, seçili kategori çipi, ana buton
  static const Color coffeeDark = Color(0xFF2E211A);

  // ── Zeminler ────────────────────────────────────────────────
  /// Sayfa arka planı (krem)
  static const Color background = Color(0xFFF3EDE2);

  /// Kart / yüzey rengi
  static const Color surface = Color(0xFFFFFFFF);

  /// İkon rozetlerinin soluk turuncu zemini
  static const Color surfaceTint = Color(0xFFF9E9DC);

  /// Arama çubuğu gibi gömük alanların zemini
  static const Color surfaceSunken = Color(0xFFEDE5D8);

  // ── Metin ───────────────────────────────────────────────────
  static const Color textPrimary = Color(0xFF1E1611);
  static const Color textSecondary = Color(0xFF8A7F76);

  /// Koyu zemin üzeri metin
  static const Color textOnDark = Color(0xFFF7F2EA);

  /// Koyu zemin üzeri soluk metin
  static const Color textOnDarkMuted = Color(0xFFB8A99C);

  // ── Vurgu / rozetler ────────────────────────────────────────
  /// Altın sarısı: damga rozetleri, "2x Damga" etiketi zemini
  static const Color gold = Color(0xFFEAC980);

  /// Altın zemin üzeri koyu metin
  static const Color onGold = Color(0xFF6B4E12);

  /// İkram rozeti çerçevesi (koyu zeminde)
  static const Color goldOnDark = Color(0xFFD4A94E);

  // ── Durum renkleri ──────────────────────────────────────────
  /// Başarı / açık şube / onay işareti
  static const Color success = Color(0xFF3E7C4F);

  /// Başarı rozet zemini (soluk yeşil)
  static const Color successSoft = Color(0xFFDDEBDD);

  /// Hata / çıkış yap / silme
  static const Color danger = Color(0xFFC24A30);

  /// Hata rozet zemini
  static const Color dangerSoft = Color(0xFFF6E0D8);

  // ── Diğer ───────────────────────────────────────────────────
  /// Kart içi ayırıcı çizgiler
  static const Color divider = Color(0xFFEFE9DF);

  /// Pasif damga çerçevesi
  static const Color stampInactive = Color(0xFF6B5D51);

  /// Gölge rengi (düşük opaklıkla kullanılır)
  static const Color shadow = Color(0x14000000);
}
