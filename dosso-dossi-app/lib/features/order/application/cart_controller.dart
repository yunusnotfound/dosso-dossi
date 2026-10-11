import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/runtime_mode.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/session_scope.dart';
import '../../branches/domain/branch.dart';
import '../../campaigns/data/campaign_repository.dart';
import '../../rewards/application/loyalty_providers.dart';
import '../../wallet/application/wallet_providers.dart';
import '../data/order_repository.dart';
import '../domain/cart.dart';
import '../domain/order_record.dart';
import '../domain/menu.dart';
import '../domain/product_options.dart';
import 'menu_providers.dart';
import 'order_providers.dart';

final cartProvider = NotifierProvider<CartController, CartState>(
  CartController.new,
);

class CartController extends Notifier<CartState> {
  Future<OrderRecord?>? _checkoutPending;
  _CheckoutAttempt? _unconfirmedAttempt;
  _CheckoutAttempt? _activeAttempt;
  int _nextLineId = 0;

  @override
  CartState build() {
    _checkoutPending = null;
    _unconfirmedAttempt = null;
    _activeAttempt = null;
    ref.listen(selectedBranchProvider, (_, next) {
      if (state.quotedTotal != null) state = state.copyWith();
    });
    ref.listen(loyaltyStatusProvider, (_, next) {
      if (next.hasValue &&
          (next.value?.freeDrinks ?? 0) < 1 &&
          state.useFreeDrink) {
        state = state.copyWith(useFreeDrink: false);
      }
    });
    ref.listen(menuOptionsProvider, (_, next) {
      if (next.hasValue && !next.hasError) _reconcileOptions(next.requireValue);
    });
    ref.listen(menuProductsProvider, (_, next) {
      if (!next.isLoading && !next.hasError && next.hasValue) {
        _reconcileProducts(next.requireValue);
      }
    });
    return const CartState();
  }

  void _reconcileProducts(List<Product> products) {
    if (state.items.isEmpty) return;
    final current = {for (final product in products) product.id: product};
    final items = <CartItem>[];
    var changed = false;
    var removed = false;
    for (final item in state.items) {
      final product = current[item.product.id];
      if (product == null) {
        removed = true;
        continue;
      }
      changed =
          changed ||
          product.price != item.product.price ||
          product.name != item.product.name ||
          product.hasOptions != item.product.hasOptions;
      items.add(item.copyWith(product: product));
    }
    state = state.copyWith(
      items: items,
      clearPromo: items.isEmpty,
      useFreeDrink: items.isEmpty ? false : state.useFreeDrink,
      catalogNotice: removed
          ? 'Satıştan kaldırılan ürünler sepetinden çıkarıldı.'
          : changed
          ? 'Sepetindeki ürün bilgileri ve fiyatlar güncellendi.'
          : null,
    );
  }

  void _reconcileOptions(MenuOptions options) {
    var changed = false;
    final items = state.items.map((item) {
      if (!item.product.hasOptions) return item;
      final milk = options.resolveMilk(item.milk);
      final shot = options.resolveShot(item.shot);
      changed |=
          milk.name != item.milk.name ||
          milk.priceDelta != item.milk.priceDelta ||
          shot.name != item.shot.name ||
          shot.priceDelta != item.shot.priceDelta;
      return item.copyWith(milk: milk, shot: shot);
    }).toList();
    if (changed) {
      state = state.copyWith(
        items: items,
        catalogNotice:
            'Seçenekler ve fiyatlar güncellendi. Ödemeden önce kontrol et.',
      );
    }
  }

  Future<void> refreshPromo() async {
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    final code = state.promoCode;
    if (code == null) return;
    final result = await ref
        .read(campaignRepositoryProvider)
        .validateCode(code);
    if (!ref.mounted || scope.revision != epoch || state.promoCode != code) {
      return;
    }
    state = result.valid
        ? state.copyWith(discountRate: result.discountRate)
        : state.copyWith(clearPromo: true);
  }

  void add(CartItem item) {
    final items = [...state.items];
    final index = items.indexWhere((i) => i.mergeKey == item.mergeKey);
    if (index >= 0) {
      items[index] = items[index].copyWith(
        quantity: items[index].quantity + item.quantity,
      );
    } else {
      items.add(item.copyWith(localId: '${++_nextLineId}'));
    }
    state = state.copyWith(items: items);
  }

  void removeAt(int index) {
    final items = [...state.items]..removeAt(index);
    state = state.copyWith(items: items, clearPromo: items.isEmpty);
  }

  void updateAt(int index, CartItem item) {
    final items = [...state.items];
    final previous = items[index];
    if (previous.mergeKey == item.mergeKey) {
      final quantities =
          (_activeAttempt ?? _unconfirmedAttempt)?.remainingQuantities;
      final submitted = quantities?[previous.localId];
      if (submitted != null && item.quantity < submitted) {
        quantities![previous.localId] = item.quantity;
      }
      items[index] = item.copyWith(localId: previous.localId);
    } else {
      items[index] = item.copyWith(localId: '${++_nextLineId}');
    }
    state = state.copyWith(items: items);
  }

  /// Kodu doğrular (kural sunucuda / mock'ta sabit liste);
  /// geçerliyse uygular ve true döner.
  Future<bool> applyPromo(String code) async {
    final epoch = ref.read(sessionScopeProvider).revision;
    final normalized = code.trim().toUpperCase();
    final result = await ref
        .read(campaignRepositoryProvider)
        .validateCode(normalized);
    if (!ref.mounted ||
        ref.read(sessionScopeProvider).revision != epoch ||
        !result.valid) {
      return false;
    }
    state = state.copyWith(
      promoCode: normalized,
      discountRate: result.discountRate,
    );
    return true;
  }

  void removePromo() => state = state.copyWith(clearPromo: true);

  void setUseFreeDrink(bool value) =>
      state = state.copyWith(useFreeDrink: value);

  void clear() =>
      state = CartState(unconfirmedCheckout: state.unconfirmedCheckout);

  Future<OrderRecord?> retryCheckout() {
    final attempt = _unconfirmedAttempt;
    if (attempt == null) return Future.value(null);
    return checkout(branch: attempt.branch, pickupLabel: attempt.pickupLabel);
  }

  /// Siparişi tamamlar. Bakiye yetersizse null döner.
  /// Mock modunda ödeme/damga simülasyonu burada; API modunda bakiye,
  /// damga ve ikram sunucuda işlenir, ilgili provider'lar tazelenir.
  Future<OrderRecord?> checkout({
    required Branch branch,
    required String pickupLabel,
  }) {
    if (_checkoutPending != null) return _checkoutPending!;
    final future = _checkout(branch: branch, pickupLabel: pickupLabel);
    _checkoutPending = future;
    return future.whenComplete(() {
      if (identical(_checkoutPending, future)) _checkoutPending = null;
    });
  }

  Future<OrderRecord?> _checkout({
    required Branch branch,
    required String pickupLabel,
  }) async {
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    final attempt =
        _unconfirmedAttempt ??
        _CheckoutAttempt(
          cart: state.copyWith(
            items: List.unmodifiable(state.items),
            quotedTotal: state.quotedTotal,
          ),
          branch: branch,
          pickupLabel: pickupLabel,
          epoch: epoch,
          selectedBranchId: ref.read(selectedBranchProvider)?.id,
        );
    if (attempt.epoch != epoch) {
      throw const ApiException(
        code: 'SESSION_CHANGED',
        message: 'Oturum değişti. Sipariş geçmişini kontrol et.',
      );
    }
    final cart = attempt.cart;
    branch = attempt.branch;
    pickupLabel = attempt.pickupLabel;
    final selectedBranchId = attempt.selectedBranchId;
    if (cart.items.isEmpty) return null;
    // A closed branch must not prevent replay of an already submitted order.
    if (_unconfirmedAttempt == null && !branch.isOpen) {
      throw const ApiException(
        code: 'BRANCH_CLOSED',
        message: 'Bu şube şu anda kapalı.',
      );
    }

    if (!ref.read(apiModeProvider)) {
      return _checkoutMock(cart, branch: branch, pickupLabel: pickupLabel);
    }

    _activeAttempt = attempt;
    try {
      final record = await ref
          .read(orderRepositoryProvider)
          .placeOrder(branch: branch, pickupLabel: pickupLabel, cart: cart);
      if (!ref.mounted || scope.revision != epoch) {
        throw const ApiException(
          code: 'SESSION_CHANGED',
          message: 'Oturum değişti. Sipariş geçmişini kontrol et.',
        );
      }
      ref.read(ordersProvider.notifier).add(record);
      ref.invalidate(walletProvider);
      ref.invalidate(loyaltyStatusProvider);
      _unconfirmedAttempt = null;
      _removeSubmittedItems(attempt);
      return record;
    } on ApiException catch (e) {
      if (ref.mounted && scope.revision == epoch) {
        if (e.isDefinitiveRejection ||
            {'PRICE_CHANGED', 'INSUFFICIENT_BALANCE'}.contains(e.code)) {
          _unconfirmedAttempt = null;
          state = state.copyWith(
            quotedTotal: state.quotedTotal,
            clearUnconfirmedCheckout: true,
          );
        } else {
          // Keep every submitted field, including prices and the pickup time.
          // MutationIntents can therefore reuse the original idempotency key.
          _unconfirmedAttempt = attempt;
          state = state.copyWith(
            quotedTotal: state.quotedTotal,
            unconfirmedCheckout: UnconfirmedCheckout(
              branchName: branch.name,
              pickupLabel: pickupLabel,
              total: cart.total,
            ),
          );
        }
      }
      if (e.code == 'PRICE_CHANGED' && ref.mounted && scope.revision == epoch) {
        try {
          await Future.wait([
            ref.refresh(menuProductsProvider.future),
            ref.refresh(menuOptionsProvider.future),
            refreshPromo(),
          ]);
        } catch (_) {
          /* Preserve the authoritative price-change result. */
        }
        if (!ref.mounted || scope.revision != epoch) rethrow;
        final total = e.details?['total'];
        final sameItems =
            state.items.length == cart.items.length &&
            state.items.indexed.every(
              (entry) =>
                  entry.$2.mergeKey == cart.items[entry.$1].mergeKey &&
                  entry.$2.quantity == cart.items[entry.$1].quantity,
            );
        if (total is num &&
            total.isFinite &&
            total >= 0 &&
            sameItems &&
            ref.read(selectedBranchProvider)?.id == selectedBranchId &&
            state.promoCode == cart.promoCode &&
            state.useFreeDrink == cart.useFreeDrink) {
          state = state.copyWith(
            quotedTotal: total.toDouble(),
            catalogNotice:
                'Fiyat güncellendi. Yeni toplamı kontrol edip tekrar onayla; ödeme alınmadı.',
          );
        }
      }
      if (e.code == 'INSUFFICIENT_BALANCE') return null;
      rethrow;
    } finally {
      if (identical(_activeAttempt, attempt)) _activeAttempt = null;
    }
  }

  void _removeSubmittedItems(_CheckoutAttempt submitted) {
    final quantities = submitted.remainingQuantities;
    final remaining = <CartItem>[];
    for (final item in state.items) {
      final quantity = item.quantity - (quantities[item.localId] ?? 0);
      if (quantity > 0) remaining.add(item.copyWith(quantity: quantity));
    }
    state = remaining.isEmpty
        ? const CartState()
        : state.copyWith(
            items: remaining,
            clearUnconfirmedCheckout: true,
            useFreeDrink: submitted.cart.useFreeDrink
                ? false
                : state.useFreeDrink,
          );
  }

  Future<OrderRecord?> _checkoutMock(
    CartState cart, {
    required Branch branch,
    required String pickupLabel,
  }) async {
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    final paid = await ref.read(walletProvider.notifier).pay(cart.total);
    if (!ref.mounted || scope.revision != epoch) return null;
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
          .map(
            (i) => i.quantity > 1
                ? '${i.quantity}x ${i.product.name}'
                : i.product.name,
          )
          .join(', '),
      total: cart.total,
      stampsEarned: cart.stampsEarned,
    );
    ref.read(ordersProvider.notifier).add(record);

    state = const CartState();
    return record;
  }
}

class _CheckoutAttempt {
  _CheckoutAttempt({
    required this.cart,
    required this.branch,
    required this.pickupLabel,
    required this.epoch,
    required this.selectedBranchId,
  }) : remainingQuantities = {
         for (final item in cart.items) item.localId: item.quantity,
       };

  final CartState cart;
  final Branch branch;
  final String pickupLabel;
  final int epoch;
  final String? selectedBranchId;
  final Map<String?, int> remainingQuantities;
}
