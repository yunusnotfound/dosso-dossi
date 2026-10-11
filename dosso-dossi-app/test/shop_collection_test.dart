import 'dart:convert';

import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/order/application/menu_providers.dart';
import 'package:dosso_dossi/features/order/data/mock_menu_repository.dart';
import 'package:dosso_dossi/features/order/domain/menu.dart';
import 'package:dosso_dossi/features/shop/presentation/shop_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _products = [
  Product(
    id: 'thermos',
    name: 'Termos Turuncu 500 ml',
    price: 890,
    categoryId: 'merch',
    description: '',
    emoji: 'T',
    hasOptions: false,
  ),
  Product(
    id: 'thermos-cream',
    name: 'Termos Krem 500 ml',
    price: 890,
    categoryId: 'merch',
    description: '',
    emoji: 'T',
    hasOptions: false,
  ),
  Product(
    id: 'coffee',
    name: 'Türk Kahvesi 250 Gr',
    price: 250,
    categoryId: 'cekirdek',
    description: '',
    emoji: 'K',
    hasOptions: false,
  ),
];

Finder _banner(String copy) => find.byWidgetPredicate(
  (widget) =>
      widget is Semantics && (widget.properties.label?.contains(copy) ?? false),
);

void main() {
  test(
    'mock shop contains four thermos products and no retired mugs',
    () async {
      final repository = MockMenuRepository();
      final products = await repository.getProducts();
      final categories = await repository.getCategories();
      final merchandise = products.where(
        (product) => product.categoryId == 'merch',
      );
      expect(merchandise, hasLength(4));
      expect(
        merchandise.every((product) => product.name.startsWith('Termos ')),
        isTrue,
      );
      expect(
        products.any(
          (product) =>
              product.name == 'Mug Konik' || product.name == 'Mug Terra Cotta',
        ),
        isFalse,
      );
      expect(
        categories.singleWhere((category) => category.id == 'merch').name,
        'Termoslar',
      );
    },
  );

  for (final guest in [true, false]) {
    testWidgets(
      'shop keeps coffee banners and filters thermos with clearable search, guest=$guest',
      (tester) async {
        tester.view.physicalSize = const Size(430, 932);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        SharedPreferences.setMockInitialValues({
          'auth_guest': guest,
          if (!guest)
            'auth_user': jsonEncode({'phone': '5551112233', 'name': 'Test'}),
        });
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              sharedPreferencesProvider.overrideWithValue(
                await SharedPreferences.getInstance(),
              ),
              menuCategoriesProvider.overrideWith(
                (_) async => [
                  const MenuCategory(id: 'merch', name: 'Termoslar'),
                  const MenuCategory(id: 'cekirdek', name: 'Çekirdek Kahveler'),
                ],
              ),
              menuProductsProvider.overrideWith((_) async => _products),
            ],
            child: const MaterialApp(home: ShopScreen()),
          ),
        );
        await tester.pumpAndSettle();
        final thermos = _banner('Termosları keşfet');
        final origins = _banner('Dünyadan seç, evinde demle.');
        final ritual = _banner('Kahve keyfi, senin usulün.');
        final banners = find.byWidgetPredicate(
          (widget) =>
              widget is ListView && widget.scrollDirection == Axis.horizontal,
        );
        expect(tester.getSize(thermos), const Size(300, 150));
        expect(
          tester.getTopLeft(thermos).dx,
          lessThan(tester.getTopLeft(origins).dx),
        );
        expect(origins, findsOneWidget);
        expect(find.text('Termos Turuncu 500 ml'), findsOneWidget);
        expect(find.text('Termos Krem 500 ml'), findsOneWidget);
        expect(find.text('Türk Kahvesi 250 Gr'), findsNothing);

        // A coffee banner still opens its collection before the thermos filter.
        await tester.dragUntilVisible(ritual, banners, const Offset(-250, 0));
        await tester.pumpAndSettle();
        expect(ritual, findsOneWidget);
        await tester.tap(ritual);
        await tester.pumpAndSettle();
        expect(find.text('Türk Kahvesi 250 Gr'), findsOneWidget);
        expect(find.text('Termos Krem 500 ml'), findsNothing);
        await tester.dragUntilVisible(thermos, banners, const Offset(250, 0));
        await tester.pumpAndSettle();
        await tester.tap(thermos);
        await tester.pumpAndSettle();
        expect(
          tester.widget<TextField>(find.byType(TextField)).controller!.text,
          'Termos',
        );
        expect(find.text('Termos Turuncu 500 ml'), findsOneWidget);
        expect(find.text('Termos Krem 500 ml'), findsOneWidget);
        expect(find.text('Türk Kahvesi 250 Gr'), findsNothing);

        await tester.enterText(find.byType(TextField), '');
        await tester.pumpAndSettle();
        expect(find.text('Termos Turuncu 500 ml'), findsOneWidget);
        expect(find.text('Termos Krem 500 ml'), findsOneWidget);
        expect(find.text('Türk Kahvesi 250 Gr'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
