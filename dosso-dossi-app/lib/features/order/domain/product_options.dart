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

/// Server-controlled paid choices plus the always available standard choices.
class MenuOptions {
  const MenuOptions({
    this.milks = ProductOptions.milks,
    this.shots = ProductOptions.shots,
  });
  final List<ProductOption> milks;
  final List<ProductOption> shots;
  factory MenuOptions.fromJson(List<dynamic> rows) {
    List<ProductOption> group(String group, ProductOption standard) => [
      standard,
      for (final row in rows)
        if (row['group'] == group &&
            row['isActive'] != false &&
            row['name'] != standard.name)
          ProductOption(
            row['name'] as String,
            (row['priceDelta'] as num).toDouble(),
          ),
    ];
    return MenuOptions(
      milks: group('milk', ProductOptions.defaultMilk),
      shots: group('shot', ProductOptions.defaultShot),
    );
  }
  ProductOption resolveMilk(ProductOption selected) =>
      milks.where((o) => o.name == selected.name).firstOrNull ??
      ProductOptions.defaultMilk;
  ProductOption resolveShot(ProductOption selected) =>
      shots.where((o) => o.name == selected.name).firstOrNull ??
      ProductOptions.defaultShot;
}
