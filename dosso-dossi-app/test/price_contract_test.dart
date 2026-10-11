import 'dart:convert';
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:dosso_dossi/core/network/api_exception.dart';
import 'package:dosso_dossi/core/network/runtime_mode.dart';
import 'package:dosso_dossi/features/branches/domain/branch.dart';
import 'package:dosso_dossi/features/order/application/cart_controller.dart';
import 'package:dosso_dossi/features/order/application/menu_providers.dart';
import 'package:dosso_dossi/features/order/application/order_providers.dart';
import 'package:dosso_dossi/features/order/data/api_menu_repository.dart';
import 'package:dosso_dossi/features/order/data/api_order_repository.dart';
import 'package:dosso_dossi/features/order/data/order_repository.dart';
import 'package:dosso_dossi/features/order/domain/cart.dart';
import 'package:dosso_dossi/features/order/domain/menu.dart';
import 'package:dosso_dossi/features/order/domain/order_record.dart';
import 'package:dosso_dossi/features/order/domain/product_options.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'network_safety_test.dart' show offlineDio, jsonResponse;

const branch = Branch(
  id: 'branch-B',
  name: 'B',
  address: 'B',
  city: 'B',
  distanceMeters: 0,
  isOpen: true,
  hours: '',
);
const coffee = Product(
  id: 'coffee',
  name: 'Coffee',
  price: 190,
  categoryId: 'coffee',
  description: '',
  emoji: 'C',
  hasOptions: false,
);
const item = CartItem(
  product: coffee,
  milk: ProductOptions.defaultMilk,
  shot: ProductOptions.defaultShot,
);

class PriceChangeOrders implements OrderRepository {
  final attempts = <CartState>[];
  Completer<void>? waitBeforePriceChange;
  @override
  Future<OrderRecord> placeOrder({
    required Branch branch,
    required String pickupLabel,
    required CartState cart,
  }) async {
    attempts.add(cart);
    if (attempts.length == 1) {
      await waitBeforePriceChange?.future;
      throw const ApiException(
        code: 'PRICE_CHANGED',
        message: 'Yeni tutarı onayla',
        details: {'total': 210},
      );
    }
    return OrderRecord(
      id: 'accepted',
      createdAt: DateTime(2026),
      branchName: 'B',
      pickupLabel: 'Now',
      itemsLabel: 'Coffee',
      total: cart.total,
      stampsEarned: 1,
    );
  }

  @override
  Future<List<OrderRecord>> getOrders() async => [];
  @override
  Future<OrderRecord> getOrder(String id) => throw UnimplementedError();
}

void main() {
  test(
    'menu request uses selected branch and option catalog respects active groups',
    () async {
      final dio = offlineDio((options) {
        expect(options.queryParameters['branchId'], 'branch-B');
        return ResponseBody.fromString(
          jsonEncode([]),
          200,
          headers: {
            Headers.contentTypeHeader: ['application/json'],
          },
        );
      });

      expect(
        await ApiMenuRepository(dio, branchId: 'branch-B').getProducts(),
        isEmpty,
      );
      final options = MenuOptions.fromJson([
        {
          'group': 'milk',
          'name': 'Yulaf sütü',
          'priceDelta': 75,
          'isActive': true,
        },
        {
          'group': 'shot',
          'name': 'Çift shot',
          'priceDelta': 45,
          'isActive': true,
        },
        {
          'group': 'milk',
          'name': 'Badem sütü',
          'priceDelta': 60,
          'isActive': false,
        },
      ]);
      expect(options.milks.map((o) => o.name), ['Normal süt', 'Yulaf sütü']);
      expect(options.resolveMilk(ProductOptions.milks[1]).priceDelta, 75);
      expect(options.resolveMilk(ProductOptions.milks[2]).name, 'Normal süt');
      expect(options.shots.last.priceDelta, 45);
    },
  );
  test('order transport includes the displayed expectedTotal', () async {
    final dio = offlineDio((options) {
      expect(options.data['expectedTotal'], 190);
      expect(options.data['branchId'], 'branch-B');
      return jsonResponse(200, {
        'id': 'order',
        'createdAt': '2026-10-02T00:00:00Z',
        'total': 190,
        'stampsEarned': 1,
        'items': [],
      });
    });
    await ApiOrderRepository(dio).placeOrder(
      branch: branch,
      pickupLabel: 'Now',
      cart: const CartState(items: [item]),
    );
  });
  test(
    'price change shows new total and requires a second explicit checkout',
    () async {
      final orders = PriceChangeOrders();
      final c = ProviderContainer(
        overrides: [
          apiModeProvider.overrideWithValue(true),
          orderRepositoryProvider.overrideWithValue(orders),
          menuProductsProvider.overrideWith((ref) async => [coffee]),
          menuOptionsProvider.overrideWith((ref) async => const MenuOptions()),
        ],
      );
      addTearDown(c.dispose);
      final cart = c.read(cartProvider.notifier);
      await c.read(menuProductsProvider.future);
      await c.read(menuOptionsProvider.future);
      cart.add(item);
      await expectLater(
        cart.checkout(branch: branch, pickupLabel: 'Now'),
        throwsA(isA<ApiException>()),
      );
      expect(orders.attempts.length, 1);
      expect(c.read(cartProvider).count, 1);
      expect(c.read(cartProvider).total, 210);
      expect(c.read(cartProvider).catalogNotice, contains('ödeme alınmadı'));
      await cart.checkout(branch: branch, pickupLabel: 'Now');
      expect(orders.attempts.length, 2);
      expect(orders.attempts.last.total, 210);
      expect(c.read(cartProvider).count, 0);
    },
  );
  test(
    'price response cannot quote a different selected pickup branch',
    () async {
      final orders = PriceChangeOrders()
        ..waitBeforePriceChange = Completer<void>();
      final c = ProviderContainer(
        overrides: [
          apiModeProvider.overrideWithValue(true),
          orderRepositoryProvider.overrideWithValue(orders),
          menuProductsProvider.overrideWith((ref) async => [coffee]),
          menuOptionsProvider.overrideWith((ref) async => const MenuOptions()),
        ],
      );
      addTearDown(c.dispose);
      c.read(selectedBranchProvider.notifier).select(branch);
      final cart = c.read(cartProvider.notifier);
      await c.read(menuProductsProvider.future);
      await c.read(menuOptionsProvider.future);
      cart.add(item);
      final checkout = cart.checkout(branch: branch, pickupLabel: 'Now');
      final rejected = expectLater(checkout, throwsA(isA<ApiException>()));
      c
          .read(selectedBranchProvider.notifier)
          .select(
            const Branch(
              id: 'branch-C',
              name: 'C',
              address: 'C',
              city: 'C',
              distanceMeters: 0,
              isOpen: true,
              hours: '',
            ),
          );
      orders.waitBeforePriceChange!.complete();
      await rejected;
      expect(c.read(cartProvider).quotedTotal, isNull);
      expect(c.read(cartProvider).total, 190);
      expect(orders.attempts, hasLength(1));
    },
  );
  test('editing a cart invalidates the previous changed-price quote', () {
    const quoted = CartState(items: [item], quotedTotal: 210);
    expect(quoted.total, 210);
    expect(quoted.copyWith(items: [item.copyWith(quantity: 2)]).total, 380);
  });
}
