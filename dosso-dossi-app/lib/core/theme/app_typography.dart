import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Yazı tipi sistemi. Fontu değiştirmek için sadece [_base] fonksiyonunu düzenle.
abstract final class AppTypography {
  /// Tüm stillerin türediği temel font.
  /// Görsellerdeki yuvarlak hatlı görünüm için "Baloo 2" kullanılıyor.
  static TextStyle _base({
    double size = 15,
    FontWeight weight = FontWeight.w500,
    Color color = AppColors.textPrimary,
    double? height,
  }) =>
      GoogleFonts.baloo2(
        fontSize: size,
        fontWeight: weight,
        color: color,
        height: height,
      );

  /// Ekran başlığı: "Günaydın, Elif", "Tara & Öde"
  static TextStyle get displayLarge =>
      _base(size: 30, weight: FontWeight.w800, height: 1.1);

  /// Sayfa başlığı: "Profil", "Sepet (2)"
  static TextStyle get headline => _base(size: 24, weight: FontWeight.w800);

  /// Büyük rakamlar: bakiye, damga sayacı
  static TextStyle get numberLarge =>
      _base(size: 34, weight: FontWeight.w800, height: 1);

  /// Kart başlıkları, ürün adları
  static TextStyle get title => _base(size: 17, weight: FontWeight.w700);

  /// Liste satırı başlıkları
  static TextStyle get body => _base(size: 15, weight: FontWeight.w600);

  /// Açıklamalar, alt satırlar
  static TextStyle get bodySecondary =>
      _base(size: 14, weight: FontWeight.w500, color: AppColors.textSecondary);

  /// Bölüm etiketleri: "HESAP", "ÖDEME", "SANA ÖZEL"
  static TextStyle get sectionLabel => _base(
        size: 13,
        weight: FontWeight.w700,
        color: AppColors.textSecondary,
      ).copyWith(letterSpacing: 1.1);

  /// Küçük rozet metinleri: "2x Damga", "İkram"
  static TextStyle get badge => _base(size: 13, weight: FontWeight.w700);

  /// Buton metni
  static TextStyle get button =>
      _base(size: 17, weight: FontWeight.w700, color: Colors.white);
}
