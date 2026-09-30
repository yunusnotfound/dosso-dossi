import 'package:dosso_dossi/features/order/application/cart_controller.dart';
import 'package:dosso_dossi/features/order/application/menu_providers.dart';
import 'package:dosso_dossi/features/order/domain/cart.dart';
import 'package:dosso_dossi/features/order/domain/menu.dart';
import 'package:dosso_dossi/features/order/domain/product_options.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Product product({String name = 'Kahve', double price = 100}) => Product(
  id: 'coffee',
  name: name,
  price: price,
  categoryId: 'coffee',
  description: '',
  emoji: '☕',
);

void main() {
  test(
    'cart reprices and renames, preserving quantity and selected options',
    () async {
      var products = [product()];
      final container = ProviderContainer(
        overrides: [menuProductsProvider.overrideWith((ref) async => products)],
      );
      addTearDown(container.dispose);
      final cart = container.read(cartProvider.notifier);
      await container.read(menuProductsProvider.future);
      cart.add(
        CartItem(
          product: products.single,
          quantity: 2,
          milk: ProductOptions.milks[1],
          shot: ProductOptions.shots[1],
        ),
      );
      products = [product(name: 'Güncel Kahve', price: 150)];
      container.invalidate(menuProductsProvider);
      await container.read(menuProductsProvider.future);
      await container.pump();
      final updated = container.read(cartProvider);
      expect(updated.items.single.product.name, 'Güncel Kahve');
      expect(updated.items.single.quantity, 2);
      expect(updated.items.single.milk.name, 'Yulaf sütü');
      expect(updated.items.single.shot.name, 'Çift shot');
      expect(updated.total, 500);
      expect(updated.catalogNotice, isNotNull);
    },
  );

  test(
    'failed refresh keeps cart; successful removal clears inactive items',
    () async {
      var products = [product()];
      var offline = false;
      final container = ProviderContainer(
        retry: (_, _) => null,
        overrides: [
          menuProductsProvider.overrideWith((ref) async {
            if (offline) throw StateError('offline');
            return products;
          }),
        ],
      );
      addTearDown(container.dispose);
      final cart = container.read(cartProvider.notifier);
      await container.read(menuProductsProvider.future);
      cart.add(
        CartItem(
          product: products.single,
          milk: ProductOptions.defaultMilk,
          shot: ProductOptions.defaultShot,
        ),
      );
      cart.setUseFreeDrink(true);
      offline = true;
      container.invalidate(menuProductsProvider);
      await expectLater(
        container.read(menuProductsProvider.future),
        throwsStateError,
      );
      await container.pump();
      expect(container.read(cartProvider).count, 1);
      offline = false;
      products = [];
      container.invalidate(menuProductsProvider);
      await container.read(menuProductsProvider.future);
      await container.pump();
      final updated = container.read(cartProvider);
      expect(updated.count, 0);
      expect(updated.useFreeDrink, isFalse);
      expect(updated.catalogNotice, contains('çıkarıldı'));
    },
  );
}
