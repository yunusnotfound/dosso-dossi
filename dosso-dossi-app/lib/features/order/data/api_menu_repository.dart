import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../domain/menu.dart';
import 'menu_repository.dart';

/// Gerçek fotoğraflar gelene kadar kategori bazlı emoji yer tutucu
/// (mock ile aynı tablo).
const _categoryEmojis = <String, String>{
  'sicak-kahveler': '☕',
  'aromali-kahveler': '☕',
  'sicak-cikolatalar': '🍫',
  'caylar': '🍵',
  'soguk-kahveler': '🧋',
  'soguk-caylar': '🧋',
  'soguk-cikolatali': '🥤',
  'soguk-meyveli': '🍓',
  'soft-icecekler': '🥤',
  'kahvalti': '🥐',
  'tatlilar': '🍰',
  'kek-kurabiye': '🍪',
  'sandvic-tost': '🥪',
  'atistirmalik': '🥜',
  'cekirdek': '🫘',
  'merch': '🏺',
};

class ApiMenuRepository implements MenuRepository {
  ApiMenuRepository(this._dio);

  final Dio _dio;

  @override
  Future<List<MenuCategory>> getCategories() {
    return apiCall(() async {
      final res = await _dio.get<List<dynamic>>(ApiEndpoints.menuCategories);
      return [
        for (final item in res.data!)
          MenuCategory(
            id: (item as Map<String, dynamic>)['id'] as String,
            name: item['name'] as String,
          ),
      ];
    });
  }

  @override
  Future<List<Product>> getProducts() {
    return apiCall(() async {
      final res = await _dio.get<List<dynamic>>(ApiEndpoints.menuProducts);
      return [
        for (final item in res.data!) _productFromJson(item as Map<String, dynamic>),
      ];
    });
  }

  Product _productFromJson(Map<String, dynamic> json) {
    final categoryId = json['categoryId'] as String;
    final imageUrl = json['imageUrl'] as String?;
    return Product(
      id: json['id'] as String,
      name: json['name'] as String,
      price: (json['price'] as num).toDouble(),
      categoryId: categoryId,
      description: (json['description'] as String?) ?? '',
      emoji: _categoryEmojis[categoryId] ?? '☕',
      sizeMl: (json['sizeMl'] as num?)?.toInt() ?? 0,
      stampMultiplier: (json['stampMultiplier'] as num?)?.toInt() ?? 0,
      isNew: (json['isNew'] as bool?) ?? false,
      isFeatured: (json['isFeatured'] as bool?) ?? false,
      hasOptions: (json['hasOptions'] as bool?) ?? false,
      images: imageUrl == null ? const [] : [imageUrl],
    );
  }
}
