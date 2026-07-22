import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../branches/domain/branch.dart';
import '../../rewards/application/loyalty_providers.dart';
import '../../wallet/application/wallet_providers.dart';
import '../domain/cart.dart';
import '../domain/order_record.dart';
import 'order_providers.dart';

/// Geçerli kampanya kodları (mock). API'de sunucu doğrulayacak.
const _promoCodes = <String, double>{
  'DOSSO10': 0.10,
  'KAHVE20': 0.20,
};

final cartProvider =
    NotifierProvider<CartController, CartState>(CartController.new);

class CartController extends Notifier<CartState> {
  @override
  CartState build() => const CartState();

  void add(CartItem item) {
    final items = [...state.items];
    final index = items.indexWhere((i) => i.mergeKey == item.mergeKey);
    if (index >= 0) {
      items[index] =
          items[index].copyWith(quantity: items[index].quantity + item.quantity);
    } else {
      items.add(item);
    }
    state = state.copyWith(items: items);
  }

  void removeAt(int index) {
    final items = [...state.items]..removeAt(index);
    state = state.copyWith(items: items, clearPromo: items.isEmpty);
  }

  void updateAt(int index, CartItem item) {
    final items = [...state.items];
    items[index] = item;
    state = state.copyWith(items: items);
  }

  /// Kod geçerliyse uygular ve true döner.
  bool applyPromo(String code) {
    final rate = _promoCodes[code.trim().toUpperCase()];
    if (rate == null) return false;
    state = state.copyWith(promoCode: code.trim().toUpperCase(), discountRate: rate);
    return true;
  }

  void removePromo() => state = state.copyWith(clearPromo: true);

  void setUseFreeDrink(bool value) =>
      state = state.copyWith(useFreeDrink: value);

  void clear() => state = const CartState();

  /// Ödemeyi simüle eder: bakiyeden düşer, damga ekler, sipariş kaydı oluşturur.
  /// Bakiye yetersizse null döner.
  Future<OrderRecord?> checkout({
    required Branch branch,
    required String pickupLabel,
  }) async {
    final cart = state;
    if (cart.items.isEmpty) return null;

    final paid = await ref.read(walletProvider.notifier).pay(cart.total);
    if (!paid) return null;

    // İkram kullanıldıysa hakkı düş ve geçmişe işle.
    if (cart.useFreeDrink && cart.freeDrinkItem != null) {
      ref
          .read(loyaltyStatusProvider.notifier)
          .useFreeDrink(cart.freeDrinkItem!.product.name);
    }

    // Not (mock): damga, ikram edilen içecek dahil tüm içeceklerden hesaplanır;
    // gerçek API kendi kuralını uygulayacak.
    ref.read(loyaltyStatusProvider.notifier).addStamps(cart.stampsEarned);

    final orders = ref.read(ordersProvider);
    final record = OrderRecord(
      id: 'DD-${1041 + orders.length + 1}',
      createdAt: DateTime.now(),
      branchName: branch.name,
      pickupLabel: pickupLabel,
      itemsLabel: cart.items
          .map((i) => i.quantity > 1 ? '${i.quantity}x ${i.product.name}' : i.product.name)
          .join(', '),
      total: cart.total,
      stampsEarned: cart.stampsEarned,
    );
    ref.read(ordersProvider.notifier).add(record);

    state = const CartState();
    return record;
  }
}
