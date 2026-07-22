import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../branches/application/branch_providers.dart';

/// En yakın şube satırı.
class BranchTile extends ConsumerWidget {
  const BranchTile({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branch = ref.watch(nearestBranchProvider);

    return branch.when(
      loading: () => const SizedBox(height: 72),
      error: (e, _) => const SizedBox.shrink(),
      data: (b) => Container(
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
              child: const Icon(Icons.location_on_outlined,
                  size: 22, color: AppColors.primary),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(b.name, style: AppTypography.body),
                  const SizedBox(height: 2),
                  Text.rich(
                    TextSpan(
                      text: '${b.distanceLabel} · ',
                      style: AppTypography.bodySecondary.copyWith(fontSize: 13),
                      children: [
                        TextSpan(
                          text: b.isOpen ? 'Açık' : 'Kapalı',
                          style: AppTypography.badge.copyWith(
                            fontSize: 13,
                            color: b.isOpen
                                ? AppColors.success
                                : AppColors.danger,
                          ),
                        ),
                        TextSpan(text: ' · ${b.hours}'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}
