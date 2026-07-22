import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/brand_logo.dart';
import '../../../../routing/app_router.dart';
import '../../../wallet/application/wallet_providers.dart';

/// Ana sayfadaki Dosso Kart satırı: bakiye + Yükle + QR kısayolu.
class WalletCard extends ConsumerWidget {
  const WalletCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(walletProvider);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          const BrandLogo(size: 56),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Dosso Kart', style: AppTypography.bodySecondary),
                wallet.when(
                  loading: () => Text('...', style: AppTypography.title),
                  error: (e, _) => Text('—', style: AppTypography.title),
                  data: (w) => Text(
                    formatTl(w.balance),
                    style: AppTypography.title.copyWith(fontSize: 20),
                  ),
                ),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: () => context.go(Routes.scanPay),
            style: TextButton.styleFrom(
              backgroundColor: AppColors.surfaceTint,
              foregroundColor: AppColors.textPrimary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.md,
              ),
            ),
            icon: const Icon(Icons.add, size: 18),
            label: Text('Yükle', style: AppTypography.body),
          ),
          const SizedBox(width: AppSpacing.sm),
          IconButton(
            onPressed: () => context.go(Routes.scanPay),
            icon: const Icon(Icons.qr_code_scanner, color: AppColors.primary),
          ),
        ],
      ),
    );
  }
}
