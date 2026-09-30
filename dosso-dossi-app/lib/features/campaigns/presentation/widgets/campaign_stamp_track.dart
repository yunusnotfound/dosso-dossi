import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../rewards/domain/loyalty_status.dart';
import '../../../../core/widgets/coffee_bean_icon.dart';
import '../../../../core/widgets/mini_brand_cup.dart';

class CampaignStampTrack extends StatelessWidget {
  const CampaignStampTrack({super.key, required this.status});

  final LoyaltyStatus status;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cellWidth = constraints.maxWidth / status.target;
        final diameter = math.min(44.0, cellWidth - 6);

        return Column(
          children: [
            Stack(
              children: [
                Positioned(
                  left: cellWidth / 2,
                  right: cellWidth / 2,
                  top: diameter / 2,
                  child: const SizedBox(
                    height: 1,
                    child: ColoredBox(color: AppColors.divider),
                  ),
                ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: List.generate(status.target, (index) {
                    final isReward = index == status.target - 1;
                    final earned = index < status.stamps;
                    return Expanded(
                      child: Column(
                        children: [
                          Container(
                            width: diameter,
                            height: diameter,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: earned || isReward
                                  ? AppColors.surfaceTint
                                  : AppColors.surface,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: earned || isReward
                                    ? AppColors.primary.withValues(alpha: 0.5)
                                    : AppColors.divider,
                                width: 1.5,
                              ),
                            ),
                            child: isReward
                                ? MiniBrandCup(height: diameter * 0.60)
                                : CoffeeBeanIcon(
                                    size: diameter * 0.53,
                                    color: earned
                                        ? AppColors.primary
                                        : AppColors.surfaceSunken,
                                  ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            '${index + 1}${isReward ? '.' : ''}',
                            style: AppTypography.badge.copyWith(
                              color: isReward
                                  ? AppColors.primary
                                  : AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ),
              ],
            ),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                'ÜCRETSİZ',
                style: AppTypography.badge.copyWith(
                  color: AppColors.primary,
                  fontSize: 10,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
