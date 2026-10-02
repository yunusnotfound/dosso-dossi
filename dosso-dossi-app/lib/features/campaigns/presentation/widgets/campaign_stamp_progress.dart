import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../rewards/domain/loyalty_status.dart';
import 'campaign_stamp_track.dart';

class CampaignProgressHeading extends StatelessWidget {
  const CampaignProgressHeading({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(
          Icons.star_outline_rounded,
          size: 21,
          color: AppColors.primary,
        ),
        const SizedBox(width: AppSpacing.sm),
        Flexible(
          child: Text(
            'KAHVE İLERLEMEN',
            style: AppTypography.sectionLabel.copyWith(
              color: AppColors.primary,
              fontSize: 11,
              letterSpacing: 0.8,
              height: 1.25,
            ),
          ),
        ),
      ],
    );
  }
}

class CampaignStampProgress extends StatelessWidget {
  const CampaignStampProgress({
    super.key,
    required this.status,
    this.compact = false,
  });

  final LoyaltyStatus status;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(child: CampaignProgressHeading()),
            const SizedBox(width: AppSpacing.sm),
            Semantics(
              label: '${status.target} kahveden ${status.stamps} tamamlandı',
              child: ExcludeSemantics(
                child: Text.rich(
                  TextSpan(
                    text: '${status.stamps}',
                    style: AppTypography.numberLarge.copyWith(fontSize: 32),
                    children: [
                      TextSpan(
                        text: ' / ${status.target}',
                        style: AppTypography.title.copyWith(
                          color: AppColors.primary,
                          fontSize: 19,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        SizedBox(height: compact ? AppSpacing.sm : AppSpacing.md),
        ExcludeSemantics(child: CampaignStampTrack(status: status)),
        if (!compact) ...[
          const SizedBox(height: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: AppColors.surfaceTint.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.card_giftcard_rounded,
                  size: 27,
                  color: AppColors.primary,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    '${status.target} kahvede 1 ikram kahve seni bekliyor!',
                    style: AppTypography.body.copyWith(
                      fontSize: 14,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
