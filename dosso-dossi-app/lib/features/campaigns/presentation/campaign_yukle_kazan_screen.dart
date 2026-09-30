import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../../routing/app_router.dart';
import '../../auth/presentation/guest_gate.dart';
import 'widgets/campaign_progress_card.dart';
import 'widgets/campaign_wallet_card.dart';
import 'widgets/load_rewards_hero.dart';
import 'widgets/load_rewards_offer.dart';

/// Ana sayfadaki Yükle-Kazan kutusunun canlı cüzdan ve damga görünümü.
class CampaignYukleKazanScreen extends ConsumerWidget {
  const CampaignYukleKazanScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    void openWallet({required bool topUp}) {
      if (blockedForGuest(
        context,
        ref,
        action: topUp ? 'Bakiye yüklemek' : 'QR ile ödemek',
      )) {
        return;
      }
      context.go(topUp ? Routes.scanPayTopUp : Routes.scanPay);
    }

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: AppColors.campaignBackground,
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.page,
              AppSpacing.sm,
              AppSpacing.page,
              AppSpacing.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: 86,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      const BrandLogo(size: 82),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: BackButton(
                          style: IconButton.styleFrom(
                            backgroundColor: AppColors.surface,
                          ),
                          onPressed: () => context.canPop()
                              ? context.pop()
                              : context.go(Routes.home),
                        ),
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: IconButton(
                          tooltip: 'Bildirim tercihleri',
                          onPressed: () {
                            if (!blockedForGuest(
                              context,
                              ref,
                              action: 'Bildirimlerini yönetmek',
                            )) {
                              context.push(Routes.notificationPrefs);
                            }
                          },
                          icon: const Icon(Icons.notifications_outlined),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                const LoadRewardsHero(),
                const SizedBox(height: AppSpacing.md),
                const CampaignProgressCard(),
                const SizedBox(height: AppSpacing.md),
                CampaignWalletCard(
                  onTopUp: () => openWallet(topUp: true),
                  onScan: () => openWallet(topUp: false),
                ),
                const SizedBox(height: AppSpacing.md),
                const LoadRewardsOffer(),
                const SizedBox(height: AppSpacing.lg),
                FilledButton.icon(
                  onPressed: () => openWallet(topUp: true),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    shape: const StadiumBorder(),
                    minimumSize: const Size.fromHeight(52),
                  ),
                  icon: const Icon(Icons.account_balance_wallet_outlined),
                  label: const Text('Uygulamadan yükle'),
                ),
                TextButton(
                  onPressed: () => _showTerms(context),
                  child: Text(
                    'Kampanya koşulları',
                    style: AppTypography.bodySecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showTerms(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.campaignBackground,
      builder: (context) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Kampanya koşulları', style: AppTypography.headline),
              const SizedBox(height: AppSpacing.lg),
              Text(
                'Kampanya 31 Aralık 2026 tarihine kadar geçerlidir. '
                'İkram yalnızca hesabındaki ilk bakiye yüklemesinde ve '
                'bir kez verilir; ilk yükleme 1.000 ₺ altındaysa hak '
                'düşer, sonraki yüklemelerde ikram verilmez. Hediye '
                'kahveler yükleme sonrası uygulamana tanımlanır; 60 gün '
                'içinde kullanılmalıdır. Espresso bazlı sıcak içecekler '
                'için geçerlidir.',
                style: AppTypography.body,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
