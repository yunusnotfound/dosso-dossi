import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_spacing.dart';
import '../core/theme/app_typography.dart';

/// 5 sekmeli alt menü kabuğu. Sekme ekranları app_router.dart'ta tanımlıdır.
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: _PillNavBar(
        currentIndex: navigationShell.currentIndex,
        onSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem(this.branch, this.icon, this.selectedIcon, this.label);

  /// app_router.dart'taki StatefulShellBranch sırası. Görsel sıra ile aynı
  /// olmak zorunda değil: "Tara & Öde" ortaya alındığı için 1 → 2. slot.
  final int branch;
  final IconData icon;
  final IconData selectedIcon;
  final String label;
}

/// Zeminden ayrık, hap şeklinde yüzen alt menü. Ortadaki "Tara & Öde"
/// sekmesi hapın üzerine taşan yuvarlak bir FAB olarak durur.
/// Yüksekliği Scaffold'da yer kapladığı için içerik barın altında kalmaz.
class _PillNavBar extends StatelessWidget {
  const _PillNavBar({required this.currentIndex, required this.onSelected});

  final int currentIndex;
  final ValueChanged<int> onSelected;

  /// Görsel sıra. Ortadaki (indeks 2) öğe FAB olarak çizilir.
  static const _items = <_NavItem>[
    _NavItem(0, Icons.home_outlined, Icons.home, 'Ana Sayfa'),
    _NavItem(2, Icons.coffee_outlined, Icons.coffee, 'Sipariş'),
    _NavItem(
        1, Icons.qr_code_scanner_outlined, Icons.qr_code_scanner, 'Tara & Öde'),
    _NavItem(3, Icons.card_giftcard_outlined, Icons.card_giftcard, 'Hediye'),
    _NavItem(4, Icons.storefront_outlined, Icons.storefront, 'Mağazalar'),
  ];

  static const _fabSlot = 2;
  static const _barHeight = 64.0;
  static const _fabSize = 56.0;

  /// FAB'ın hapın üstüne taşan miktarı. Bu kadar pay widget'ın kendi
  /// sınırları içinde bırakılır; aksi halde taşan kısım tıklanamaz olur.
  static const _fabLift = 20.0;

  @override
  Widget build(BuildContext context) {
    final fabItem = _items[_fabSlot];
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.xs,
          AppSpacing.md,
          AppSpacing.md,
        ),
        child: SizedBox(
          height: _barHeight + _fabLift,
          child: Stack(
            children: [
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _bar(),
              ),
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Center(
                  child: _ScanFab(
                    item: fabItem,
                    size: _fabSize,
                    selected: currentIndex == fabItem.branch,
                    onTap: () => onSelected(fabItem.branch),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bar() {
    return Container(
      height: _barHeight,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.pill),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ],
      ),
      // Material: InkWell dalgalarının hap zeminine düşmesi ve hap
      // şeklinde kırpılması için gerekli.
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        clipBehavior: Clip.antiAlias,
        // Yatay boşluk: uçtaki sekmeler hapın yuvarlak köşelerine değmesin.
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
          child: Row(
            children: [
              for (var i = 0; i < _items.length; i++)
                Expanded(
                  child: _PillNavTab(
                    item: _items[i],
                    selected: currentIndex == _items[i].branch,
                    // Ortadaki slotta ikonun yerini FAB alır; etiketi
                    // diğerleriyle aynı hizada kalsın diye slot korunur.
                    showIcon: i != _fabSlot,
                    onTap: () => onSelected(_items[i].branch),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PillNavTab extends StatelessWidget {
  const _PillNavTab({
    required this.item,
    required this.selected,
    required this.onTap,
    this.showIcon = true,
  });

  final _NavItem item;
  final bool selected;
  final VoidCallback onTap;
  final bool showIcon;

  static const _iconSize = 21.0;
  static const _iconSlotHeight = _iconSize + AppSpacing.xs * 2;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.primary : AppColors.textSecondary;
    return Semantics(
      selected: selected,
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (showIcon)
              // Seçili sekmenin ikonu soluk turuncu bir hapın içine alınır.
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: selected ? AppColors.surfaceTint : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Icon(
                  selected ? item.selectedIcon : item.icon,
                  size: _iconSize,
                  color: color,
                ),
              )
            else
              const SizedBox(height: _iconSlotHeight),
            const SizedBox(height: 3),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              // Dar ekranlarda "Kampanyalar" kırpılmak yerine küçülür.
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  item.label,
                  maxLines: 1,
                  style:
                      AppTypography.badge.copyWith(fontSize: 11, color: color),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Hapın ortasında yükselen turuncu tarama butonu.
class _ScanFab extends StatelessWidget {
  const _ScanFab({
    required this.item,
    required this.size,
    required this.selected,
    required this.onTap,
  });

  final _NavItem item;
  final double size;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // Gölge FAB'ın rengini izler; seçiliyken koyu butonun altında turuncu
    // hale kalmasın.
    final background = selected ? AppColors.coffeeDark : AppColors.primary;
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: background.withValues(alpha: 0.30),
              blurRadius: 20,
              offset: const Offset(0, 7),
            ),
          ],
        ),
        child: Material(
          color: background,
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: Icon(
              selected ? item.selectedIcon : item.icon,
              size: 26,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}
