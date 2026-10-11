import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/session_scope.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/error_feedback.dart';
import '../../../../core/utils/formatters.dart';
import '../../application/top_up_flow_coordinator.dart';

/// Yükleme onayı — hızlı yükleme ve Bakiye Yükle sekmesi ortak kullanır.
Future<void> confirmTopUp(
  BuildContext context,
  WidgetRef ref,
  double amount,
) async {
  final scope = ref.read(sessionScopeProvider);
  final epoch = scope.revision;
  try {
    final result = await ref
        .read(topUpFlowCoordinatorProvider)
        .confirmAndTopUp(
          amount: amount,
          isActive: () => context.mounted,
          confirm: () => showModalBottomSheet<bool>(
            context: context,
            useRootNavigator: true,
            backgroundColor: AppColors.background,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(AppRadius.lg),
              ),
            ),
            builder: (context) => SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.page),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Bakiye Yükle', style: AppTypography.headline),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Dosso Dossi Kart hesabına ${formatTl(amount)} test bakiyesi eklenecek. '
                      'Bu bir simülasyondur; gerçek ödeme alınmaz.',
                      style: AppTypography.bodySecondary,
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    FilledButton(
                      onPressed: () => Navigator.of(context).pop(true),
                      child: Text('Onayla · ${formatTl(amount)}'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );

    if (result == null || !context.mounted || scope.revision != epoch) return;
    if (result.isPending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Yükleme işlemi onay bekliyor. Bakiye onaylandığında güncellenecek.',
          ),
        ),
      );
      return;
    }
    final bonusDrinks = result.bonusDrinks;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppColors.success,
        content: Text(
          bonusDrinks > 0
              ? '${formatTl(amount)} yüklendi · $bonusDrinks ikram kahve hediye! 🎉'
              : '${formatTl(amount)} yüklendi',
        ),
      ),
    );
  } catch (error) {
    if (context.mounted && scope.revision == epoch) {
      showApiError(context, error);
    }
  }
}
