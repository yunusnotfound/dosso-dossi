import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/network/api_exception.dart';
import '../../branches/domain/branch.dart';
import '../../campaigns/data/campaign_repository.dart';
import '../../rewards/application/loyalty_providers.dart';
import '../../wallet/application/wallet_providers.dart';
import '../data/order_repository.dart';
import '../domain/cart.dart';
import '../domain/order_record.dart';
import 'order_providers.dart';

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

  /// Kodu doğrular (kural sunucuda / mock'ta sabit liste);
  /// geçerliyse uygular ve true döner.
  Future<bool> applyPromo(String code) async {
    final normalized = code.trim().toUpperCase();
    final result =
        await ref.read(campaignRepositoryProvider).validateCode(normalized);
    if (!result.valid) return false;
    state = state.copyWith(
      promoCode: normalized,
      discountRate: result.discountRate,
    );
    return true;
  }

  void removePromo() => state = state.copyWith(clearPromo: true);

  void setUseFreeDrink(bool value) =>
      state = state.copyWith(useFreeDrink: value);

  void clear() => state = const CartState();

  /// Siparişi tamamlar. Bakiye yetersizse null döner.
  /// Mock modunda ödeme/damga simülasyonu burada; API modunda bakiye,
  /// damga ve ikram sunucuda işlenir, ilgili provider'lar tazelenir.
  Future<OrderRecord?> checkout({
    required Branch branch,
    required String pickupLabel,
  }) async {
    final cart = state;
    if (cart.items.isEmpty) return null;

    if (AppConfig.useMocks) {
      return _checkoutMock(cart, branch: branch, pickupLabel: pickupLabel);
    }

    try {
      final record = await ref.read(orderRepositoryProvider).placeOrder(
            branch: branch,
            pickupLabel: pickupLabel,
            cart: cart,
          );
      ref.read(ordersProvider.notifier).add(record);
      ref.invalidate(walletProvider);
      ref.invalidate(loyaltyStatusProvider);
      state = const CartState();
      return record;
    } on ApiException catch (e) {
      if (e.code == 'INSUFFICIENT_BALANCE') return null;
      rethrow;
    }
  }

  Future<OrderRecord?> _checkoutMock(
    CartState cart, {
    required Branch branch,
    required String pickupLabel,
  }) async {
    final paid = await ref.read(walletProvider.notifier).pay(cart.total);
    if (!paid) return null;

    // İkram kullanıldıysa hakkı düş ve geçmişe işle.
    if (cart.useFreeDrink && cart.freeDrinkItem != null) {
      ref
          .read(loyaltyStatusProvider.notifier)
          .useFreeDrink(cart.freeDrinkItem!.product.name);
    }

    // Not (mock): damga, ikram edilen içecek dahil tüm içeceklerden hesaplanır;
    // gerçek API aynı kuralı sunucuda uygular.
    ref.read(loyaltyStatusProvider.notifier).addStamps(cart.stampsEarned);

    final orders = ref.read(ordersProvider);
    final record = OrderRecord(
      id: 'DD-${1041 + orders.length + 1}',
      createdAt: DateTime.now(),
      branchName: branch.name,
      pickupLabel: pickupLabel,
      itemsLabel: cart.items
          .map((i) =>
              i.quantity > 1 ? '${i.quantity}x ${i.product.name}' : i.product.name)
          .join(', '),
      total: cart.total,
      stampsEarned: cart.stampsEarned,
    );
    ref.read(ordersProvider.notifier).add(record);

    state = const CartState();
    return record;
  }
}
