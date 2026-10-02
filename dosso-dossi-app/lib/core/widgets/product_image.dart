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
    // Grid kartlarında emoji, fotoğraflı ürünlerle benzer ağırlıkta görünsün
    // (gerçek fotoğraf eklenince kart düzeni değişmez).
    this.emojiSize = 96,
    this.background = AppColors.surfaceTint,
    this.memCacheWidth = 450,
    this.preferGrid = false,
  });

  final Product product;
  final double emojiSize;
  final Color background;

  /// true ise (sadece sipariş grid'i) varsa kare vitrin fotoğrafı
  /// [Product.gridImage] kullanılır; kırpılmadan kutuya sığdırılır.
  final bool preferGrid;

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
    final sources = <String>{
      if (preferGrid && product.gridImage?.trim().isNotEmpty == true)
        product.gridImage!,
      ...product.images.where((src) => src.trim().isNotEmpty),
      if (product.gridImage?.trim().isNotEmpty == true) product.gridImage!,
    }.toList();
    Widget source(int index) {
      if (index >= sources.length) return _emoji();
      final src = sources[index];
      return Container(
        color: background == Colors.transparent
            ? Colors.transparent
            : Colors.white,
        alignment: Alignment.center,
        child: src.startsWith('/') || src.startsWith('http')
            ? CachedNetworkImage(
                imageUrl: ApiEndpoints.mediaUrl(src),
                fit: BoxFit.contain,
                memCacheWidth: memCacheWidth,
                fadeInDuration: const Duration(milliseconds: 150),
                placeholder: (_, _) => _emoji(),
                errorWidget: (_, _, _) => source(index + 1),
              )
            : Image.asset(
                src,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => source(index + 1),
              ),
      );
    }

    return Semantics(
      image: true,
      label: product.name,
      child: ExcludeSemantics(child: source(0)),
    );
  }
}
