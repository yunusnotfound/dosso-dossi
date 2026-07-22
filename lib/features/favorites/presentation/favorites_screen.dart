import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/product_image.dart';
import '../../../routing/app_router.dart';
import '../../order/application/menu_providers.dart';
import '../application/favorites_controller.dart';

/// Favori ürünler. Kalp, ürün detay ekranından işaretlenir.
class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favoriteIds = ref.watch(favoritesProvider);
    final products = ref.watch(menuProductsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Favorilerim')),
      body: products.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text('Menü yüklenemedi', style: AppTypography.bodySecondary),
        ),
        data: (list) {
          final favorites =
              list.where((p) => favoriteIds.contains(p.id)).toList();
          if (favorites.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('🤍', style: TextStyle(fontSize: 56)),
                  const SizedBox(height: AppSpacing.md),
                  Text('Henüz favorin yok', style: AppTypography.title),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Ürün detayındaki kalbe dokunarak favorilere ekle',
                    style: AppTypography.bodySecondary,
                  ),
                ],
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.page),
            itemCount: favorites.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
            itemBuilder: (context, index) {
              final product = favorites[index];
              return GestureDetector(
                onTap: () => context.push(Routes.productPath(product.id)),
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        child: SizedBox(
                          width: 56,
                          height: 56,
                          child:
                              ProductImage(product: product, emojiSize: 28),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(product.name, style: AppTypography.body),
                            Text(formatTl(product.price),
                                style: AppTypography.title),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => ref
                            .read(favoritesProvider.notifier)
                            .toggle(product.id),
                        icon: const Icon(Icons.favorite,
                            color: AppColors.danger),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
