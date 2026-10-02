import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../routing/app_router.dart';
import 'widgets/campaign_progress_card.dart';
import 'widgets/coffee_rewards_preview.dart';

/// Yeni kahve kampanyası afişi ve müşterinin canlı damga ilerlemesi.
class CampaignKahveScreen extends StatelessWidget {
  const CampaignKahveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.paddingOf(context);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: AppColors.campaignBackground,
        body: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.page,
            insets.top + AppSpacing.sm,
            AppSpacing.page,
            insets.bottom + AppSpacing.page,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Stack(
                children: [
                  const CoffeeRewardsPreview(),
                  Positioned(
                    top: AppSpacing.sm,
                    left: 0,
                    child: BackButton(
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.surface,
                      ),
                      onPressed: () => context.canPop()
                          ? context.pop()
                          : context.go(Routes.home),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              const CampaignProgressCard(),
            ],
          ),
        ),
      ),
    );
  }
}
