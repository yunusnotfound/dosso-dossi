import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../application/public_config.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../routing/app_router.dart';
import '../../domain/campaign.dart';
import 'coffee_rewards_preview.dart';
import 'load_rewards_preview.dart';

class CampaignDiscoveryCard extends ConsumerWidget {
  const CampaignDiscoveryCard({super.key, required this.campaign});
  final Campaign campaign;

  String? get _route => switch (campaign.id) {
    'kahve-ictikce' => Routes.campaignKahve,
    'yukle-kazan' => Routes.campaignYukleKazan,
    _ => null,
  };

  void _open(BuildContext context) {
    if (_route case final route?) {
      context.push(route);
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      backgroundColor: AppColors.campaignBackground,
      builder: (context) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(campaign.title, style: AppTypography.headline),
              const SizedBox(height: AppSpacing.lg),
              Text(campaign.description, style: AppTypography.body),
              const SizedBox(height: AppSpacing.lg),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rules = ref.watch(campaignRulesProvider);
    return Semantics(
      button: true,
      label: '${campaign.title} kampanyasını keşfet',
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: const [
            BoxShadow(
              color: AppColors.shadow,
              blurRadius: 20,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Material(
          color: AppColors.campaignBackground,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => _open(context),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                switch (campaign.id) {
                  'kahve-ictikce' => const CoffeeRewardsPreview(
                    showProgress: true,
                  ),
                  'yukle-kazan' => const LoadRewardsPreview(),
                  _ => _CampaignCopy(campaign: campaign),
                },
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              campaign.id == 'yukle-kazan'
                                  ? (rules.topupFirstOnly
                                        ? 'İlk yüklemene özel'
                                        : 'Yüklemene özel')
                                  : campaign.id == 'kahve-ictikce'
                                  ? 'Kahve keyfin hediyeye dönüşsün'
                                  : campaign.title,
                              style: AppTypography.body,
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              'Kampanyayı keşfet',
                              style: AppTypography.bodySecondary.copyWith(
                                color: AppColors.coffeeDark,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      const CircleAvatar(
                        radius: 22,
                        backgroundColor: AppColors.primary,
                        child: Icon(
                          Icons.arrow_forward_rounded,
                          color: AppColors.coffeeDark,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CampaignCopy extends StatelessWidget {
  const _CampaignCopy({required this.campaign});
  final Campaign campaign;

  @override
  Widget build(BuildContext context) {
    final dark = campaign.style == CampaignStyle.dark;
    final foreground = dark ? AppColors.textOnDark : AppColors.coffeeDark;
    return Container(
      color: dark ? AppColors.coffeeDark : AppColors.surfaceTint,
      padding: const EdgeInsets.all(AppSpacing.xxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (campaign.badge.isNotEmpty) ...[
            Chip(
              label: Text(campaign.badge, style: AppTypography.badge),
              avatar: const Icon(Icons.auto_awesome_outlined, size: 16),
              backgroundColor: AppColors.gold,
              side: BorderSide.none,
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          Text(
            campaign.title,
            style: AppTypography.headline.copyWith(color: foreground),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            campaign.description,
            style: AppTypography.body.copyWith(color: foreground),
          ),
        ],
      ),
    );
  }
}
