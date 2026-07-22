import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/menu_repository.dart';
import '../domain/menu.dart';

final menuCategoriesProvider = FutureProvider<List<MenuCategory>>((ref) {
  return ref.watch(menuRepositoryProvider).getCategories();
});

final menuProductsProvider = FutureProvider<List<Product>>((ref) {
  return ref.watch(menuRepositoryProvider).getProducts();
});

/// Ürün detay ekranı için tek ürün.
final productProvider = FutureProvider.family<Product?, String>((ref, id) async {
  final products = await ref.watch(menuProductsProvider.future);
  for (final product in products) {
    if (product.id == id) return product;
  }
  return null;
});
