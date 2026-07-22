import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../routing/app_router.dart';
import '../../order/application/order_providers.dart';
import '../application/branch_providers.dart';
import '../domain/branch.dart';

/// Şubeler: il bazlı gruplu liste (resmi mağaza tablosu düzeninde).
class BranchListScreen extends ConsumerWidget {
  const BranchListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branches = ref.watch(branchesProvider);
    final active = ref.watch(activeBranchProvider).value;

    return Scaffold(
      appBar: AppBar(title: const Text('Şubeler')),
      body: branches.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child:
              Text('Şubeler yüklenemedi', style: AppTypography.bodySecondary),
        ),
        data: (list) {
          final cities = <String, List<Branch>>{};
          for (final branch in list) {
            cities.putIfAbsent(branch.city, () => []).add(branch);
          }
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.page),
            children: [
              for (final entry in cities.entries) ...[
                Text(entry.key.toUpperCase(),
                    style: AppTypography.sectionLabel),
                const SizedBox(height: AppSpacing.md),
                for (final branch in entry.value)
                  _BranchCard(
                    branch: branch,
                    isActive: branch.id == active?.id,
                    onSelect: () {
                      ref
                          .read(selectedBranchProvider.notifier)
                          .select(branch);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                              'Sipariş şuben ${branch.name} olarak ayarlandı'),
                        ),
                      );
                    },
                    onOrder: () => context.go(Routes.order),
                  ),
                const SizedBox(height: AppSpacing.lg),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _BranchCard extends StatelessWidget {
  const _BranchCard({
    required this.branch,
    required this.isActive,
    required this.onSelect,
    required this.onOrder,
  });

  final Branch branch;
  final bool isActive;
  final VoidCallback onSelect;
  final VoidCallback onOrder;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: isActive
            ? Border.all(color: AppColors.primary, width: 2)
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(branch.name, style: AppTypography.title)),
              if (isActive)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md, vertical: AppSpacing.xs),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceTint,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    'Sipariş şuben',
                    style: AppTypography.badge
                        .copyWith(fontSize: 12, color: AppColors.primary),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(branch.address, style: AppTypography.bodySecondary),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              const Icon(Icons.schedule,
                  size: 16, color: AppColors.textSecondary),
              const SizedBox(width: AppSpacing.xs),
              Text(branch.hours,
                  style: AppTypography.bodySecondary.copyWith(fontSize: 13)),
              if (branch.phone.isNotEmpty) ...[
                const SizedBox(width: AppSpacing.lg),
                const Icon(Icons.phone,
                    size: 16, color: AppColors.textSecondary),
                const SizedBox(width: AppSpacing.xs),
                Text(branch.phone,
                    style:
                        AppTypography.bodySecondary.copyWith(fontSize: 13)),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: isActive ? null : onSelect,
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(
                        color: isActive
                            ? AppColors.divider
                            : AppColors.primary),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                  ),
                  child: Text(
                    isActive ? 'Seçili' : 'Şubeyi Seç',
                    style: AppTypography.body.copyWith(
                      fontSize: 14,
                      color: isActive
                          ? AppColors.textSecondary
                          : AppColors.primary,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: FilledButton(
                  onPressed: onOrder,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(44),
                  ),
                  child: Text('Sipariş Ver',
                      style: AppTypography.body
                          .copyWith(fontSize: 14, color: Colors.white)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
