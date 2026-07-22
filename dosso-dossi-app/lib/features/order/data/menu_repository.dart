import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/network/api_client.dart';
import '../domain/menu.dart';
import 'api_menu_repository.dart';
import 'mock_menu_repository.dart';

/// Menü veri kaynağı sözleşmesi.
abstract interface class MenuRepository {
  Future<List<MenuCategory>> getCategories();
  Future<List<Product>> getProducts();
}

final menuRepositoryProvider = Provider<MenuRepository>((ref) {
  return AppConfig.useMocks
      ? MockMenuRepository()
      : ApiMenuRepository(ref.watch(apiClientProvider));
});
