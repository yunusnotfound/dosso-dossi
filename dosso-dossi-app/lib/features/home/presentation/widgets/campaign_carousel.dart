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
              itemCount: items.length + 1,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
              itemBuilder: (context, index) {
                if (index == items.length) {
                  return _ApprovedCampaignCard(
                    width: cardWidth,
                    height: cardHeight,
                    asset: ApprovedCampaignAssets.thermos,
                    label: 'Termos koleksiyonunu keşfet',
                    route: Routes.shop,
                  );
                }
                final campaign = items[index];
                // Onaylanan afiş, kartın tamamını doldurur.
                if (campaign.id == 'kahve-ictikce') {
                  return _ApprovedCampaignCard(
                    width: cardWidth,
                    height: cardHeight,
                    asset: ApprovedCampaignAssets.coffee,
                    label: 'Kahve İçtikçe Kahve Kazan kampanyası',
                    route: Routes.campaignKahve,
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

/// Onaylanan afişleri kırpmadan, aynı ölçüde küçük karta sığdırır.
class _ApprovedCampaignCard extends StatelessWidget {
  const _ApprovedCampaignCard({
    required this.width,
    required this.height,
    required this.asset,
    required this.label,
    required this.route,
  });
  final double width;
  final double height;
  final String asset;
  final String label;
  final String route;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: AppColors.campaignBackground,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StoryTheme.posterRadius),
          side: const BorderSide(color: StoryTheme.posterBorder),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push(route),
          child: SizedBox(
            width: width,
            height: height,
            child: ApprovedCampaignPoster(asset: asset),
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
