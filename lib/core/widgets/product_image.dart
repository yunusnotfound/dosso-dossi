import 'package:flutter/material.dart';

import '../../features/order/domain/menu.dart';
import '../theme/app_colors.dart';

/// Ürün görseli: fotoğraf varsa bozmadan (contain) gösterir,
/// yoksa emoji yer tutucu. Kart, sepet ve favori satırlarında kullanılır.
class ProductImage extends StatelessWidget {
  const ProductImage({
    super.key,
    required this.product,
    this.emojiSize = 56,
    this.background = AppColors.surfaceTint,
  });

  final Product product;
  final double emojiSize;
  final Color background;

  @override
  Widget build(BuildContext context) {
    if (product.images.isEmpty) {
      return Container(
        color: background,
        alignment: Alignment.center,
        child: Text(product.emoji, style: TextStyle(fontSize: emojiSize)),
      );
    }
    return Container(
      color: Colors.white,
      alignment: Alignment.center,
      child: Image.asset(product.images.first, fit: BoxFit.contain),
    );
  }
}
