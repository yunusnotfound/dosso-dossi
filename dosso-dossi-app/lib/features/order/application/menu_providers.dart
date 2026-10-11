import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/menu_repository.dart';
import '../data/api_menu_repository.dart';
import '../../../core/constants/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../domain/product_options.dart';
import '../domain/menu.dart';

final menuCategoriesProvider = FutureProvider<List<MenuCategory>>((ref) {
  return ref.watch(menuRepositoryProvider).getCategories();
});

final menuProductsProvider = FutureProvider<List<Product>>((ref) {
  return ref.watch(menuRepositoryProvider).getProducts();
});

/// Ürün detay ekranı için tek ürün.
final productProvider = FutureProvider.family<Product?, String>((
  ref,
  id,
) async {
  final products = await ref.watch(menuProductsProvider.future);
  for (final product in products) {
    if (product.id == id) return product;
  }
  return null;
});

final menuOptionsProvider = FutureProvider<MenuOptions>((ref) async {
  if (AppConfig.useMocks) return const MenuOptions();
  return apiCall(() async {
    final response = await ref
        .watch(apiClientProvider)
        .get<List<dynamic>>('/menu/options');
    return MenuOptions.fromJson(response.data!);
  });
});

// Gift pricing is global; the selected pickup branch only prices orders.
final giftMenuProductsProvider = FutureProvider<List<Product>>((ref) {
  if (AppConfig.useMocks) return ref.watch(menuProductsProvider.future);
  return ApiMenuRepository(ref.watch(apiClientProvider)).getProducts();
});
