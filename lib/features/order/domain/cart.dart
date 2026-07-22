import 'menu.dart';
import 'product_options.dart';

/// Sepetteki tek satır: ürün + seçilen özelleştirmeler.
class CartItem {
  const CartItem({
    required this.product,
    required this.milk,
    required this.shot,
    this.quantity = 1,
  });

  final Product product;
  final ProductOption milk;
  final ProductOption shot;
  final int quantity;

  double get unitPrice => product.hasOptions
      ? product.price + milk.priceDelta + shot.priceDelta
      : product.price;

  double get total => unitPrice * quantity;

  /// Sepette gösterilen özet: "Yulaf sütü · Çift shot"
  String get optionsLabel {
    if (!product.hasOptions) return '1 adet';
    final parts = <String>[
      if (milk.name != 'Normal süt') milk.name,
      if (shot.name != 'Tek shot') shot.name,
    ];
    return parts.isEmpty ? 'Standart' : parts.join(' · ');
  }

  /// Aynı ürün + aynı seçenekler tek satırda birleşir.
  String get mergeKey => '${product.id}|${milk.name}|${shot.name}';

  CartItem copyWith({
    ProductOption? milk,
    ProductOption? shot,
    int? quantity,
  }) =>
      CartItem(
        product: product,
        milk: milk ?? this.milk,
        shot: shot ?? this.shot,
        quantity: quantity ?? this.quantity,
      );
}

/// Sepetin tamamı + kampanya kodu ve ikram kullanımı durumu.
class CartState {
  const CartState({
    this.items = const [],
    this.promoCode,
    this.discountRate = 0,
    this.useFreeDrink = false,
  });

  final List<CartItem> items;
  final String? promoCode;

  /// 0.10 = %10 indirim
  final double discountRate;

  /// İkram hakkı bu siparişte kullanılsın mı
  final bool useFreeDrink;

  int get count => items.fold(0, (sum, item) => sum + item.quantity);
  double get subtotal => items.fold(0, (sum, item) => sum + item.total);
  double get discount => subtotal * discountRate;

  /// İkrama uygun (damga kazandıran = içecek) en yüksek birim fiyatlı ürün.
  CartItem? get freeDrinkItem {
    CartItem? best;
    for (final item in items) {
      if (item.product.stampMultiplier == 0) continue;
      if (best == null || item.unitPrice > best.unitPrice) best = item;
    }
    return best;
  }

  /// İkram kullanılırsa düşülecek tutar (1 adet içecek bedava).
  double get freeDrinkDiscount =>
      useFreeDrink ? (freeDrinkItem?.unitPrice ?? 0) : 0;

  double get total {
    final t = subtotal - discount - freeDrinkDiscount;
    return t < 0 ? 0 : t;
  }

  int get stampsEarned => items.fold(
      0, (sum, item) => sum + item.product.stampMultiplier * item.quantity);

  CartState copyWith({
    List<CartItem>? items,
    String? promoCode,
    double? discountRate,
    bool? useFreeDrink,
    bool clearPromo = false,
  }) =>
      CartState(
        items: items ?? this.items,
        promoCode: clearPromo ? null : (promoCode ?? this.promoCode),
        discountRate: clearPromo ? 0 : (discountRate ?? this.discountRate),
        useFreeDrink: useFreeDrink ?? this.useFreeDrink,
      );
}
