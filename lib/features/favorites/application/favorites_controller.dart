import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/local_storage.dart';

/// Favori ürün kimlikleri; cihaza kaydedilir.
final favoritesProvider =
    NotifierProvider<FavoritesController, Set<String>>(FavoritesController.new);

class FavoritesController extends Notifier<Set<String>> {
  static const _key = 'favorite_products';

  @override
  Set<String> build() {
    final stored = ref.watch(sharedPreferencesProvider).getStringList(_key);
    return stored?.toSet() ?? {};
  }

  void toggle(String productId) {
    final next = {...state};
    if (!next.remove(productId)) next.add(productId);
    ref.read(sharedPreferencesProvider).setStringList(_key, next.toList());
    state = next;
  }
}
