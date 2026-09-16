import 'package:flutter/material.dart';

/// Uygulamanın TÜM renkleri burada tanımlıdır.
/// Renk paletini değiştirmek için SADECE bu dosyayı düzenle.
abstract final class AppColors {
  // ── Marka renkleri ──────────────────────────────────────────
  /// Ana turuncu: butonlar, aktif sekme, vurgular
  /// PANTONE 179 PC (CMYK 0/79/100/0) — [brandOrange] ile aynı.
  static const Color primary = Color(0xFFEF6024);

  /// Turuncu gradyan açık ucu. Markanın TEK turuncusu 179 PC olduğu için
  /// [primary] ile aynı: gradyanlar ton değil, yalnızca doku farkı yapar.
  static const Color primaryLight = Color(0xFFEF6024);

  /// Koyu kahve: damga kartı zemini, seçili kategori çipi, ana buton
  static const Color coffeeDark = Color(0xFF2E211A);

  /// Marka turuncusu — PANTONE 179 PC (CMYK 0/79/100/0).
  /// Açılış ekranının zemini.
  static const Color brandOrange = Color(0xFFEF6024);

  /// Açılış zemininin merkez tonu; markanın tek turuncusu olduğu için
  /// [brandOrange] ile aynı.
  static const Color brandOrangeLight = Color(0xFFEF6024);

  // ── Zeminler ────────────────────────────────────────────────
  /// Sayfa arka planı — PANTONE 482 PC (CMYK 5/11/15/0).
  /// Tüm sekmelerin zemini buradan gelir (scaffoldBackgroundColor + AppBar).
  static const Color background = Color(0xFFEBE1DA);

  /// Kart / yüzey rengi
  static const Color surface = Color(0xFFFFFFFF);

  /// İkon rozetlerinin soluk turuncu zemini
  static const Color surfaceTint = Color(0xFFF9E9DC);

  /// Arama çubuğu gibi gömük alanların zemini
  static const Color surfaceSunken = Color(0xFFE1D6CD);

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
