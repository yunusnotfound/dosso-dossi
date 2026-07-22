import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../routing/app_router.dart';
import '../application/campaign_providers.dart';

/// Kampanyalar sekmesi: öne çıkan "Kahve İçtikçe" kartı + diğer kampanyalar.
class CampaignsScreen extends ConsumerWidget {
  const CampaignsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final campaigns = ref.watch(campaignsProvider);

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.page),
          children: [
            Text('Kampanyalar', style: AppTypography.displayLarge),
            const SizedBox(height: AppSpacing.lg),
            const _HeroCampaignCard(),
            const SizedBox(height: AppSpacing.lg),
            campaigns.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(AppSpacing.xxl),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Text('Kampanyalar yüklenemedi',
                  style: AppTypography.bodySecondary),
              data: (list) => Column(
                children: [
                  for (final campaign in list)
                    if (campaign.id == 'yukle-kazan')
                      _YukleKazanCard(description: campaign.description),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Pankart kampanyasının liste kartı — dokununca interaktif sayfa açılır.
class _HeroCampaignCard extends StatelessWidget {
  const _HeroCampaignCard();

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push(Routes.campaignKahve),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.xl),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF301D11), Color(0xFF20140C)],
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'KAHVE İÇTİKÇE',
              style: AppTypography.headline.copyWith(
                color: const Color(0xFFFFF9F2),
                letterSpacing: 1.2,
              ),
            ),
            Text(
              'Kahve Kazan',
              style: GoogleFonts.dancingScript(
                color: const Color(0xFFE8BE68),
                fontSize: 30,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text.rich(
              TextSpan(
                text: '5 KAHVE ',
                style: AppTypography.title
                    .copyWith(color: const Color(0xFFF1832A)),
                children: [
                  TextSpan(
                    text: 'SİZDEN',
                    style: AppTypography.title
                        .copyWith(color: const Color(0xFFFFF9F2)),
                  ),
                  TextSpan(
                    text: ' · 1 KAHVE ',
                    style: AppTypography.title
                        .copyWith(color: const Color(0xFFE8BE68)),
                  ),
                  TextSpan(
                    text: 'BİZDEN',
                    style: AppTypography.title
                        .copyWith(color: const Color(0xFFFFF9F2)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0xFFE86A10), Color(0xFFC55408)],
                    ),
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    'Kampanyayı Keşfet →',
                    style: AppTypography.badge.copyWith(color: Colors.white),
                  ),
                ),
                const Spacer(),
                const Text('☕', style: TextStyle(fontSize: 36)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _YukleKazanCard extends StatelessWidget {
  const _YukleKazanCard({required this.description});

  final String description;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showDetail(context),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.xl),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.coffeeDark, Color(0xFF4A3628)],
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md, vertical: AppSpacing.xs),
                    decoration: BoxDecoration(
                      color: AppColors.gold,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(
                      '+${AppConfig.topUpBonusDrinks} ☕',
                      style: AppTypography.badge
                          .copyWith(color: AppColors.onGold),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'Yükle Kazan',
                    style: AppTypography.title
                        .copyWith(color: AppColors.textOnDark),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    description,
                    style: AppTypography.bodySecondary
                        .copyWith(color: AppColors.textOnDarkMuted),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textOnDarkMuted),
          ],
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.page),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Yükle Kazan 🎁', style: AppTypography.headline),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Tek seferde ${AppConfig.topUpBonusThreshold.toStringAsFixed(0)} ₺ '
                've üzeri bakiye yüklediğinde ${AppConfig.topUpBonusDrinks} ikram '
                'kahve anında hesabına tanımlanır. İkramlarını dilediğin '
                'içecekte kullanabilirsin.',
                style: AppTypography.bodySecondary,
              ),
              const SizedBox(height: AppSpacing.xl),
              FilledButton(
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  context.go(Routes.scanPay);
                },
                child: const Text('Hemen Bakiye Yükle'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
