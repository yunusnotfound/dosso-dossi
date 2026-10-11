import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:dosso_dossi/core/network/api_exception.dart';
import 'package:dosso_dossi/core/network/mutation_intents.dart';
import 'package:dosso_dossi/core/network/runtime_mode.dart';
import 'package:dosso_dossi/core/network/session_scope.dart';
import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/branches/application/branch_providers.dart';
import 'package:dosso_dossi/features/branches/domain/branch.dart';
import 'package:dosso_dossi/features/order/application/cart_controller.dart';
import 'package:dosso_dossi/features/order/application/menu_providers.dart';
import 'package:dosso_dossi/features/order/application/order_providers.dart';
import 'package:dosso_dossi/features/order/data/api_order_repository.dart';
import 'package:dosso_dossi/features/order/data/order_repository.dart';
import 'package:dosso_dossi/features/order/domain/cart.dart';
import 'package:dosso_dossi/features/order/domain/menu.dart';
import 'package:dosso_dossi/features/order/domain/order_record.dart';
import 'package:dosso_dossi/features/order/domain/product_options.dart';
import 'package:dosso_dossi/features/order/presentation/cart_screen.dart';
import 'package:dosso_dossi/features/order/presentation/order_success_screen.dart';
import 'package:dosso_dossi/features/rewards/application/loyalty_providers.dart';
import 'package:dosso_dossi/features/rewards/domain/loyalty_status.dart';
import 'package:dosso_dossi/features/wallet/application/wallet_providers.dart';
import 'package:dosso_dossi/features/wallet/domain/wallet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'network_safety_test.dart' show jsonResponse, offlineDio;
import 'price_contract_test.dart' show branch, coffee, item;

OrderRecord _record(String id, {int minute = 0, String status = 'received'}) =>
    OrderRecord(
      id: id,
      createdAt: DateTime(2026, 10, 7, 12, minute),
      branchName: 'Şube $id',
      pickupLabel: '12:15',
      itemsLabel: 'Kahve $id',
      total: 190,
      stampsEarned: 1,
      status: status,
    );

Map<String, dynamic> _receiptJson(String id) => {
  'id': id,
  'createdAt': '2026-10-07T12:00:00Z',
  'total': 190,
  'stampsEarned': 1,
  'items': [],
};

class _Orders implements OrderRepository {
  int attempts = 0;
  bool failFirst = true;
  Future<List<OrderRecord>> Function() load = () async => [];
  Future<OrderRecord> Function(String)? loadOne;

  @override
  Future<List<OrderRecord>> getOrders() => load();

  @override
  Future<OrderRecord> getOrder(String id) => loadOne!(id);

  @override
  Future<OrderRecord> placeOrder({
    required Branch branch,
    required String pickupLabel,
    required CartState cart,
  }) async {
    if (++attempts == 1 && failFirst) {
      throw const ApiException(
        code: ApiException.networkCode,
        message: 'Yanıt alınamadı',
      );
    }
    return _record('confirmed');
  }
}

class _Wallet extends WalletController {
  @override
  Future<Wallet> build() async =>
      const Wallet(balance: 2000, cardLast4: '7412');
}

class _Loyalty extends LoyaltyController {
  @override
  Future<LoyaltyStatus> build() async => const LoyaltyStatus(stamps: 0);
}

Future<ProviderContainer> _container(
  OrderRepository orders, {
  bool api = true,
  List<Product> Function()? products,
}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final container = ProviderContainer(
    retry: (_, _) => null,
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      apiModeProvider.overrideWithValue(api),
      orderRepositoryProvider.overrideWithValue(orders),
      menuProductsProvider.overrideWith(
        (ref) async => products?.call() ?? [coffee],
      ),
      menuOptionsProvider.overrideWith((ref) async => const MenuOptions()),
      branchesProvider.overrideWith(
        (ref) async => [
          Branch(
            id: branch.id,
            name: branch.name,
            address: branch.address,
            city: branch.city,
            isOpen: branch.isOpen,
            hours: '24 saat açık',
            prepMinutes: branch.prepMinutes,
          ),
        ],
      ),
      walletProvider.overrideWith(_Wallet.new),
      loyaltyStatusProvider.overrideWith(_Loyalty.new),
    ],
  );
  addTearDown(container.dispose);
  container.read(cartProvider);
  await container.read(menuProductsProvider.future);
  await container.read(menuOptionsProvider.future);
  await container.read(branchesProvider.future);
  await container.read(loyaltyStatusProvider.future);
  return container;
}

Future<void> _uncertain(CartController cart) => expectLater(
  cart.checkout(branch: branch, pickupLabel: '12:15'),
  throwsA(isA<ApiException>()),
);

void main() {
  test(
    'ambiguous retry keeps body and key despite time, catalog and cart changes',
    () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final bodies = <Map<String, dynamic>>[];
      final dio = offlineDio((options) {
        if (options.method == 'GET') {
          return ResponseBody.fromString(
            '[]',
            200,
            headers: {
              Headers.contentTypeHeader: ['application/json'],
            },
          );
        }
        bodies.add(
          jsonDecode(jsonEncode(options.data)) as Map<String, dynamic>,
        );
        return bodies.length == 1
            ? jsonResponse(503)
            : jsonResponse(200, _receiptJson('confirmed'));
      })..interceptors.add(MutationIntents(prefs, session: SessionScope()));
      var products = [coffee];
      final container = await _container(
        ApiOrderRepository(dio),
        products: () => products,
      );
      final cart = container.read(cartProvider.notifier)..add(item);
      await _uncertain(cart);
      expect(
        container.read(cartProvider).unconfirmedCheckout?.pickupLabel,
        '12:15',
      );

      products = [
        const Product(
          id: 'coffee',
          name: 'Coffee',
          price: 210,
          categoryId: 'coffee',
          description: '',
          emoji: 'C',
          hasOptions: false,
        ),
      ];
      container.invalidate(menuProductsProvider);
      await container.read(menuProductsProvider.future);
      await container.pump();
      cart.add(item.copyWith(product: products.single));
      const otherBranch = Branch(
        id: 'other',
        name: 'Other',
        address: '',
        city: '',
        isOpen: true,
        hours: '',
      );
      await cart.checkout(branch: otherBranch, pickupLabel: '12:30');
      expect(bodies[1], bodies[0]);
      expect(bodies[1]['pickupSlot'], '12:15');
      expect(bodies[1]['expectedTotal'], 190);
      expect(container.read(cartProvider).count, 1);
      expect(container.read(cartProvider).total, 210);
      expect(container.read(cartProvider).unconfirmedCheckout, isNull);

      await cart.checkout(branch: otherBranch, pickupLabel: '12:30');
      expect(bodies[2]['idempotencyKey'], isNot(bodies[1]['idempotencyKey']));
      expect(bodies[2]['branchId'], 'other');
      expect(bodies[2]['pickupSlot'], '12:30');
      expect(bodies[2]['expectedTotal'], 210);
    },
  );

  for (final clearAll in [true, false]) {
    test(
      'retry preserves same product added after ${clearAll ? 'clear' : 'remove'}',
      () async {
        final container = await _container(_Orders());
        final cart = container.read(cartProvider.notifier)..add(item);
        await _uncertain(cart);
        if (clearAll) {
          cart.clear();
        } else {
          cart.removeAt(0);
        }
        cart.add(item);
        await cart.retryCheckout();
        expect(container.read(cartProvider).count, 1);
        expect(container.read(cartProvider).unconfirmedCheckout, isNull);
      },
    );
  }

  test(
    'reducing a submitted quantity then adding preserves the new unit',
    () async {
      final container = await _container(_Orders());
      final cart = container.read(cartProvider.notifier)
        ..add(item.copyWith(quantity: 2));
      await _uncertain(cart);
      cart.updateAt(
        0,
        container.read(cartProvider).items.single.copyWith(quantity: 1),
      );
      cart.add(item);
      await cart.retryCheckout();
      expect(container.read(cartProvider).count, 1);
    },
  );

  test(
    'malformed successful receipt retains key until decoded confirmation',
    () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final keys = <String>[];
      final dio = offlineDio((options) {
        if (options.method == 'GET') {
          return ResponseBody.fromString(
            '[]',
            200,
            headers: {
              Headers.contentTypeHeader: ['application/json'],
            },
          );
        }
        keys.add(options.data['idempotencyKey'] as String);
        return jsonResponse(
          200,
          keys.length == 1 ? {'id': 'bad'} : _receiptJson('ok'),
        );
      })..interceptors.add(MutationIntents(prefs, session: SessionScope()));
      final container = await _container(ApiOrderRepository(dio));
      final cart = container.read(cartProvider.notifier)..add(item);
      await _uncertain(cart);
      expect(container.read(cartProvider).unconfirmedCheckout, isNotNull);
      await cart.retryCheckout();
      expect(keys[1], keys[0]);
      cart.add(item);
      await cart.checkout(branch: branch, pickupLabel: '12:15');
      expect(keys[2], isNot(keys[1]));
    },
  );

  test(
    'late history cannot drop a locally confirmed order and deduplicates replay',
    () async {
      final orders = _Orders();
      final container = await _container(orders, api: false);
      final controller = container.read(ordersProvider.notifier);
      final old = _record('old');
      final recent = _record('recent', minute: 1);
      controller.add(old);
      final response = Completer<List<OrderRecord>>();
      orders.load = () => response.future;
      final refresh = controller.refresh();
      controller.add(recent);
      controller.add(recent);
      response.complete([old]);
      await refresh;
      expect(container.read(ordersProvider).map((order) => order.id), [
        'recent',
        'old',
      ]);
      orders.load = () async => [recent.copyWith(status: 'ready'), old];
      await controller.refresh();
      expect(container.read(ordersProvider), hasLength(2));
      expect(container.read(ordersProvider).first.status, 'ready');
    },
  );

  test(
    'latest refresh wins and a stale failure cannot replace its load state',
    () async {
      final orders = _Orders();
      final container = await _container(orders, api: false);
      final controller = container.read(ordersProvider.notifier);
      final first = Completer<List<OrderRecord>>();
      final second = Completer<List<OrderRecord>>();
      orders.load = () => first.future;
      final stale = controller.refresh();
      orders.load = () => second.future;
      final fresh = controller.refresh();
      second.complete([_record('order', status: 'ready')]);
      await fresh;
      first.complete([_record('order', status: 'received')]);
      await stale;
      expect(container.read(ordersProvider).single.status, 'ready');

      final failure = Completer<List<OrderRecord>>();
      orders.load = () => failure.future;
      final staleFailure = controller.refresh();
      orders.load = () async => [_record('order', status: 'completed')];
      await controller.refresh();
      failure.completeError(StateError('late network failure'));
      await staleFailure;
      expect(container.read(ordersLoadProvider).hasError, isFalse);
      expect(container.read(ordersProvider).single.status, 'completed');
    },
  );

  testWidgets(
    'receipt uses its order ID even when a different order is first',
    (tester) async {
      final container = await _container(_Orders(), api: false);
      final history = container.read(ordersProvider.notifier);
      history.add(_record('paid'));
      history.add(_record('unrelated', minute: 1));
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(home: OrderSuccessScreen(orderId: 'paid')),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Sipariş No: paid'), findsOneWidget);
      expect(find.text('Şube paid'), findsOneWidget);
      expect(find.textContaining('unrelated'), findsNothing);
      history.add(_record('another', minute: 2));
      await tester.pumpAndSettle();
      expect(find.text('Sipariş No: paid'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'missing receipt fetches the requested ID, never another history entry',
    (tester) async {
      final requested = <String>[];
      final orders = _Orders()
        ..loadOne = (id) async {
          requested.add(id);
          return _record(id);
        };
      final container = await _container(orders, api: false);
      container.read(ordersProvider.notifier).add(_record('unrelated'));
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            home: OrderSuccessScreen(
              orderId: 'receipt',
              initialOrder: _record('unrelated'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(requested, ['receipt']);
      expect(find.text('Sipariş No: receipt'), findsOneWidget);
      expect(find.textContaining('unrelated'), findsNothing);
    },
  );

  testWidgets(
    'first checkout refreshes an expired pickup choice before any request',
    (tester) async {
      var now = DateTime(2026, 10, 7, 12);
      final orders = _Orders();
      final container = await _container(orders);
      container.read(cartProvider.notifier).add(item);
      tester.view.physicalSize = const Size(700, 1200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(home: CartScreen(now: () => now)),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('12:15'));
      await tester.pump();
      now = DateTime(2026, 10, 7, 13);
      await tester.tap(find.textContaining('Dosso Dossi Kart ile Öde'));
      await tester.pumpAndSettle();
      expect(orders.attempts, 0);
      expect(
        find.text('Seçtiğin teslim saati geçti. Güncel saatlerden tekrar seç.'),
        findsOneWidget,
      );
      expect(find.text('12:15'), findsNothing);
      expect(find.text('13:15'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
