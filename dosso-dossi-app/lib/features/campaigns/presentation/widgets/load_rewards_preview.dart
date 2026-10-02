import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/brand_logo.dart';
import 'load_rewards_hero.dart';
import 'load_rewards_offer.dart';

/// Ana sayfa ve kampanya listesinde kullanılan ortak Yükle Kazan görseli.
class LoadRewardsPreview extends StatelessWidget {
  const LoadRewardsPreview({super.key});

  @override
  Widget build(BuildContext context) {
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
