import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/formatters.dart';
import '../../../auth/application/guest_mode.dart';
import '../../../wallet/application/wallet_providers.dart';

/// Live wallet summary for the Yükle Kazan campaign.
/// Authentication for the actions is handled by the containing screen.
class CampaignWalletCard extends ConsumerWidget {
  const CampaignWalletCard({
    super.key,
    required this.onTopUp,
    required this.onScan,
  });

  final VoidCallback onTopUp;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isGuest = ref.watch(guestModeProvider);
    // Guests do not have a wallet, so do not subscribe to its API provider.
    final wallet = isGuest ? null : ref.watch(walletProvider);
    final balance = wallet?.value;
    final isLoading = wallet?.isLoading ?? false;
    final hasError = wallet?.hasError ?? false;
    final balanceLabel = isGuest
        ? 'Giriş yap'
        : hasError
        ? 'Bakiye alınamadı'
        : isLoading
        ? 'Yükleniyor…'
        : balance != null
        ? formatTl(balance.balance)
        : 'Bakiye alınamadı';
    final showBalance = !isGuest && !isLoading && !hasError && balance != null;
    final labelStyle = AppTypography.body.copyWith(fontSize: 13, height: 1.2);
    final balanceStyle = showBalance
        ? AppTypography.numberLarge.copyWith(fontSize: 27)
        : AppTypography.body.copyWith(
            color: isGuest ? AppColors.primary : AppColors.textSecondary,
            height: 1.3,
          );
    final buttonStyle = AppTypography.button.copyWith(
      fontSize: 15,
      color: AppColors.primary,
    );

    double textWidth(String text, TextStyle style) {
      final painter = TextPainter(
        text: TextSpan(text: text, style: style),
        textDirection: Directionality.of(context),
        textScaler: MediaQuery.textScalerOf(context),
      )..layout();
      final width = painter.width;
      painter.dispose();
      return width;
    }

    final topUpWidth = textWidth('Yükle', buttonStyle) + 52;
    final actionWidth = topUpWidth + AppSpacing.sm + 48;
    final informationWidth =
        42 +
        AppSpacing.sm +
        math.max(
          textWidth('Dosso Dossi Kart', labelStyle),
          textWidth(balanceLabel, balanceStyle),
        );

    Widget actions() => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: topUpWidth,
          child: OutlinedButton.icon(
            onPressed: onTopUp,
            icon: const Icon(Icons.add_rounded, size: 18),
            label: Text('Yükle', style: buttonStyle),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              minimumSize: const Size(0, 48),
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              side: BorderSide(
                color: AppColors.primary.withValues(alpha: 0.35),
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        SizedBox(
          width: 48,
          height: 48,
          child: IconButton.filled(
            onPressed: onScan,
            tooltip: 'Tara ve öde',
            style: IconButton.styleFrom(
              foregroundColor: AppColors.surface,
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
            ),
            icon: const Icon(Icons.qr_code_scanner_rounded, size: 23),
          ),
        ),
      ],
    );

    Widget information() => Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: const BoxDecoration(
            color: AppColors.surfaceTint,
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.account_balance_wallet_rounded,
            color: AppColors.primary,
            size: 23,
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Dosso Dossi Kart', style: labelStyle),
              const SizedBox(height: AppSpacing.xs),
              if (showBalance)
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(balanceLabel, style: balanceStyle),
                )
              else
                Text(balanceLabel, style: balanceStyle),
            ],
          ),
        ),
      ],
    );

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 22,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final canFitRow =
              informationWidth + AppSpacing.md + actionWidth <=
              constraints.maxWidth;
          if (canFitRow) {
            return Row(
              children: [
                Expanded(child: information()),
                const SizedBox(width: AppSpacing.md),
                actions(),
              ],
            );
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              information(),
              const SizedBox(height: AppSpacing.md),
              Align(alignment: Alignment.centerRight, child: actions()),
            ],
          );
        },
      ),
    );
  }
}
