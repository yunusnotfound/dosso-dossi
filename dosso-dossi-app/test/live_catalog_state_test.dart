import 'dart:async';

import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/core/utils/formatters.dart';
import 'package:dosso_dossi/features/branches/application/branch_providers.dart';
import 'package:dosso_dossi/features/branches/domain/branch.dart';
import 'package:dosso_dossi/features/order/application/menu_providers.dart';
import 'package:dosso_dossi/features/order/application/order_providers.dart';
import 'package:dosso_dossi/features/order/data/order_repository.dart';
import 'package:dosso_dossi/features/order/domain/cart.dart';
import 'package:dosso_dossi/features/order/domain/menu.dart';
import 'package:dosso_dossi/features/order/domain/order_record.dart';
import 'package:dosso_dossi/features/order/presentation/product_detail_screen.dart';
import 'package:dosso_dossi/features/order/presentation/widgets/option_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Product _product(String id, {String? name, double price = 100}) => Product(
  id: id,
  name: name ?? id,
  price: price,
  categoryId: 'coffee',
  description: '',
  emoji: '☕',
);

Branch _branch(String id, {String? name, int prepMinutes = 7}) => Branch(
  id: id,
  name: name ?? id,
  address: 'İstanbul',
  city: 'İstanbul',
  distanceMeters: 100,
  isOpen: true,
  hours: '08:00–24:00',
  prepMinutes: prepMinutes,
);

Future<void> _showDetail(
  WidgetTester tester,
  ProviderContainer container,
) async {
  tester.view.physicalSize = const Size(700, 1100);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: ProductDetailScreen(productId: 'b')),
    ),
  );
  await tester.pumpAndSettle();
}

class _RefreshableOrders implements OrderRepository {
  Future<List<OrderRecord>> Function() load = () async => [];

  @override
  Future<List<OrderRecord>> getOrders() => load();

  @override
  Future<OrderRecord> getOrder(String id) => throw UnimplementedError();

  @override
  Future<OrderRecord> placeOrder({
    required Branch branch,
    required String pickupLabel,
    required CartState cart,
  }) => throw UnimplementedError();
}

void main() {
  test(
    'order refresh preserves history on failure and after disposal',
    () async {
      final repository = _RefreshableOrders();
      final container = ProviderContainer(
        overrides: [orderRepositoryProvider.overrideWithValue(repository)],
      );
      final controller = container.read(ordersProvider.notifier);
      final order = OrderRecord(
        id: 'order-1',
        createdAt: DateTime(2026),
        branchName: 'Şube',
        pickupLabel: 'En kısa',
        itemsLabel: 'Kahve',
        total: 100,
        stampsEarned: 1,
      );
      controller.add(order);
      repository.load = () async => [order.copyWith(status: 'ready')];
      await controller.refresh();
      expect(container.read(ordersProvider).single.status, 'ready');

      repository.load = () async => throw StateError('offline');
      await expectLater(controller.refresh(), throwsStateError);
      expect(container.read(ordersProvider).single.status, 'ready');

      final pending = Completer<List<OrderRecord>>();
      repository.load = () => pending.future;
      final refresh = controller.refresh();
      container.dispose();
      pending.complete([order]);
      await expectLater(refresh, completes);
    },
  );
  testWidgets('detail keeps product and choices across reorder and removal', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    var products = [_product('a'), _product('b'), _product('c')];
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        menuProductsProvider.overrideWith((ref) async => products),
      ],
    );
    addTearDown(container.dispose);
    await _showDetail(tester, container);
    await tester.tap(find.text('Yulaf sütü +60 ₺'));
    await tester.pumpAndSettle();

    products = [
      _product('b', name: 'B güncel', price: 120),
      _product('c'),
      _product('a'),
    ];
    container.invalidate(menuProductsProvider);
    await tester.pumpAndSettle();
    expect(find.text('B güncel'), findsOneWidget);
    expect(find.text('Sepete Ekle · ${formatTl(180)}'), findsOneWidget);
    expect(
      tester
          .widgetList<OptionSelector>(find.byType(OptionSelector))
          .first
          .selected
          .name,
      'Yulaf sütü',
    );

    products = [_product('b', name: 'B güncel', price: 120)];
    container.invalidate(menuProductsProvider);
    await tester.pumpAndSettle();
    expect(find.text('B güncel'), findsOneWidget);
    expect(tester.takeException(), isNull);

    products = [_product('a')];
    container.invalidate(menuProductsProvider);
    await tester.pumpAndSettle();
    expect(find.text('Bu ürün şu anda satışta değil'), findsOneWidget);
    expect(find.textContaining('Sepete Ekle'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'swiped product stays open when original route product is removed',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      var products = [_product('a'), _product('b'), _product('c')];
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          menuProductsProvider.overrideWith((ref) async => products),
        ],
      );
      addTearDown(container.dispose);
      await _showDetail(tester, container);
      final carousel = find.byWidgetPredicate(
        (widget) =>
            widget is GestureDetector && widget.onHorizontalDragEnd != null,
      );
      await tester.drag(carousel, const Offset(-170, 0));
      await tester.pumpAndSettle();
      expect(find.text('c'), findsOneWidget);

      products = [_product('c', name: 'C güncel'), _product('a')];
      container.invalidate(menuProductsProvider);
      await tester.pumpAndSettle();
      expect(find.text('C güncel'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'detail keeps loaded data on failed refresh and updates on retry',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      var products = [_product('b')];
      var failRefresh = false;
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          menuProductsProvider.overrideWith((ref) async {
            if (failRefresh) throw StateError('offline');
            return products;
          }),
        ],
      );
      addTearDown(container.dispose);
      await _showDetail(tester, container);
      await tester.tap(find.text('Yulaf sütü +60 ₺'));
      await tester.pumpAndSettle();

      failRefresh = true;
      container.invalidate(menuProductsProvider);
      await tester.pumpAndSettle();
      expect(find.text('b'), findsOneWidget);
      expect(find.text('Sepete Ekle · ${formatTl(160)}'), findsOneWidget);
      expect(find.text('Ürün yüklenemedi'), findsNothing);
      expect(tester.takeException(), isNull);

      failRefresh = false;
      products = [_product('b', name: 'B güncel', price: 130)];
      container.invalidate(menuProductsProvider);
      await tester.pumpAndSettle();
      expect(find.text('B güncel'), findsOneWidget);
      expect(find.text('Sepete Ekle · ${formatTl(190)}'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  test(
    'selected branch uses current details and recovers if removed',
    () async {
      var branches = [_branch('a'), _branch('b')];
      final container = ProviderContainer(
        overrides: [branchesProvider.overrideWith((ref) async => branches)],
      );
      addTearDown(container.dispose);
      container.read(selectedBranchProvider.notifier).select(branches.last);
      await container.read(branchesProvider.future);
      expect(container.read(activeBranchProvider).requireValue.id, 'b');

      branches = [
        _branch('a'),
        _branch('b', name: 'B güncel', prepMinutes: 18),
      ];
      container.invalidate(branchesProvider);
      await container.read(branchesProvider.future);
      final updated = container.read(activeBranchProvider).requireValue;
      expect(updated.name, 'B güncel');
      expect(updated.prepMinutes, 18);

      branches = [_branch('a')];
      container.invalidate(branchesProvider);
      await container.read(branchesProvider.future);
      expect(container.read(activeBranchProvider).requireValue.id, 'a');
    },
  );
}
