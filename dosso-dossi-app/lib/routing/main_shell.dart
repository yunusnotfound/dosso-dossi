import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_spacing.dart';
import '../core/theme/app_typography.dart';

/// Sekme geçişlerinin ortak süresi/eğrisi: bar ve sayfa aynı ritimde aksın.
const _transitionDuration = Duration(milliseconds: 240);
const _transitionCurve = Curves.easeOutCubic;

/// 5 sekmeli alt menü kabuğu. Sekme ekranları app_router.dart'ta tanımlıdır.
class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell>
    with SingleTickerProviderStateMixin {
  /// Sekme değişince yeni sayfa hafifçe belirip yukarı yerleşir.
  /// Giden sayfa ayrıca canlandırılmıyor: StatefulNavigationShell'i
  /// AnimatedSwitcher'a sarmak ağaçta iki örnek bırakır ve sekmelerin
  /// durumunu (kaydırma konumu, form içeriği) bozar.
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: _transitionDuration,
    value: 1,
  );

  late final Animation<double> _fade = Tween(begin: 0.85, end: 1.0)
      .animate(CurvedAnimation(parent: _controller, curve: _transitionCurve));

  late final Animation<Offset> _slide =
      Tween(begin: const Offset(0, 0.012), end: Offset.zero)
          .animate(CurvedAnimation(parent: _controller, curve: _transitionCurve));

  @override
  void didUpdateWidget(covariant MainShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.navigationShell.currentIndex !=
        widget.navigationShell.currentIndex) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FadeTransition(
        opacity: _fade,
        child: SlideTransition(
          position: _slide,
          child: widget.navigationShell,
        ),
      ),
      bottomNavigationBar: PillNavBar(
        currentIndex: widget.navigationShell.currentIndex,
        onSelected: (index) => widget.navigationShell.goBranch(
          index,
          initialLocation: index == widget.navigationShell.currentIndex,
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
/// Dokunma davranışı test edilebilsin diye görünür (public) bırakıldı.
class PillNavBar extends StatelessWidget {
  const PillNavBar({
    super.key,
    required this.currentIndex,
    required this.onSelected,
  });

  final int currentIndex;
  final ValueChanged<int> onSelected;

  /// Görsel sıra. Ortadaki (indeks 2) öğe FAB olarak çizilir.
  static const _items = <_NavItem>[
    _NavItem(0, Icons.home_outlined, Icons.home, 'Ana Sayfa'),
    _NavItem(2, Icons.coffee_outlined, Icons.coffee, 'Sipariş'),
    _NavItem(
        1, Icons.qr_code_scanner_outlined, Icons.qr_code_scanner, 'Tara & Öde'),
    // Not: shopping_bag değil local_mall — sepet butonu shopping_bag kullanır,
    // ikisi aynı ekranda karışmasın.
    _NavItem(3, Icons.local_mall_outlined, Icons.local_mall, 'Online Mağaza'),
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
      // Material: hapın beyaz zemini ve köşelerinin kırpılması için.
      // (Dokunma dalgası bilerek kaldırıldı — bkz. _PillNavTab.)
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
    return Semantics(
      selected: selected,
      child: GestureDetector(
        // InkWell yerine GestureDetector: dokunma dalgası/gölgesi
        // istenmiyor. Geri bildirimi zaten seçili sekmenin turuncu hapı
        // ve ikon rengi veriyor.
        behavior: HitTestBehavior.opaque, // boşluklar da tıklanabilir kalsın
        onTap: onTap,
        // Tek bir 0↔1 değeri; hap zemini, ikon geçişi ve yazı rengi aynı
        // kaynaktan beslendiği için hepsi birlikte yumuşar.
        child: TweenAnimationBuilder<double>(
          tween: Tween(end: selected ? 1 : 0),
          duration: _transitionDuration,
          curve: _transitionCurve,
          builder: (context, t, _) {
            final color =
                Color.lerp(AppColors.textSecondary, AppColors.primary, t)!;
            return Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (showIcon)
                  // Seçili sekmenin ikonu soluk turuncu bir hapın içine alınır.
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: Color.lerp(
                        Colors.transparent,
                        AppColors.surfaceTint,
                        t,
                      ),
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.xs,
                      ),
                      child: _MorphIcon(
                        idle: item.icon,
                        active: item.selectedIcon,
                        t: t,
                        color: color,
                      ),
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
                      style: AppTypography.badge
                          .copyWith(fontSize: 11, color: color),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// İçi boş ve dolu ikon arasında sert değişim yerine çapraz geçiş.
/// İkisi de aynı boyutta olduğu için yığın ikon kadar yer kaplar,
/// yerleşim animasyon boyunca oynamaz.
class _MorphIcon extends StatelessWidget {
  const _MorphIcon({
    required this.idle,
    required this.active,
    required this.t,
    required this.color,
    this.size = _PillNavTab._iconSize,
  });

  final IconData idle;
  final IconData active;
  final double t;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Opacity(opacity: 1 - t, child: Icon(idle, size: size, color: color)),
        Opacity(opacity: t, child: Icon(active, size: size, color: color)),
      ],
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
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      // Zemin ve gölge sekmelerle aynı süre/eğride akar.
      child: TweenAnimationBuilder<double>(
        tween: Tween(end: selected ? 1 : 0),
        duration: _transitionDuration,
        curve: _transitionCurve,
        builder: (context, t, _) {
          // Gölge FAB'ın rengini izler; seçiliyken koyu butonun altında
          // turuncu hale kalmasın.
          final background =
              Color.lerp(AppColors.primary, AppColors.coffeeDark, t)!;
          return Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: background,
              boxShadow: [
                BoxShadow(
                  color: background.withValues(alpha: 0.30),
                  blurRadius: 20,
                  offset: const Offset(0, 7),
                ),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: GestureDetector(
              // Sekmelerle aynı davranış: dokunma dalgası yok.
              behavior: HitTestBehavior.opaque,
              onTap: onTap,
              child: Center(
                child: _MorphIcon(
                  idle: item.icon,
                  active: item.selectedIcon,
                  t: t,
                  color: Colors.white,
                  size: 26,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
