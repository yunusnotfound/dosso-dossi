import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/brand_logo.dart';
import 'load_rewards_hero.dart';
import 'load_rewards_offer.dart';
import 'campaign_portrait_poster.dart';
import '../../application/public_config.dart';

/// Ana sayfa ve kampanya listesinde kullanılan ortak Yükle Kazan görseli.
class LoadRewardsPreview extends ConsumerWidget {
  const LoadRewardsPreview({super.key, this.fillHeight = false});
  final bool fillHeight;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (fillHeight) {
      final firstOnly = ref.watch(campaignRulesProvider).topupFirstOnly;
      return CampaignPortraitPoster(
        kicker: 'DOSSO CÜZDAN',
        title: 'Yükle\nKazan',
        description: firstOnly
            ? 'İlk yüklemene özel kahve hediyeleri hesabına gelsin.'
            : 'Yüklemene özel kahve hediyeleri hesabına gelsin.',
        footer: const LoadRewardsOffer(),
      );
    }
    return const Padding(
      padding: EdgeInsets.all(AppSpacing.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BrandLogo(size: 64),
          SizedBox(height: AppSpacing.sm),
          LoadRewardsHero(),
          SizedBox(height: AppSpacing.md),
          LoadRewardsOffer(),
        ],
      ),
    );
  }
}
