/// Boşluk ve köşe yarıçapı sabitleri.
/// Tasarımın "havasını" değiştirmek için bu dosyayı düzenle.
abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;

  /// Sayfa kenar boşluğu
  static const double page = 20;
}

abstract final class AppRadius {
  /// Küçük çipler, rozetler
  static const double sm = 12;

  /// Standart kartlar
  static const double md = 16;

  /// Büyük kartlar (damga kartı, Dosso Kart)
  static const double lg = 24;

  /// Butonlar, arama çubuğu (hap şekli)
  static const double pill = 100;
}
