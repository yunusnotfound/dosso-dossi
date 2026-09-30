import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../auth/application/guest_mode.dart';
import '../../../auth/presentation/guest_gate.dart';
import '../../../rewards/application/loyalty_providers.dart';
import 'campaign_stamp_progress.dart';

/// Kampanya sayfasında hesaptaki gerçek kahve damgalarını gösterir.
class CampaignProgressCard extends ConsumerWidget {
  const CampaignProgressCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(guestModeProvider)) {
      return _CardSurface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CampaignProgressHeading(),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Kahve damgalarını ve ikramlarını görmek için giriş yap.',
              style: AppTypography.bodySecondary,
            ),
            const SizedBox(height: AppSpacing.sm),
            TextButton.icon(
              onPressed: () => showGuestSignInSheet(
                context,
                ref,
                action: 'Kahve ilerlemeni görmek',
              ),
              icon: const Icon(Icons.login_rounded, size: 18),
              label: const Text('Giriş yap / Üye ol'),
            ),
          ],
        ),
      );
    }

    final loyalty = ref.watch(loyaltyStatusProvider);
    return _CardSurface(
      child: loyalty.when(
        data: (status) => CampaignStampProgress(status: status),
        loading: () => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CampaignProgressHeading(),
            const SizedBox(height: AppSpacing.xl),
            Row(
              children: [
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    'Kahve damgaların yükleniyor…',
                    style: AppTypography.bodySecondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ),
        error: (error, stackTrace) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CampaignProgressHeading(),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Kahve damgaların şu anda yüklenemedi.',
              style: AppTypography.bodySecondary,
            ),
            const SizedBox(height: AppSpacing.xs),
            TextButton.icon(
              onPressed: () => ref.invalidate(loyaltyStatusProvider),
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Tekrar dene'),
            ),
          ],
        ),
      ),
    );
  }
}

class _CardSurface extends StatelessWidget {
  const _CardSurface({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow.withValues(alpha: 0.035),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
  }
}
