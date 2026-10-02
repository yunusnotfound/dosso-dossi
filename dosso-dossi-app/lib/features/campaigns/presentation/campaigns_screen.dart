import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/scrollable_page_scaffold.dart';
import '../application/campaign_providers.dart';
import 'widgets/campaign_discovery_card.dart';

/// API sırasını koruyan, marka renkleriyle hazırlanmış kampanya vitrini.
class CampaignsScreen extends ConsumerWidget {
  const CampaignsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final campaigns = ref.watch(campaignsProvider);
    return ScrollablePageScaffold(
      title: 'Kampanyalar',
      children: [
        const _CampaignIntro(),
        const SizedBox(height: AppSpacing.xxxl),
        campaigns.when(
          skipError: true,
          skipLoadingOnReload: true,
          loading: () => const Padding(
            padding: EdgeInsets.all(AppSpacing.xxxl),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => _CampaignMessage(
            title: 'Kampanyalara ulaşamadık',
            message: 'Bağlantını kontrol edip yeniden deneyebilirsin.',
            onRetry: () => ref.invalidate(campaignsProvider),
          ),
          data: (list) => list.isEmpty
              ? const _CampaignMessage(
                  title: 'Yeni fırsatlar yolda',
                  message:
                      'Kahve keyfine eşlik edecek kampanyalar burada olacak.',
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'KEŞFET & KAZAN',
                            style: AppTypography.sectionLabel.copyWith(
                              color: AppColors.coffeeDark,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: AppSpacing.xs,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(AppRadius.pill),
                          ),
                          child: Text(
                            '${list.length} kampanya',
                            style: AppTypography.badge.copyWith(fontSize: 11),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    for (final campaign in list) ...[
                      CampaignDiscoveryCard(campaign: campaign),
                      const SizedBox(height: AppSpacing.xxl),
                    ],
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.favorite_outline_rounded,
                          size: 16,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Flexible(
                          child: Text(
                            'Kahvenin yanında güzel şeyler var.',
                            style: AppTypography.bodySecondary.copyWith(
                              fontSize: 12,
                              color: AppColors.coffeeDark,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _CampaignIntro extends StatelessWidget {
  const _CampaignIntro();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Kahve keyfin\nkatlansın.',
                style: AppTypography.displayLarge.copyWith(
                  fontSize: 34,
                  color: AppColors.coffeeDark,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Fırsatları keşfet,\nkahvene hediyeler ekle.',
                style: AppTypography.bodySecondary.copyWith(
                  color: AppColors.coffeeDark,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Image.asset(
          'assets/images/onboarding_hediye_kutusu.png',
          width: 112,
          height: 132,
          fit: BoxFit.contain,
          excludeFromSemantics: true,
        ),
      ],
    );
  }
}

class _CampaignMessage extends StatelessWidget {
  const _CampaignMessage({
    required this.title,
    required this.message,
    this.onRetry,
  });
  final String title;
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      decoration: BoxDecoration(
        color: AppColors.campaignBackground,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.local_offer_outlined,
            color: AppColors.primary,
            size: 32,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(title, style: AppTypography.title),
          const SizedBox(height: AppSpacing.sm),
          Text(
            message,
            style: AppTypography.bodySecondary.copyWith(
              color: AppColors.coffeeDark,
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: AppSpacing.lg),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Tekrar dene'),
            ),
          ],
        ],
      ),
    );
  }
}
