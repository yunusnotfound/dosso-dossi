import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/brand_logo.dart';

/// A portrait canvas for stories and phone-shaped home posters. The existing
/// artwork and campaign copy remain complete, even in a short viewport.
class CampaignPortraitPoster extends StatelessWidget {
  const CampaignPortraitPoster({
    super.key,
    required this.kicker,
    required this.title,
    required this.description,
    required this.footer,
  });

  final String kicker, title, description;
  final Widget footer;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: AppColors.campaignBackground,
    child: LayoutBuilder(
      builder: (context, constraints) {
        final scale = MediaQuery.textScalerOf(context).scale(1);
        final height = constraints.hasBoundedHeight
            ? constraints.maxHeight / constraints.maxWidth * 400
            : 820.0;
        return FittedBox(
          fit: BoxFit.contain,
          child: SizedBox(
            width: 400,
            height: math.max(height, 640 * scale),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: BrandLogo(size: 70)),
                  const SizedBox(height: 14),
                  Center(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.surfaceSunken),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 10,
                        ),
                        child: Text(
                          kicker,
                          textAlign: TextAlign.center,
                          style: AppTypography.badge.copyWith(
                            color: AppColors.primary,
                            fontSize: 12,
                            letterSpacing: .8,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      title,
                      style: AppTypography.displayLarge.copyWith(
                        fontSize: 46,
                        height: 1.06,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          colors: [
                            AppColors.surfaceTint,
                            AppColors.surfaceTint.withValues(alpha: 0),
                          ],
                        ),
                      ),
                      child: Image.asset(
                        'assets/images/yukle_kazan_cup.png',
                        fit: BoxFit.contain,
                        excludeFromSemantics: true,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    description,
                    textAlign: TextAlign.center,
                    style: AppTypography.body.copyWith(
                      color: AppColors.coffeeDark,
                      fontSize: 16,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 14),
                  footer,
                ],
              ),
            ),
          ),
        );
      },
    ),
  );
}
