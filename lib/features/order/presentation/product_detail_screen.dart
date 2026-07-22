import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../favorites/application/favorites_controller.dart';
import '../application/cart_controller.dart';
import '../application/menu_providers.dart';
import '../domain/cart.dart';
import '../domain/menu.dart';
import '../domain/product_options.dart';
import 'widgets/option_selector.dart';

/// Ürün detayı — vitrin tasarımı (04-urun-detay.html birebir uyarlaması):
/// ortadaki ürün görseli sağa/sola sürüklenerek aynı kategorideki
/// ürünler arasında gezilir; yanlarda önceki/sonraki ürünler soluk görünür,
/// alt panel yumuşak geçişle güncellenir.
class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.productId});

  final String productId;

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen>
    with SingleTickerProviderStateMixin {
  /// Yan "peek" yuvasının merkeze uzaklığı (HTML: 181px) ve küçülme oranı.
  static const _slotOffset = 181.0;

  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  );
  Animation<double>? _shiftAnimation;

  /// -1..1 arası geçiş ilerlemesi (0 = mevcut ürün merkezde)
  double _shift = 0;
  double _dragDx = 0;
  bool _swapping = false;

  int? _index;
  ProductOption _milk = ProductOptions.defaultMilk;
  ProductOption _shot = ProductOptions.defaultShot;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final anim = _shiftAnimation;
      if (anim != null) setState(() => _shift = anim.value);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _animateShiftTo(double target, {VoidCallback? onDone}) {
    _shiftAnimation = Tween<double>(begin: _shift, end: target).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _controller
      ..reset()
      ..forward().whenComplete(() => onDone?.call());
  }

  void _onDragEnd(List<Product> siblings) {
    if (_swapping) return;
    if (siblings.length < 2 || _shift.abs() < 0.3) {
      _animateShiftTo(0);
      return;
    }
    final dir = _shift > 0 ? 1 : -1;
    _swapping = true;
    _animateShiftTo(dir.toDouble(), onDone: () {
      if (!mounted) return;
      setState(() {
        _index = (_index! + dir + siblings.length) % siblings.length;
        _shift = 0;
        _milk = ProductOptions.defaultMilk;
        _shot = ProductOptions.defaultShot;
        _swapping = false;
      });
    });
  }

  double _priceFor(Product product) => product.hasOptions
      ? product.price + _milk.priceDelta + _shot.priceDelta
      : product.price;

  void _addToCart(Product product) {
    ref.read(cartProvider.notifier).add(
          CartItem(product: product, milk: _milk, shot: _shot),
        );
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${product.name} sepete eklendi'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final productsAsync = ref.watch(menuProductsProvider);

    return productsAsync.when(
      loading: () => const Scaffold(
        backgroundColor: AppColors.primary,
        body: Center(child: CircularProgressIndicator(color: Colors.white)),
      ),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Text('Ürün yüklenemedi', style: AppTypography.bodySecondary),
        ),
      ),
      data: (all) {
        final initial = all.where((p) => p.id == widget.productId).toList();
        if (initial.isEmpty) {
          return Scaffold(
            appBar: AppBar(),
            body: Center(
              child:
                  Text('Ürün bulunamadı', style: AppTypography.bodySecondary),
            ),
          );
        }
        // Kaydırma listesi: aynı kategorideki ürünler, menü sırasıyla.
        final siblings = all
            .where((p) => p.categoryId == initial.first.categoryId)
            .toList(growable: false);
        _index ??= siblings.indexWhere((p) => p.id == widget.productId);
        final product = siblings[_index!];
        final price = _priceFor(product);

        return Scaffold(
          backgroundColor: AppColors.primary,
          body: Column(
            children: [
              SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: Colors.white,
                        child: BackButton(
                          color: AppColors.textPrimary,
                          onPressed: () => context.pop(),
                        ),
                      ),
                      const Spacer(),
                      const BrandLogo(size: 46),
                      const Spacer(),
                      Consumer(
                        builder: (context, ref, _) {
                          final isFavorite = ref
                              .watch(favoritesProvider)
                              .contains(product.id);
                          return CircleAvatar(
                            backgroundColor: Colors.white,
                            child: IconButton(
                              onPressed: () => ref
                                  .read(favoritesProvider.notifier)
                                  .toggle(product.id),
                              icon: Icon(
                                isFavorite
                                    ? Icons.favorite
                                    : Icons.favorite_outline,
                                color: isFavorite
                                    ? AppColors.danger
                                    : AppColors.textPrimary,
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
              // ── Vitrin: sürüklenebilir ürün karuseli ──
              Expanded(
                flex: 2,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onHorizontalDragStart: (_) => _dragDx = 0,
                  onHorizontalDragUpdate: (details) {
                    if (_swapping || siblings.length < 2) return;
                    _dragDx += details.delta.dx;
                    setState(() =>
                        _shift = (-_dragDx / _slotOffset).clamp(-1.3, 1.3));
                  },
                  onHorizontalDragEnd: (_) => _onDragEnd(siblings),
                  onHorizontalDragCancel: () => _onDragEnd(siblings),
                  child: _CarouselStage(
                    siblings: siblings,
                    index: _index!,
                    shift: _shift,
                    slotOffset: _slotOffset,
                  ),
                ),
              ),
              // ── Alt panel (HTML: s04-sheet) ──
              Expanded(
                flex: 3,
                child: Container(
                  width: double.infinity,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius:
                        BorderRadius.vertical(top: Radius.circular(30)),
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x1F2A1B12),
                        blurRadius: 34,
                        offset: Offset(0, -14),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: 44,
                        height: 5,
                        margin: const EdgeInsets.only(
                            top: AppSpacing.md, bottom: AppSpacing.sm),
                        decoration: BoxDecoration(
                          color: AppColors.divider,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                      Expanded(
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 220),
                          transitionBuilder: (child, animation) =>
                              FadeTransition(
                            opacity: animation,
                            child: SlideTransition(
                              position: Tween<Offset>(
                                begin: const Offset(0, 0.03),
                                end: Offset.zero,
                              ).animate(animation),
                              child: child,
                            ),
                          ),
                          child: _SheetContent(
                            key: ValueKey(product.id),
                            product: product,
                            price: price,
                            milk: _milk,
                            shot: _shot,
                            onMilk: (o) => setState(() => _milk = o),
                            onShot: (o) => setState(() => _shot = o),
                            onAdd: () => _addToCart(product),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Karusel sahnesi: merkez ürün + yanlarda soluk önceki/sonraki ürünler.
/// Konum/ölçek/opaklık tek `shift` değerinden türetilir (HTML'deki FLIP mantığı).
class _CarouselStage extends StatelessWidget {
  const _CarouselStage({
    required this.siblings,
    required this.index,
    required this.shift,
    required this.slotOffset,
  });

  final List<Product> siblings;
  final int index;
  final double shift;
  final double slotOffset;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final artHeight = constraints.maxHeight * 0.92;
        final slots = <int>[-2, -1, 1, 2, 0]; // merkez en üstte çizilir
        final children = <Widget>[];

        for (final rel in slots) {
          if (siblings.length == 1 && rel != 0) continue;
          if (siblings.length == 2 && rel.abs() > 1) continue;
          final itemIndex =
              ((index + rel) % siblings.length + siblings.length) %
                  siblings.length;
          final p = rel - shift;
          final ap = p.abs();
          final scale = 1 - 0.375 * math.min(ap, 1);
          final opacity = ap <= 1
              ? 1 - 0.58 * ap
              : math.max(0.0, 0.42 * (2 - ap));
          if (opacity <= 0.02) continue;

          children.add(
            Positioned.fill(
              child: Align(
                child: Transform.translate(
                  offset: Offset(p * slotOffset, 0),
                  child: Transform.scale(
                    scale: scale,
                    child: Opacity(
                      opacity: opacity.clamp(0.0, 1.0),
                      child: _ProductArt(
                        product: siblings[itemIndex],
                        height: artHeight,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        }

        return Stack(clipBehavior: Clip.none, children: children);
      },
    );
  }
}

class _ProductArt extends StatelessWidget {
  const _ProductArt({required this.product, required this.height});

  final Product product;
  final double height;

  @override
  Widget build(BuildContext context) {
    if (product.images.isNotEmpty) {
      return SizedBox(
        height: height,
        child: Image.asset(product.images.first, fit: BoxFit.contain),
      );
    }
    return SizedBox(
      height: height,
      child: Center(
        child: Text(
          product.emoji,
          style: TextStyle(fontSize: math.min(120, height * 0.55)),
        ),
      ),
    );
  }
}

/// Alt panel içeriği: fiyat + rozetler, isim, açıklama, seçenekler, CTA.
class _SheetContent extends StatelessWidget {
  const _SheetContent({
    super.key,
    required this.product,
    required this.price,
    required this.milk,
    required this.shot,
    required this.onMilk,
    required this.onShot,
    required this.onAdd,
  });

  final Product product;
  final double price;
  final ProductOption milk;
  final ProductOption shot;
  final ValueChanged<ProductOption> onMilk;
  final ValueChanged<ProductOption> onShot;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.xl, AppSpacing.xs, AppSpacing.xl, AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                formatTl(price),
                style: AppTypography.numberLarge.copyWith(fontSize: 30),
              ),
              const Spacer(),
              if (product.sizeMl > 0) ...[
                _InfoChip(text: '${product.sizeMl} ml'),
                const SizedBox(width: AppSpacing.sm),
              ],
              if (product.stampMultiplier > 0)
                _InfoChip(
                  text: product.stampMultiplier > 1
                      ? '+${product.stampMultiplier} damga'
                      : '+1 damga',
                  gold: true,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(product.name, style: AppTypography.headline),
          const SizedBox(height: AppSpacing.xs),
          Text(product.description, style: AppTypography.bodySecondary),
          const SizedBox(height: AppSpacing.md),
          if (product.hasOptions)
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    OptionSelector(
                      label: 'Süt',
                      options: ProductOptions.milks,
                      selected: milk,
                      onChanged: onMilk,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    OptionSelector(
                      label: 'Shot',
                      options: ProductOptions.shots,
                      selected: shot,
                      onChanged: onShot,
                    ),
                  ],
                ),
              ),
            )
          else
            const Spacer(),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: onAdd,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.coffeeDark,
            ),
            child: Text('Sepete Ekle · ${formatTl(price)}'),
          ),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.text, this.gold = false});

  final String text;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: gold ? AppColors.gold : Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: gold ? null : Border.all(color: AppColors.divider),
      ),
      child: Text(
        text,
        style: AppTypography.badge.copyWith(
          color: gold ? AppColors.onGold : AppColors.textPrimary,
        ),
      ),
    );
  }
}
