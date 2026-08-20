import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../routing/app_router.dart';
import '../application/campaign_providers.dart';
import '../domain/campaign.dart';

/// Kampanyanın afiş görseli ve dokununca açılacak sayfası.
/// Ana sayfadaki "Sana Özel" şeridiyle aynı görseller kullanılır.
typedef _Poster = ({String asset, String route});

const _posters = <String, _Poster>{
  'kahve-ictikce': (
    asset: 'assets/images/kahve_ictikce_afis.jpg',
    route: Routes.campaignKahve,
  ),
  'yukle-kazan': (
    asset: 'assets/images/yukle_kazan_afis.jpg',
    route: Routes.campaignYukleKazan,
  ),
};

/// Kampanyalar sayfası: her kampanya kendi afişiyle listelenir.
/// Ana sayfadaki "Tümü" bağlantısından üste açılır.
class CampaignsScreen extends ConsumerWidget {
  const CampaignsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final campaigns = ref.watch(campaignsProvider);

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.page),
          children: [
            Row(
              children: [
                BackButton(onPressed: () => context.pop()),
                const SizedBox(width: AppSpacing.xs),
                Text('Kampanyalar', style: AppTypography.displayLarge),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            campaigns.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(AppSpacing.xxl),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Text('Kampanyalar yüklenemedi',
                  style: AppTypography.bodySecondary),
              data: (list) => Column(
                children: [
                  for (final campaign in list) ...[
                    if (_posters[campaign.id] case final poster?)
                      _PosterCard(poster: poster, title: campaign.title)
                    else
                      _TextCampaignCard(campaign: campaign),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Kampanya afişi: tam genişlikte, üzerine yazı basılmadan.
/// Afişler 4:5 dikey olduğu için oran sabitlenir, görsel kırpılmaz.
class _PosterCard extends StatelessWidget {
  const _PosterCard({required this.poster, required this.title});

  final _Poster poster;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '$title kampanyası',
      child: GestureDetector(
        onTap: () => context.push(poster.route),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          child: AspectRatio(
            aspectRatio: 4 / 5,
            child: Image.asset(poster.asset, fit: BoxFit.cover),
          ),
        ),
      ),
    );
  }
}

/// Afişi olmayan kampanyalar için sade kart.
class _TextCampaignCard extends StatelessWidget {
  const _TextCampaignCard({required this.campaign});

  final Campaign campaign;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.coffeeDark, Color(0xFF4A3628)],
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
          const SizedBox(height: AppSpacing.md),
          Text(
            campaign.title,
            style: AppTypography.title.copyWith(color: AppColors.textOnDark),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            campaign.description,
            style: AppTypography.bodySecondary
                .copyWith(color: AppColors.textOnDarkMuted),
          ),
        ],
      ),
    );
  }
}
