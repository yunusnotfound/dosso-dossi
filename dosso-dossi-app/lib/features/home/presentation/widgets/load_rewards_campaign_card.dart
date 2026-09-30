import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/brand_logo.dart';
import '../../../../routing/app_router.dart';
import '../../../campaigns/presentation/widgets/load_rewards_hero.dart';
import '../../../campaigns/presentation/widgets/load_rewards_offer.dart';

/// Yeni Yükle Kazan ekranının Sana Özel bölümündeki küçük önizlemesi.
/// Aynı bileşenler kullanıldığı için bardak, başlık ve teklif birlikte değişir.
class LoadRewardsCampaignCard extends StatelessWidget {
  const LoadRewardsCampaignCard({
    super.key,
    required this.width,
    required this.height,
  });

  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Yükle Kazan kampanyası',
      hint: 'Yeni Yükle Kazan ekranını aç',
      child: Material(
        color: AppColors.campaignBackground,
        borderRadius: BorderRadius.circular(AppRadius.md),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push(Routes.campaignYukleKazan),
          child: SizedBox(
            width: width,
            height: height,
            child: ExcludeSemantics(
              child: FittedBox(
                fit: BoxFit.contain,
                child: SizedBox(
                  width: 360,
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        BrandLogo(size: 64),
                        SizedBox(height: AppSpacing.sm),
                        LoadRewardsHero(),
                        SizedBox(height: AppSpacing.md),
                        LoadRewardsOffer(),
                      ],
                    ),
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
