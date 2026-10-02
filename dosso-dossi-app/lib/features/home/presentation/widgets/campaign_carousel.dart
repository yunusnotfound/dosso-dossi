import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/story_theme.dart';
import '../../../../routing/app_router.dart';
import '../../../campaigns/application/campaign_providers.dart';
import '../../../campaigns/domain/campaign.dart';
import 'approved_campaign_poster.dart';
import 'load_rewards_campaign_card.dart';

/// Görsellerin kendi oranında, yuvarlak köşeli "Sana Özel" afişleri.
class CampaignCarousel extends ConsumerWidget {
  const CampaignCarousel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final campaigns = ref.watch(campaignsProvider);

    return LayoutBuilder(
      builder: (context, constraints) {
        final cardWidth = (constraints.maxWidth * 0.36).clamp(0.0, 180.0);
        final cardHeight = cardWidth / ApprovedCampaignPoster.aspectRatio;
        return campaigns.when(
          skipError: true,
          skipLoadingOnReload: true,
          loading: () => SizedBox(
            height: cardHeight,
            child: const Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => const SizedBox.shrink(),
          data: (items) => SizedBox(
            height: cardHeight,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
              itemBuilder: (context, index) {
                final campaign = items[index];
                // Onaylanan afiş, kartın tamamını doldurur.
                if (campaign.id == 'kahve-ictikce') {
                  return _CoffeeRewardsCard(
                    width: cardWidth,
                    height: cardHeight,
                  );
                }
                // Onaylanan Yükle Kazan afişi, mevcut ayrıntı sayfasını açar.
                if (campaign.id == 'yukle-kazan') {
                  return LoadRewardsCampaignCard(
                    width: cardWidth,
                    height: cardHeight,
                  );
                }
                return _CampaignCard(campaign: campaign, width: cardWidth);
              },
            ),
          ),
        );
      },
    );
  }
}

/// Onaylanan kahve afişini kırpmadan küçük karta sığdırır.
class _CoffeeRewardsCard extends StatelessWidget {
  const _CoffeeRewardsCard({required this.width, required this.height});
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Kahve İçtikçe Kahve Kazan kampanyası',
      child: Material(
        color: AppColors.campaignBackground,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StoryTheme.posterRadius),
          side: const BorderSide(color: StoryTheme.posterBorder),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push(Routes.campaignKahve),
          child: SizedBox(
            width: width,
            height: height,
            child: const ApprovedCampaignPoster(
              asset: ApprovedCampaignAssets.coffee,
            ),
          ),
        ),
      ),
    );
  }
}

class _CampaignCard extends StatelessWidget {
  const _CampaignCard({required this.campaign, required this.width});

  final Campaign campaign;
  final double width;

  @override
  Widget build(BuildContext context) {
    final isDark = campaign.style == CampaignStyle.dark;

    return GestureDetector(
      onTap: () => context.push(Routes.campaigns),
      child: Container(
        width: width,
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(StoryTheme.posterRadius),
          border: Border.all(color: StoryTheme.posterBorder),
          gradient: isDark
              ? const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.coffeeDark, Color(0xFF4A3628)],
                )
              : const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.primary, AppColors.primaryLight],
                ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.xs,
              ),
              decoration: BoxDecoration(
                color: AppColors.gold,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              child: Text(
                campaign.badge,
                style: AppTypography.badge.copyWith(color: AppColors.onGold),
              ),
            ),
            const Spacer(),
            Text(
              campaign.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.title.copyWith(color: Colors.white),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              campaign.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.bodySecondary.copyWith(
                color: Colors.white.withValues(alpha: 0.85),
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
