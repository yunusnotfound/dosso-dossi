import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../routing/app_router.dart';

/// Uygulama tanıtımı — girişten önceki karşılama ekranı.
class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.coffeeDark,
      body: SafeArea(
        // Küçük ekranlarda taşmayı önlemek için kaydırılabilir;
        // büyük ekranlarda Spacer'lar sayfayı normal doldurur.
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: IntrinsicHeight(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.page),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Spacer(),
                      const Center(child: BrandLogo(size: 148)),
                      const SizedBox(height: AppSpacing.xxl),
                      Text(
                        'Dosso Dossi',
                        textAlign: TextAlign.center,
                        style: AppTypography.displayLarge.copyWith(
                          color: AppColors.textOnDark,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Kahveni uygulamayla öde,\ndamga kazan, ikramını kap.',
                        textAlign: TextAlign.center,
                        style: AppTypography.bodySecondary.copyWith(
                          color: AppColors.textOnDarkMuted,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xxxl),
                      const _Feature(
                        icon: Icons.qr_code_scanner,
                        text: 'Kasada QR okut, saniyeler içinde öde',
                      ),
                      _Feature(
                        icon: Icons.local_cafe,
                        text:
                            'Her kahve 1 damga · ${AppConfig.stampsPerReward} damga = 1 ikram',
                      ),
                      const _Feature(
                        icon: Icons.card_giftcard,
                        text: 'Arkadaşına kahve hediye et',
                      ),
                      const Spacer(),
                      FilledButton(
                        onPressed: () => context.go(Routes.login),
                        child: const Text('Telefonla Devam Et'),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
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

class _Feature extends StatelessWidget {
  const _Feature({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Icon(icon, size: 22, color: AppColors.gold),
          ),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Text(
              text,
              style: AppTypography.body.copyWith(color: AppColors.textOnDark),
            ),
          ),
        ],
      ),
    );
  }
}
