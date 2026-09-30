import 'package:dosso_dossi/features/branches/application/branch_providers.dart';
import 'package:dosso_dossi/features/branches/domain/branch.dart';
import 'package:dosso_dossi/features/order/application/menu_providers.dart';
import 'package:dosso_dossi/features/order/domain/menu.dart';
import 'package:dosso_dossi/features/order/presentation/order_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Branch _branch(String name) => Branch(
  id: 'branch',
  name: name,
  address: 'İstanbul',
  city: 'İstanbul',
  distanceMeters: 100,
  isOpen: true,
  hours: '08:00–24:00',
);

void main() {
  testWidgets('retained order tab resumes safely after background refresh', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(700, 1100);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    var branches = [_branch('Şube')];
    var products = <Product>[];
    final container = ProviderContainer(
      overrides: [
        branchesProvider.overrideWith((ref) async => branches),
        menuProductsProvider.overrideWith((ref) async => products),
        menuCategoriesProvider.overrideWith((ref) async => []),
      ],
    );
    addTearDown(container.dispose);
    var active = true;
    late StateSetter updateTab;
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: StatefulBuilder(
            builder: (context, setState) {
              updateTab = setState;
              return Offstage(
                offstage: !active,
                child: TickerMode(enabled: active, child: const OrderScreen()),
              );
            },
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Gel-Al · Şube'), findsOneWidget);

    for (var i = 0; i < 3; i++) {
      updateTab(() => active = false);
      await tester.pumpAndSettle();
      branches = [_branch('Şube $i')];
      products = [
        Product(
          id: 'coffee',
          name: 'Kahve $i',
          price: 100 + i.toDouble(),
          categoryId: 'coffee',
          description: '',
          emoji: '☕',
          isFeatured: true,
        ),
      ];
      container.invalidate(branchesProvider);
      container.invalidate(menuProductsProvider);
      await tester.runAsync(() async {
        await Future.wait([
          container.read(branchesProvider.future),
          container.read(menuProductsProvider.future),
        ]);
      });
      await tester.pumpAndSettle();

      updateTab(() => active = true);
      await tester.pumpAndSettle();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Gel-Al · Şube $i'), findsOneWidget);
      expect(find.text('Kahve $i'), findsOneWidget);
    }
  });
}
