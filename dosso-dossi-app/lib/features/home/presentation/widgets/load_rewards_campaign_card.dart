import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/story_theme.dart';
import '../../../../routing/app_router.dart';
import 'approved_campaign_poster.dart';

/// Onaylanan Yükle Kazan afişinin Sana Özel bölümündeki küçük önizlemesi.
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
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StoryTheme.posterRadius),
          side: const BorderSide(color: StoryTheme.posterBorder),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push(Routes.campaignYukleKazan),
          child: SizedBox(
            width: width,
            height: height,
            child: const ApprovedCampaignPoster(
              asset: ApprovedCampaignAssets.topup,
            ),
          ),
        ),
      ),
    );
  }
}
