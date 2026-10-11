import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../application/public_config.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/brand_logo.dart';
import '../../../../core/widgets/coffee_bean_icon.dart';
import 'campaign_progress_card.dart';
import 'campaign_portrait_poster.dart';

/// Yükle Kazan ile aynı krem zemin ve süslü bardak görselini kullanan vitrin.
class CoffeeRewardsPreview extends ConsumerWidget {
  const CoffeeRewardsPreview({
    super.key,
    this.showProgress = false,
    this.compact = false,
    this.fillHeight = false,
  });

  final bool showProgress;
  final bool compact;
  final bool fillHeight;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (fillHeight) {
      return CampaignPortraitPoster(
        kicker: 'KAHVE İÇTİKÇE KAHVE KAZAN',
        title: '${ref.watch(currentStampTargetProvider)} damga,\n1 ikram.',
        description: 'Sevdiğin kahve, bir sonraki hediyen.',
        footer: showProgress
            ? const CampaignProgressCard(interactive: false, compact: true)
            : DecoratedBox(
                decoration: BoxDecoration(
                  color: AppColors.surfaceTint,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    'Her kahveyle hediyene yaklaş',
                    textAlign: TextAlign.center,
                    style: AppTypography.badge.copyWith(
                      color: AppColors.coffeeDark,
                    ),
                  ),
                ),
              ),
      );
    }
    return ColoredBox(
      color: AppColors.campaignBackground,
      child: Padding(
        padding: EdgeInsets.all(compact ? AppSpacing.lg : AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Center(child: BrandLogo(size: 64)),
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.surfaceSunken),
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CoffeeBeanIcon(size: 17, color: AppColors.primary),
                  const SizedBox(width: AppSpacing.sm),
                  Flexible(
                    child: Text(
                      'KAHVE İÇTİKÇE KAHVE KAZAN',
                      style: AppTypography.badge.copyWith(
                        color: AppColors.primary,
                        fontSize: 11,
                        letterSpacing: 0.7,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  flex: 5,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${ref.watch(currentStampTargetProvider)} damga,',
                        style: AppTypography.displayLarge.copyWith(
                          fontSize: 34,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        '1 ikram.',
                        style: AppTypography.displayLarge.copyWith(
                          fontSize: 37,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        'Sevdiğin kahve,\nbir sonraki hediyen.',
                        style: AppTypography.body.copyWith(
                          color: AppColors.coffeeDark,
                          fontSize: 13,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  flex: 4,
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
                      height: compact ? 146 : null,
                      fit: BoxFit.contain,
                      excludeFromSemantics: true,
                    ),
                  ),
                ),
              ],
            ),
            if (!compact) ...[
              const SizedBox(height: AppSpacing.xl),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surfaceTint,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.redeem_outlined,
                      size: 16,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Flexible(
                      child: Text(
                        'Her kahveyle hediyene yaklaş',
                        style: AppTypography.badge.copyWith(
                          color: AppColors.coffeeDark,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (showProgress) ...[
              SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
              CampaignProgressCard(interactive: false, compact: compact),
            ],
          ],
        ),
      ),
    );
  }
}
