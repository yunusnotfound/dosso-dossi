import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../routing/app_router.dart';

/// Logolu onboarding hediye kutusuyla ortak Yükle-Kazan kısayolu.
class LoadRewardsBanner extends StatelessWidget {
  const LoadRewardsBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Kahveni yükle, ödülleri topla! Sürpriz ödüller seni bekliyor.',
      hint: 'Yükle-Kazan kampanyasını aç',
      child: Material(
        color: AppColors.campaignBackground,
        borderRadius: BorderRadius.circular(AppRadius.md),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push(Routes.campaignYukleKazan),
          child: Ink(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.campaignBackground, AppColors.surfaceTint],
              ),
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final giftWidth = (constraints.maxWidth * 0.24).clamp(
                  64.0,
                  112.0,
                );
                // Keep the familiar compact banner at normal text sizes. The
                // row can grow vertically with accessibility text settings.
                return ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxWidth / 4,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.sm,
                    ),
                    child: ExcludeSemantics(
                      child: Row(
                        children: [
                          Expanded(
                            flex: 6,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Kahveni yükle,',
                                  style: AppTypography.bodySecondary.copyWith(
                                    fontSize: 10.5,
                                    height: 1.25,
                                    color: AppColors.coffeeDark,
                                  ),
                                ),
                                Text(
                                  'ödülleri',
                                  style: AppTypography.displayLarge.copyWith(
                                    fontSize: 20,
                                    color: AppColors.coffeeDark,
                                  ),
                                ),
                                Text(
                                  'topla!',
                                  style: AppTypography.displayLarge.copyWith(
                                    fontSize: 20,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Image.asset(
                            'assets/images/onboarding_hediye_kutusu.png',
                            width: giftWidth,
                            height: giftWidth,
                            fit: BoxFit.contain,
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Expanded(
                            flex: 4,
                            child: Text(
                              'Sürpriz ödüller seni bekliyor.',
                              style: AppTypography.body.copyWith(
                                fontSize: 11,
                                height: 1.4,
                                color: AppColors.coffeeDark,
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          const Icon(
                            Icons.chevron_right_rounded,
                            size: 20,
                            color: AppColors.primary,
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
