import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/coffee_bean_icon.dart';
import '../../../core/widgets/product_image.dart';
import '../../../routing/app_router.dart';
import '../../favorites/application/favorites_controller.dart';
import '../../order/application/cart_controller.dart';
import '../../order/application/menu_providers.dart';
import '../../order/domain/menu.dart';
import '../../order/presentation/widgets/add_to_cart_button.dart';

/// Online Mağaza sekmesi: termos, mug ve çekirdek kahveler. Menüden ayrı
/// vitrin; ürün detayı, favoriler ve sepet sipariş akışıyla ortaktır.
class ShopScreen extends ConsumerStatefulWidget {
  const ShopScreen({super.key});

  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  /// Başlığın iki yanına ayrılan alan: 2 ikon (40) + aralık (4).
  static const _headerIconsWidth = 84.0;

  String _query = '';
  String _categoryId = 'merch';

  List<Product> _filter(List<Product> products) {
    final query = _query.trim().toLowerCase();
    return products.where((p) {
      if (!shopCategoryIds.contains(p.categoryId)) return false;
      if (query.isNotEmpty) return p.name.toLowerCase().contains(query);
      return p.categoryId == _categoryId;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(menuProductsProvider);
    final categories = ref.watch(menuCategoriesProvider);
    final cartCount = ref.watch(cartProvider.select((c) => c.count));

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: AppSpacing.xxxl),
          children: [
            // Başlık: ortada sayfa adı, sağda favoriler + sepet.
            // İki yanda eşit genişlik ayrılır ki başlık gerçekten ortalansın
            // ve sepet rozeti kırpılmadan sığsın.
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.page,
                AppSpacing.md,
                AppSpacing.page,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  const SizedBox(width: _headerIconsWidth),
                  Expanded(
                    // Dar ekranlarda (iPhone SE) başlık kırpılmak yerine
                    // sığacak kadar küçülür; geniş ekranlarda tam boyutta.
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        'Online Mağaza',
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        style: AppTypography.headline,
                      ),
                    ),
                  ),
                  SizedBox(
                    width: _headerIconsWidth,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        _HeaderIcon(
                          icon: Icons.favorite_border,
                          onTap: () => context.push(Routes.favorites),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Badge(
                          label: Text('$cartCount'),
                          isLabelVisible: cartCount > 0,
                          backgroundColor: AppColors.primary,
                          offset: const Offset(-2, 2),
                          child: _HeaderIcon(
                            icon: Icons.shopping_cart_outlined,
                            onTap: () => context.push(Routes.cart),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Arama
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.page),
              child: TextField(
                decoration: const InputDecoration(
                  hintText: 'Mağazada ara',
                  prefixIcon: Icon(
                    Icons.search,
                    color: AppColors.textSecondary,
                  ),
                ),
                onChanged: (value) => setState(() => _query = value),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            // Kampanya afişleri (yatay kaydırmalı)
            SizedBox(
              height: 150,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.page,
                ),
                children: const [
                  _TermosBanner(),
                  SizedBox(width: AppSpacing.md),
                  _BeansBanner(),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            // Kategori sekmeleri (alt çizgili)
            categories.when(
              loading: () => const SizedBox(height: 40),
              error: (e, _) => const SizedBox.shrink(),
              data: (list) => Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.page,
                ),
                child: Row(
                  children: [
                    // Sekme sırası shopCategoryIds sırasını izler (önce
                    // Termos & Mug), menüdeki kategori sırasını değil.
                    for (final id in shopCategoryIds)
                      for (final category in list)
                        if (category.id == id)
                          Padding(
                            padding: const EdgeInsets.only(
                              right: AppSpacing.xl,
                            ),
                            child: _CategoryTab(
                              label: category.name,
                              selected:
                                  category.id == _categoryId &&
                                  _query.trim().isEmpty,
                              onTap: () => setState(() {
                                _categoryId = category.id;
                                _query = '';
                              }),
                            ),
                          ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            // Ürünler
            products.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(AppSpacing.xxxl),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.all(AppSpacing.xxxl),
                child: Center(
                  child: Text(
                    'Mağaza yüklenemedi',
                    style: AppTypography.bodySecondary,
                  ),
                ),
              ),
              data: (list) {
                final filtered = _filter(list);
                if (filtered.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.all(AppSpacing.xxxl),
                    child: Center(
                      child: Text(
                        'Sonuç bulunamadı',
                        style: AppTypography.bodySecondary,
                      ),
                    ),
                  );
                }
                return Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.page,
                  ),
                  child: GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    mainAxisSpacing: AppSpacing.md,
                    crossAxisSpacing: AppSpacing.md,
                    childAspectRatio: 0.58,
                    children: [
                      for (final product in filtered)
                        _ShopProductCard(product: product),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// Başlıktaki yuvarlak zeminli ikon butonu.
class _HeaderIcon extends StatelessWidget {
  const _HeaderIcon({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.surface,
        ),
        child: Icon(icon, size: 21, color: AppColors.textPrimary),
      ),
    );
  }
}

/// Afiş 1: koyu zeminde yeni termoslar.
class _TermosBanner extends StatelessWidget {
  const _TermosBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 300,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.coffeeDark,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Yeni Termoslar\nSeni Bekliyor',
                  style: AppTypography.title.copyWith(
                    color: AppColors.textOnDark,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '4 renk · 500 ml',
                  style: AppTypography.badge.copyWith(
                    color: AppColors.goldOnDark,
                  ),
                ),
              ],
            ),
          ),
          Image.asset(
            'assets/images/termos_pembe.png',
            height: 110,
            fit: BoxFit.contain,
          ),
          Image.asset(
            'assets/images/termos_yesil.png',
            height: 96,
            fit: BoxFit.contain,
          ),
        ],
      ),
    );
  }
}

/// Afiş 2: altın zeminde çekirdek kahveler.
class _BeansBanner extends StatelessWidget {
  const _BeansBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 300,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.gold,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Taze Kavrulmuş\nÇekirdekler',
                  style: AppTypography.title.copyWith(
                    color: AppColors.onGold,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Evinde Dosso Dossi keyfi',
                  style: AppTypography.badge.copyWith(color: AppColors.onGold),
                ),
              ],
            ),
          ),
          const CoffeeBeanIcon(size: 84, color: AppColors.onGold),
        ],
      ),
    );
  }
}

/// Alt çizgili kategori sekmesi (referans tasarımdaki gibi).
class _CategoryTab extends StatelessWidget {
  const _CategoryTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppTypography.title.copyWith(
              color: selected ? AppColors.textPrimary : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
            height: 3,
            width: selected ? 36 : 0,
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
          ),
        ],
      ),
    );
  }
}

/// Ürün kartı: favori kalbi, görsel, ad, fiyat ve "Sepete ekle".
class _ShopProductCard extends ConsumerWidget {
  const _ShopProductCard({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFavorite = ref.watch(
      favoritesProvider.select((s) => s.contains(product.id)),
    );

    return GestureDetector(
      onTap: () => context.push(Routes.productPath(product.id)),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    child: SizedBox.expand(
                      child: ProductImage(product: product),
                    ),
                  ),
                  Positioned(
                    top: AppSpacing.xs,
                    right: AppSpacing.xs,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => ref
                          .read(favoritesProvider.notifier)
                          .toggle(product.id),
                      child: Container(
                        width: 32,
                        height: 32,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.surface,
                        ),
                        child: Icon(
                          isFavorite ? Icons.favorite : Icons.favorite_border,
                          size: 18,
                          color: isFavorite
                              ? AppColors.danger
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                  if (product.isNew)
                    Positioned(
                      top: AppSpacing.xs,
                      left: AppSpacing.xs,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: AppSpacing.xs,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceTint,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                        child: Text(
                          'Yeni',
                          style: AppTypography.badge.copyWith(
                            fontSize: 12,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              product.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(height: 1.2),
            ),
            const SizedBox(height: 2),
            Text(
              formatTl(product.price),
              maxLines: 1,
              textAlign: TextAlign.center,
              style: AppTypography.title,
            ),
            const SizedBox(height: AppSpacing.sm),
            AddToCartButton(product: product),
          ],
        ),
      ),
    );
  }
}
