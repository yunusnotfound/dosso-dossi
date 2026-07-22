import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/product_image.dart';
import '../../../routing/app_router.dart';
import '../../branches/application/branch_providers.dart';
import '../../branches/domain/branch.dart';
import '../application/cart_controller.dart';
import '../application/menu_providers.dart';
import '../application/order_providers.dart';
import '../domain/menu.dart';

/// Öne Çıkanlar için sahte kategori kimliği.
const _featuredId = '_featured';

/// Sipariş sekmesi: şube, arama, kategoriler ve menü.
class OrderScreen extends ConsumerStatefulWidget {
  const OrderScreen({super.key});

  @override
  ConsumerState<OrderScreen> createState() => _OrderScreenState();
}

class _OrderScreenState extends ConsumerState<OrderScreen> {
  String _query = '';
  String _categoryId = _featuredId;

  List<Product> _filter(List<Product> products) {
    final query = _query.trim().toLowerCase();
    return products.where((p) {
      if (query.isNotEmpty) return p.name.toLowerCase().contains(query);
      if (_categoryId == _featuredId) return p.isFeatured;
      return p.categoryId == _categoryId;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(menuProductsProvider);
    final categories = ref.watch(menuCategoriesProvider);
    final cartCount = ref.watch(cartProvider.select((c) => c.count));

    return Scaffold(
      floatingActionButton: cartCount == 0
          ? null
          : Badge(
              label: Text('$cartCount'),
              backgroundColor: AppColors.coffeeDark,
              offset: const Offset(-4, 4),
              child: FloatingActionButton(
                onPressed: () => context.push(Routes.cart),
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: const CircleBorder(),
                child: const Icon(Icons.shopping_bag_outlined),
              ),
            ),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.page, AppSpacing.page, AppSpacing.page, 0),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  Text('Sipariş', style: AppTypography.displayLarge),
                  const SizedBox(height: AppSpacing.lg),
                  const _BranchSelector(),
                  const SizedBox(height: AppSpacing.md),
                  TextField(
                    decoration: const InputDecoration(
                      hintText: 'Menüde ara',
                      prefixIcon:
                          Icon(Icons.search, color: AppColors.textSecondary),
                    ),
                    onChanged: (value) => setState(() => _query = value),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  categories.when(
                    loading: () => const SizedBox(height: 44),
                    error: (e, _) => const SizedBox.shrink(),
                    data: (list) => _CategoryChips(
                      categories: list,
                      selectedId: _categoryId,
                      onSelected: (id) => setState(() {
                        _categoryId = id;
                        _query = '';
                      }),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ]),
              ),
            ),
            products.when(
              loading: () => const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => SliverFillRemaining(
                child: Center(
                  child: Text('Menü yüklenemedi',
                      style: AppTypography.bodySecondary),
                ),
              ),
              data: (list) {
                final filtered = _filter(list);
                if (filtered.isEmpty) {
                  return SliverFillRemaining(
                    child: Center(
                      child: Text('Sonuç bulunamadı',
                          style: AppTypography.bodySecondary),
                    ),
                  );
                }
                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.page, 0,
                      AppSpacing.page, AppSpacing.xxxl * 2),
                  sliver: SliverGrid(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: AppSpacing.md,
                      crossAxisSpacing: AppSpacing.md,
                      childAspectRatio: 0.72,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) =>
                          _ProductCard(product: filtered[index]),
                      childCount: filtered.length,
                    ),
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

class _BranchSelector extends ConsumerWidget {
  const _BranchSelector();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branch = ref.watch(activeBranchProvider);

    return branch.when(
      loading: () => const SizedBox(height: 72),
      error: (e, _) => const SizedBox.shrink(),
      data: (b) => GestureDetector(
        onTap: () => showBranchPicker(context, ref),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AppColors.surfaceTint,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.storefront_outlined,
                    size: 22, color: AppColors.primary),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Gel-Al · ${b.name.replaceFirst('Dosso Dossi ', '')}',
                        style: AppTypography.body),
                    const SizedBox(height: 2),
                    Text(
                      'Hazırlık ~${b.prepMinutes} dk · ${b.distanceLabel}',
                      style: AppTypography.bodySecondary.copyWith(fontSize: 13),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.keyboard_arrow_down,
                  color: AppColors.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}

/// Şube seçim penceresi — sipariş ve sepet ekranından açılır.
void showBranchPicker(BuildContext context, WidgetRef ref) {
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.background,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
    ),
    builder: (context) => Consumer(
      builder: (context, ref, _) {
        final branches = ref.watch(branchesProvider);
        final active = ref.watch(activeBranchProvider).value;

        return SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.page),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Şube Seç', style: AppTypography.headline),
                const SizedBox(height: AppSpacing.lg),
                branches.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Text('Şubeler yüklenemedi',
                      style: AppTypography.bodySecondary),
                  data: (list) => Column(
                    children: [
                      for (final branch in list)
                        _BranchOption(
                          branch: branch,
                          selected: branch.id == active?.id,
                          onTap: () {
                            ref
                                .read(selectedBranchProvider.notifier)
                                .select(branch);
                            Navigator.of(context).pop();
                          },
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    ),
  );
}

class _BranchOption extends StatelessWidget {
  const _BranchOption({
    required this.branch,
    required this.selected,
    required this.onTap,
  });

  final Branch branch;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.md),
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            width: 2,
            color: selected ? AppColors.primary : Colors.transparent,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(branch.name, style: AppTypography.body),
                  const SizedBox(height: 2),
                  Text(
                    branch.address,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.bodySecondary.copyWith(fontSize: 13),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${branch.distanceLabel} · ${branch.hours}',
                    style: AppTypography.bodySecondary.copyWith(fontSize: 13),
                  ),
                ],
              ),
            ),
            if (selected)
              const Icon(Icons.check_circle, color: AppColors.primary),
          ],
        ),
      ),
    );
  }
}

class _CategoryChips extends StatelessWidget {
  const _CategoryChips({
    required this.categories,
    required this.selectedId,
    required this.onSelected,
  });

  final List<MenuCategory> categories;
  final String selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final all = [
      const MenuCategory(id: _featuredId, name: 'Öne Çıkanlar'),
      ...categories,
    ];

    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: all.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, index) {
          final category = all[index];
          final selected = category.id == selectedId;
          return GestureDetector(
            onTap: () => onSelected(category.id),
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: selected ? AppColors.coffeeDark : AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              child: Text(
                category.name,
                style: AppTypography.body.copyWith(
                  color:
                      selected ? AppColors.textOnDark : AppColors.textPrimary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ProductCard extends ConsumerWidget {
  const _ProductCard({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () => context.push(Routes.productPath(product.id)),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
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
                  if (product.stampMultiplier > 1)
                    Positioned(
                      top: AppSpacing.sm,
                      left: AppSpacing.sm,
                      child: _ProductBadge(
                        text: '${product.stampMultiplier}x Damga',
                        background: AppColors.gold,
                        foreground: AppColors.onGold,
                      ),
                    )
                  else if (product.isNew)
                    Positioned(
                      top: AppSpacing.sm,
                      left: AppSpacing.sm,
                      child: _ProductBadge(
                        text: 'Yeni',
                        background: AppColors.surfaceTint,
                        foreground: AppColors.primary,
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
              style: AppTypography.body.copyWith(height: 1.2),
            ),
            const SizedBox(height: 2),
            Text(
              formatTl(product.price),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.title,
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductBadge extends StatelessWidget {
  const _ProductBadge({
    required this.text,
    required this.background,
    required this.foreground,
  });

  final String text;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        text,
        style: AppTypography.badge.copyWith(fontSize: 12, color: foreground),
      ),
    );
  }
}
