import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../application/cart_controller.dart';
import '../../domain/cart.dart';
import '../../domain/menu.dart';
import '../../domain/product_options.dart';

/// Ürün kartındaki "Sepete ekle" butonu. Dokununca ürünü varsayılan
/// seçeneklerle sepete ekler ve kısa süreliğine "Sepete eklendi" durumuna
/// geçer — bildirim (SnackBar) göstermez. Yalnızca kişiselleştirme
/// gerektirmeyen ürünlerde kullanılmalı (hasOptions == false).
class AddToCartButton extends ConsumerStatefulWidget {
  const AddToCartButton({super.key, required this.product});

  final Product product;

  @override
  ConsumerState<AddToCartButton> createState() => _AddToCartButtonState();
}

class _AddToCartButtonState extends ConsumerState<AddToCartButton> {
  Timer? _resetTimer;
  bool _added = false;

  @override
  void dispose() {
    _resetTimer?.cancel();
    super.dispose();
  }

  void _add() {
    ref.read(cartProvider.notifier).add(CartItem(
          product: widget.product,
          milk: ProductOptions.defaultMilk,
          shot: ProductOptions.defaultShot,
        ));
    setState(() => _added = true);
    _resetTimer?.cancel();
    _resetTimer = Timer(const Duration(milliseconds: 1800), () {
      if (mounted) setState(() => _added = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      // Eklendi durumundayken tekrar dokunuş da ekler; buton kilitlenmez.
      onTap: _add,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: _added ? AppColors.primary : Colors.transparent,
          border: Border.all(color: AppColors.primary, width: 1.4),
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_added) ...[
              const Icon(Icons.check, size: 17, color: Colors.white),
              const SizedBox(width: AppSpacing.xs),
            ],
            Text(
              _added ? 'Sepete eklendi' : 'Sepete ekle',
              style: AppTypography.body.copyWith(
                color: _added ? Colors.white : AppColors.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
