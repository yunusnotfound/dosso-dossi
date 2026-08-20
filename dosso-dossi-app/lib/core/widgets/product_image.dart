import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../features/order/domain/menu.dart';
import '../network/api_endpoints.dart';
import '../theme/app_colors.dart';

/// Ürün görseli. Üç kaynak destekler:
/// - '/media/...' veya 'http...' → backend'den, disk önbellekli
///   (CachedNetworkImage; decode boyutu [memCacheWidth] ile sınırlanır ki
///   grid/satırlarda dev görseller belleği ve kaydırmayı yormasın),
/// - 'assets/...' → paket içi görsel,
/// - boş → emoji yer tutucu.
/// Kart, sepet ve favori satırlarında kullanılır.
class ProductImage extends StatelessWidget {
  const ProductImage({
    super.key,
    required this.product,
    this.emojiSize = 56,
    this.background = AppColors.surfaceTint,
    this.memCacheWidth = 450,
  });

  final Product product;
  final double emojiSize;
  final Color background;

  /// Ağ görselinin bellekte decode edileceği azami genişlik (fiziksel px).
  /// Grid varsayılanı 450 (~150pt @3x); küçük satırlar 200 geçer.
  final int memCacheWidth;

  Widget _emoji() => Container(
    color: background,
    alignment: Alignment.center,
    child: Text(product.emoji, style: TextStyle(fontSize: emojiSize)),
  );

  @override
  Widget build(BuildContext context) {
    if (product.images.isEmpty) return _emoji();
    final src = product.images.first;
    if (src.startsWith('/') || src.startsWith('http')) {
      return Container(
        color: Colors.white,
        alignment: Alignment.center,
        child: CachedNetworkImage(
          imageUrl: ApiEndpoints.mediaUrl(src),
          fit: BoxFit.contain,
          memCacheWidth: memCacheWidth,
          fadeInDuration: const Duration(milliseconds: 150),
          placeholder: (_, _) => _emoji(),
          errorWidget: (_, _, _) => _emoji(),
        ),
      );
    }
    return Container(
      color: Colors.white,
      alignment: Alignment.center,
      child: Image.asset(src, fit: BoxFit.contain),
    );
  }
}
