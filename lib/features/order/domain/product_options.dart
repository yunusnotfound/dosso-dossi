/// Ürün özelleştirme seçeneği (süt, shot).
class ProductOption {
  const ProductOption(this.name, this.priceDelta);

  final String name;

  /// Temel fiyata eklenen fark (₺)
  final double priceDelta;
}

/// Sütlü içeceklerde geçerli seçenekler.
/// Fiyat farkları resmi fiyat listesindeki "Diğer Ürünler" bölümünden:
/// ekstra yulaf/badem sütü 60 ₺, espresso shot 40 ₺.
abstract final class ProductOptions {
  static const milks = [
    ProductOption('Normal süt', 0),
    ProductOption('Yulaf sütü', 60),
    ProductOption('Badem sütü', 60),
  ];

  static const shots = [
    ProductOption('Tek shot', 0),
    ProductOption('Çift shot', 40),
  ];

  static const defaultMilk = ProductOption('Normal süt', 0);
  static const defaultShot = ProductOption('Tek shot', 0);
}
