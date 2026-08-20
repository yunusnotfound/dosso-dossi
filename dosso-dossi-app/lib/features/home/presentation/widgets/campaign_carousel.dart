import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../routing/app_router.dart';
import '../../../campaigns/application/campaign_providers.dart';
import '../../../campaigns/domain/campaign.dart';

/// Afiş kartları 4:5 dikey oranda; carousel yüksekliği buna göre seçildi ki
/// afiş kırpılmadan bütün olarak görünsün.
const double _carouselHeight = 230;
const double _afisCardWidth = _carouselHeight * 0.8;

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
        height: _carouselHeight,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: items.length,
          separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
          itemBuilder: (context, index) {
            final campaign = items[index];
            // 5+1 kampanyası: kartın kendisi afiş; dokununca kampanya
            // sayfası açılır.
            if (campaign.id == 'kahve-ictikce') {
              return const _AfisCard(
                assetPath: 'assets/images/kahve_ictikce_afis.jpg',
                route: Routes.campaignKahve,
                label: 'İçtikçe kazan kampanyası: 5 al, 1 hediye',
              );
            }
            // Yükle Kazan: kartın kendisi afişin ta kendisi — üzerine yazı
            // basılmıyor, afişte zaten var. Dokununca tam ekran açılır.
            if (campaign.id == 'yukle-kazan') {
              return const _AfisCard(
                assetPath: 'assets/images/yukle_kazan_afis.jpg',
                route: Routes.campaignYukleKazan,
                label: 'Yükle Kazan kampanyası: ilk yüklemene 5 kahve hediye',
              );
            }
            return _CampaignCard(campaign: campaign);
          },
        ),
      ),
    );
  }
}

/// Arka planı kampanya afişinin kendisi olan kart.
/// Üzerine hiçbir metin basılmaz; afişin kendi tipografisi görünür.
class _AfisCard extends StatelessWidget {
  const _AfisCard({
    required this.assetPath,
    required this.route,
    required this.label,
  });

  final String assetPath;
  final String route;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: () => context.push(route),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: SizedBox(
            width: _afisCardWidth,
            height: _carouselHeight,
            // Afiş 4:5, kart da 4:5 — cover kırpma yapmadan tam oturur.
            child: Image.asset(assetPath, fit: BoxFit.cover),
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
