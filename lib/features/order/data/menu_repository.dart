import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/menu.dart';
import 'mock_menu_repository.dart';

/// Menü veri kaynağı sözleşmesi.
abstract interface class MenuRepository {
  Future<List<MenuCategory>> getCategories();
  Future<List<Product>> getProducts();
}

final menuRepositoryProvider = Provider<MenuRepository>((ref) {
  return MockMenuRepository();
});
