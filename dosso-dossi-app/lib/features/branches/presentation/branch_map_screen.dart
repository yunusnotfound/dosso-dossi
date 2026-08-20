import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_cancellable_tile_provider/flutter_map_cancellable_tile_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart' show LatLng;

import '../../../core/constants/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../../routing/app_router.dart';
import '../../order/application/order_providers.dart';
import '../application/branch_providers.dart';
import '../domain/branch.dart';
import 'branch_directions.dart';
import 'branch_list_screen.dart';

/// Mağazalar sekmesi: şubeler harita üzerinde logo pinleriyle gösterilir.
/// Pine dokununca alt kart açılır; sağ üstten liste görünümüne geçilir.
class BranchMapScreen extends ConsumerStatefulWidget {
  const BranchMapScreen({super.key});

  @override
  ConsumerState<BranchMapScreen> createState() => _BranchMapScreenState();
}

class _BranchMapScreenState extends ConsumerState<BranchMapScreen> {
  final _mapController = MapController();
  final _searchController = TextEditingController();
  bool _showList = false;
  String _query = '';

  /// İstanbul şubelerini kadraja alan başlangıç görünümü.
  static const _initialCenter = LatLng(41.015, 28.78);
  static const _initialZoom = 10.0;

  @override
  void dispose() {
    _mapController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _focusBranch(Branch branch) {
    FocusScope.of(context).unfocus();
    setState(() {
      _query = '';
      _searchController.clear();
    });
    _mapController.move(LatLng(branch.lat, branch.lng), 14);
    _openBranchSheet(branch);
  }

  void _openBranchSheet(Branch branch) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) => _BranchSheet(
        branch: branch,
        onDetail: () {
          Navigator.pop(sheetContext);
          context.push(Routes.branchDetailPath(branch.id));
        },
        onOrder: () {
          ref.read(selectedBranchProvider.notifier).select(branch);
          Navigator.pop(sheetContext);
          context.go(Routes.order);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final branches = ref.watch(branchesProvider);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Başlık: ortada sayfa adı, sağda harita/liste geçişi.
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.page,
                AppSpacing.md,
                AppSpacing.page,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  const SizedBox(width: 72),
                  Expanded(
                    child: Text(
                      'Mağazalar',
                      textAlign: TextAlign.center,
                      style: AppTypography.headline,
                    ),
                  ),
                  SizedBox(
                    width: 72,
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => setState(() => _showList = !_showList),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _showList ? Icons.map_outlined : Icons.list,
                              size: 24,
                              color: AppColors.textPrimary,
                            ),
                            Text(
                              _showList ? 'Harita' : 'Liste',
                              style: AppTypography.badge.copyWith(fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: branches.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Text(
                    'Şubeler yüklenemedi',
                    style: AppTypography.bodySecondary,
                  ),
                ),
                data: (list) =>
                    _showList ? const BranchListBody() : _buildMap(list),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMap(List<Branch> list) {
    final located = list.where((b) => b.lat != 0 && b.lng != 0).toList();
    final query = _query.trim().toLowerCase();
    final results = query.isEmpty
        ? const <Branch>[]
        : located
              .where(
                (b) =>
                    b.name.toLowerCase().contains(query) ||
                    b.city.toLowerCase().contains(query),
              )
              .toList();

    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _initialCenter,
            initialZoom: _initialZoom,
            // Uzaklaşma sınırı: dünya haritasından öteye (gri boşluğa) gitmesin.
            minZoom: 2.5,
            maxZoom: 18,
            cameraConstraint: CameraConstraint.contain(
              bounds: LatLngBounds(
                const LatLng(-85, -180),
                const LatLng(85, 180),
              ),
            ),
            interactionOptions: const InteractionOptions(
              // Döndürme kapalı: pinler ve harita hep kuzeye baksın.
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
          ),
          children: [
            // Markaya özel "Dosso Dossi Coffee" stili (krem/kahve paleti).
            // Performans: 256@2x karo (512px görsel) 512@2x'ten (1024px) 4 kat
            // ucuz decode edilir; iptal edebilen sağlayıcı da kaydırma
            // sırasında eskiyen istekleri keser — akıcılık için ikisi de şart.
            TileLayer(
              urlTemplate:
                  'https://api.mapbox.com/styles/v1/${AppConfig.mapboxStyle}/tiles/256/{z}/{x}/{y}@2x?access_token=${AppConfig.mapboxToken}',
              userAgentPackageName: 'com.dossodossi.dossoDossi',
              tileProvider: CancellableNetworkTileProvider(),
              panBuffer: 1,
            ),
            MarkerLayer(
              markers: [
                for (final branch in located)
                  Marker(
                    point: LatLng(branch.lat, branch.lng),
                    width: 48,
                    height: 58,
                    // Pinin sivri ucu koordinatın üstüne otursun.
                    alignment: Alignment.topCenter,
                    child: _BranchPin(onTap: () => _openBranchSheet(branch)),
                  ),
              ],
            ),
            // Mapbox kullanım şartı: atıf görünür olmalı.
            Align(
              alignment: Alignment.bottomRight,
              child: Container(
                margin: const EdgeInsets.all(AppSpacing.xs),
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 2,
                ),
                decoration: BoxDecoration(
                  color: Colors.white70,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  '© Mapbox © OpenStreetMap',
                  style: AppTypography.bodySecondary.copyWith(fontSize: 10),
                ),
              ),
            ),
          ],
        ),
        // Arama: haritanın üstünde yüzen alan + sonuç listesi.
        Positioned(
          top: AppSpacing.sm,
          left: AppSpacing.page,
          right: AppSpacing.page,
          child: Column(
            children: [
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                  boxShadow: const [
                    BoxShadow(
                      color: AppColors.shadow,
                      blurRadius: 16,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Şube ara',
                    fillColor: AppColors.surface,
                    prefixIcon: const Icon(
                      Icons.search,
                      color: AppColors.textSecondary,
                    ),
                    suffixIcon: query.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(
                              Icons.close,
                              size: 18,
                              color: AppColors.textSecondary,
                            ),
                            onPressed: () => setState(() {
                              _query = '';
                              _searchController.clear();
                            }),
                          ),
                  ),
                  onChanged: (value) => setState(() => _query = value),
                ),
              ),
              if (results.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    boxShadow: const [
                      BoxShadow(
                        color: AppColors.shadow,
                        blurRadius: 16,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      for (final branch in results)
                        ListTile(
                          dense: true,
                          leading: const Icon(
                            Icons.place_outlined,
                            color: AppColors.primary,
                          ),
                          title: Text(branch.name, style: AppTypography.body),
                          subtitle: Text(
                            branch.city,
                            style: AppTypography.bodySecondary.copyWith(
                              fontSize: 12,
                            ),
                          ),
                          onTap: () => _focusBranch(branch),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Haritadaki şube pini: beyaz halkalı marka logosu + sivri uç.
class _BranchPin extends StatelessWidget {
  const _BranchPin({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(2.5),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.primary,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 6,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: const BrandLogo(size: 38),
          ),
          // Sivri uç
          CustomPaint(size: const Size(14, 9), painter: _PinTipPainter()),
        ],
      ),
    );
  }
}

class _PinTipPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = AppColors.primary);
  }

  @override
  bool shouldRepaint(_PinTipPainter oldDelegate) => false;
}

/// Pin alt kartı: ad + mesafe, açık/kapalı rozeti, detay ve sipariş butonları.
class _BranchSheet extends StatelessWidget {
  const _BranchSheet({
    required this.branch,
    required this.onDetail,
    required this.onOrder,
  });

  final Branch branch;
  final VoidCallback onDetail;
  final VoidCallback onOrder;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.page),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(
                          branch.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.title.copyWith(fontSize: 19),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        branch.distanceLabel,
                        style: AppTypography.bodySecondary,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => openDirections(branch),
                  child: Column(
                    children: [
                      const Icon(
                        Icons.directions,
                        size: 26,
                        color: AppColors.primary,
                      ),
                      Text(
                        'Yol Tarifi',
                        style: AppTypography.badge.copyWith(fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: branch.isOpen
                        ? AppColors.successSoft
                        : AppColors.dangerSoft,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.schedule,
                        size: 15,
                        color: branch.isOpen
                            ? AppColors.success
                            : AppColors.danger,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        branch.isOpen ? 'Açık' : 'Kapalı',
                        style: AppTypography.badge.copyWith(
                          color: branch.isOpen
                              ? AppColors.success
                              : AppColors.danger,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Text(branch.hours, style: AppTypography.body),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onDetail,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      foregroundColor: AppColors.textPrimary,
                      side: BorderSide(
                        color: AppColors.textSecondary.withValues(alpha: 0.35),
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      textStyle: AppTypography.body,
                    ),
                    child: const Text('Mağaza Detay'),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: FilledButton(
                    onPressed: onOrder,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      textStyle: AppTypography.body,
                    ),
                    child: const Text('Sipariş Ver'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
