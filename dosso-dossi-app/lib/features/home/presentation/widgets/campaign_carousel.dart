import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../routing/app_router.dart';
import '../../../campaigns/application/campaign_providers.dart';
import '../../../campaigns/domain/campaign.dart';
import '../../../campaigns/presentation/widgets/coffee_rewards_preview.dart';
import 'load_rewards_campaign_card.dart';

/// Afiş kartları 4:5 dikey oranda; carousel yüksekliği buna göre seçildi ki
/// afiş kırpılmadan bütün olarak görünsün.
const double _carouselHeight = 300;
const double _afisCardWidth = _carouselHeight * 0.8;

/// "Sana Özel" yatay kampanya kartları.
class CampaignCarousel extends ConsumerWidget {
  const CampaignCarousel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final campaigns = ref.watch(campaignsProvider);

    return campaigns.when(
      skipError: true,
      skipLoadingOnReload: true,
      loading: () => const SizedBox(
        height: _carouselHeight,
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => const SizedBox.shrink(),
      data: (items) => SizedBox(
        height: _carouselHeight,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: items.length,
          separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
          itemBuilder: (context, index) {
            final campaign = items[index];
            // Kampanya listesindeki yeni krem tasarımla aynı içerik.
            if (campaign.id == 'kahve-ictikce') {
              return const _CoffeeRewardsCard();
            }
            // Hediye kutusundan açılan yeni ekranın aynı görsel ve metinleri.
            if (campaign.id == 'yukle-kazan') {
              return const LoadRewardsCampaignCard(
                width: _afisCardWidth,
                height: _carouselHeight,
              );
            }
            return _CampaignCard(campaign: campaign);
          },
        ),
      ),
    );
  }
}

/// Yeni kahve kampanyası tasarımını kırpmadan küçük karta sığdırır.
class _CoffeeRewardsCard extends StatelessWidget {
  const _CoffeeRewardsCard();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Kahve İçtikçe Kahve Kazan kampanyası',
      child: Material(
        color: AppColors.campaignBackground,
        borderRadius: BorderRadius.circular(AppRadius.md),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push(Routes.campaignKahve),
          child: SizedBox(
            width: _afisCardWidth,
            height: _carouselHeight,
            child: const ExcludeSemantics(
              child: FittedBox(
                fit: BoxFit.contain,
                child: SizedBox(
                  width: 360,
                  child: CoffeeRewardsPreview(
                    showProgress: true,
                    compact: true,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CampaignCard extends StatelessWidget {
  const _CampaignCard({required this.campaign});

  final Campaign campaign;

  @override
  Widget build(BuildContext context) {
    final isDark = campaign.style == CampaignStyle.dark;

    return GestureDetector(
      onTap: () => context.push(Routes.campaigns),
      child: Container(
        width: 250,
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.md),
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
