import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../application/public_config.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/coffee_bean_icon.dart';

class LoadRewardsOffer extends ConsumerWidget {
  const LoadRewardsOffer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rules = ref.watch(campaignRulesProvider);
    final amount = NumberFormat.decimalPattern(
      'tr_TR',
    ).format(rules.topupThreshold);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.surfaceTint,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -8,
            bottom: -18,
            child: CoffeeBeanIcon(
              size: 102,
              color: AppColors.primary.withValues(alpha: 0.06),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        rules.topupFirstOnly
                            ? 'İLK YÜKLEMEYE ÖZEL'
                            : 'YÜKLEMEYE ÖZEL',
                        style: AppTypography.badge.copyWith(
                          fontSize: 10,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          '$amount ₺',
                          style: AppTypography.numberLarge.copyWith(
                            fontSize: 29,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: AppSpacing.md),
                  child: CircleAvatar(
                    radius: 18,
                    backgroundColor: AppColors.surface,
                    child: Icon(
                      Icons.arrow_forward,
                      size: 20,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          '${rules.topupBonusDrinks} kahve',
                          style: AppTypography.title.copyWith(
                            fontSize: 25,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                      Text('hediye bizden!', style: AppTypography.body),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
