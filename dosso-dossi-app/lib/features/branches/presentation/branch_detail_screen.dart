import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/coffee_bean_icon.dart';
import '../../../routing/app_router.dart';
import '../../order/application/order_providers.dart';
import '../application/branch_providers.dart';
import '../domain/branch.dart';
import 'branch_directions.dart';

/// Mağaza detayı: adres, yol tarifi, çalışma saatleri ve şube özellikleri.
class BranchDetailScreen extends ConsumerWidget {
  const BranchDetailScreen({super.key, required this.branchId});

  final String branchId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branches = ref.watch(branchesProvider);
    final active = ref.watch(activeBranchProvider).value;

    return Scaffold(
      appBar: AppBar(title: const Text('Mağaza Detay'), centerTitle: true),
      body: branches.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text('Şube yüklenemedi', style: AppTypography.bodySecondary),
        ),
        data: (list) {
          Branch? branch;
          for (final b in list) {
            if (b.id == branchId) branch = b;
          }
          if (branch == null) {
            return Center(
              child: Text(
                'Şube bulunamadı',
                style: AppTypography.bodySecondary,
              ),
            );
          }
          return _BranchDetailBody(
            branch: branch,
            isActive: branch.id == active?.id,
          );
        },
      ),
    );
  }
}

class _BranchDetailBody extends ConsumerWidget {
  const _BranchDetailBody({required this.branch, required this.isActive});

  final Branch branch;
  final bool isActive;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = DateTime.now().weekday; // 1 = Pazartesi
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.page),
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.xl),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Ad + mesafe + yol tarifi
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Flexible(
                          child: Text(
                            branch.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.title.copyWith(fontSize: 19),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Text(
                            branch.distanceLabel,
                            style: AppTypography.bodySecondary,
                          ),
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
                          size: 28,
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
              const SizedBox(height: AppSpacing.sm),
              Text(branch.address, style: AppTypography.bodySecondary),
              if (branch.phone.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => launchUrl(
                    Uri.parse(
                      'tel:${branch.phone.replaceAll(RegExp(r'[^0-9+]'), '')}',
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.phone,
                        size: 16,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        branch.phone,
                        style: AppTypography.body.copyWith(
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const Divider(height: AppSpacing.xxxl),
              Text('Çalışma Saatleri', style: AppTypography.title),
              const SizedBox(height: AppSpacing.md),
              // Bugün en üstte, kalan günler sırayla.
              for (var i = 0; i < 7; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        i == 0 ? 'Bugün' : weekdayName((today - 1 + i) % 7 + 1),
                        style: i == 0
                            ? AppTypography.body
                            : AppTypography.bodySecondary,
                      ),
                      Text(
                        branch.hours,
                        style: i == 0
                            ? AppTypography.body
                            : AppTypography.bodySecondary,
                      ),
                    ],
                  ),
                ),
              const Divider(height: AppSpacing.xxxl),
              Text('Özellikler', style: AppTypography.title),
              const SizedBox(height: AppSpacing.lg),
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _Feature(icon: Icons.wifi, label: 'Wi-Fi'),
                  _Feature(icon: Icons.storefront, label: 'Gel-Al'),
                  _Feature(label: 'Damga Kazan'),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: isActive
                    ? null
                    : () {
                        ref
                            .read(selectedBranchProvider.notifier)
                            .select(branch);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              'Sipariş şuben ${branch.name} olarak ayarlandı',
                            ),
                          ),
                        );
                      },
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  foregroundColor: AppColors.primary,
                  side: BorderSide(
                    color: isActive ? AppColors.divider : AppColors.primary,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  textStyle: AppTypography.body,
                ),
                child: Text(isActive ? 'Sipariş Şuben' : 'Şubeyi Seç'),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: FilledButton(
                onPressed: () {
                  ref.read(selectedBranchProvider.notifier).select(branch);
                  context.go(Routes.order);
                },
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  textStyle: AppTypography.body,
                ),
                child: const Text('Sipariş Ver'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Özellik rozeti: ikon + etiket. İkon verilmezse kahve çekirdeği çizilir.
class _Feature extends StatelessWidget {
  const _Feature({this.icon, required this.label});

  final IconData? icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.surfaceTint,
          ),
          child: icon != null
              ? Icon(icon, size: 20, color: AppColors.primary)
              : const CoffeeBeanIcon(size: 20, color: AppColors.primary),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(label, style: AppTypography.body.copyWith(fontSize: 13)),
      ],
    );
  }
}
