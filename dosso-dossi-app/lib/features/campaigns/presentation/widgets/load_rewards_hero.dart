import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../application/public_config.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';

/// Referansın krem zeminli, marka bardağıyla tamamlanan giriş bölümü.
class LoadRewardsHero extends ConsumerWidget {
  const LoadRewardsHero({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rules = ref.watch(campaignRulesProvider);
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              right: -AppSpacing.page,
              top: 14,
              bottom: 0,
              width: width * 0.61,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    colors: [
                      AppColors.surfaceTint,
                      AppColors.surfaceTint.withValues(alpha: 0),
                    ],
                  ),
                ),
                child: Image.asset(
                  'assets/images/yukle_kazan_cup.png',
                  fit: BoxFit.contain,
                  alignment: Alignment.bottomCenter,
                  excludeFromSemantics: true,
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.only(right: width * 0.47),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.sm,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.surfaceSunken),
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.account_balance_wallet_outlined,
                            color: AppColors.primary,
                            size: 15,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Text(
                            'DOSSO CÜZDAN',
                            style: AppTypography.badge.copyWith(
                              color: AppColors.primary,
                              letterSpacing: 1,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'Yükle\nKazan',
                    style: AppTypography.displayLarge.copyWith(
                      color: AppColors.primary,
                      fontSize: 38,
                      height: 1.05,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    rules.topupFirstOnly
                        ? 'İlk yüklemene özel kahve hediyeleri hesabına gelsin.'
                        : 'Yüklemene özel kahve hediyeleri hesabına gelsin.',
                    style: AppTypography.body.copyWith(height: 1.35),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
