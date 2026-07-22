import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../routing/app_router.dart';
import '../../../campaigns/application/campaign_providers.dart';
import '../../../campaigns/domain/campaign.dart';

/// "Sana Özel" yatay kampanya kartları.
class CampaignCarousel extends ConsumerWidget {
  const CampaignCarousel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final campaigns = ref.watch(campaignsProvider);

    return campaigns.when(
      loading: () => const SizedBox(
        height: 180,
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => const SizedBox.shrink(),
      data: (items) => SizedBox(
        height: 180,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: items.length,
          separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
          itemBuilder: (context, index) {
            final campaign = items[index];
            // 5+1 kampanyası: afiş görseliyle aynı kart, afiş sayfasına gider.
            if (campaign.id == 'kahve-ictikce') {
              return const _KahveHeroCard();
            }
            return _CampaignCard(campaign: campaign);
          },
        ),
      ),
    );
  }
}

/// Kampanyalar sekmesindeki tanıtım kartının birebir aynısı (kompakt).
/// Dokununca "Kahve İçtikçe Kahve Kazan" afiş sayfası açılır.
class _KahveHeroCard extends StatelessWidget {
  const _KahveHeroCard();

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push(Routes.campaignKahve),
      child: Container(
        width: 280,
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.md),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF301D11), Color(0xFF20140C)],
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'KAHVE İÇTİKÇE',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.title.copyWith(
                color: const Color(0xFFFFF9F2),
                fontSize: 18,
                letterSpacing: 1.2,
              ),
            ),
            Text(
              'Kahve Kazan',
              style: GoogleFonts.dancingScript(
                color: const Color(0xFFE8BE68),
                fontSize: 22,
                fontWeight: FontWeight.w600,
                height: 1.1,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text.rich(
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              TextSpan(
                text: '5 KAHVE ',
                style: AppTypography.body.copyWith(
                    color: const Color(0xFFF1832A), fontSize: 14),
                children: [
                  TextSpan(
                    text: 'SİZDEN',
                    style: AppTypography.body.copyWith(
                        color: const Color(0xFFFFF9F2), fontSize: 14),
                  ),
                  TextSpan(
                    text: ' · 1 KAHVE ',
                    style: AppTypography.body.copyWith(
                        color: const Color(0xFFE8BE68), fontSize: 14),
                  ),
                  TextSpan(
                    text: 'BİZDEN',
                    style: AppTypography.body.copyWith(
                        color: const Color(0xFFFFF9F2), fontSize: 14),
                  ),
                ],
              ),
            ),
            const Spacer(),
            Row(
              children: [
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0xFFE86A10), Color(0xFFC55408)],
                      ),
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(
                      'Kampanyayı Keşfet →',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style:
                          AppTypography.badge.copyWith(color: Colors.white),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                const Text('☕', style: TextStyle(fontSize: 26)),
              ],
            ),
          ],
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
      onTap: () => context.go(Routes.campaigns),
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
