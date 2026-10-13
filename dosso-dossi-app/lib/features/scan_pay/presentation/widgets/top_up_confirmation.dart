import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/network/session_scope.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/error_feedback.dart';
import '../../../../core/utils/formatters.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../wallet/data/wallet_repository.dart';
import '../../application/top_up_flow_coordinator.dart';
import 'payment_billing_sheet.dart';
import 'payment_checkout_sheet.dart';

/// Both quick top-up and the wallet tab share the same guarded checkout flow.
Future<void> confirmTopUp(
  BuildContext context,
  WidgetRef ref,
  double amount,
) async {
  final scope = ref.read(sessionScopeProvider);
  final epoch = scope.revision;
  bool active() => context.mounted && scope.revision == epoch;
  PaymentBuyer? buyer;
  try {
    final result = await ref
        .read(topUpFlowCoordinatorProvider)
        .confirmAndTopUp(
          amount: amount,
          isActive: active,
          buyer: () => buyer,
          confirm: () async {
            final repository = ref.read(walletRepositoryProvider);
            final pending = await repository.getPendingPayment();
            if (!context.mounted || !active()) return false;
            if (pending != null) {
              final action = await showPaymentCheckout(
                context,
                pending,
                allowNewAttempt: true,
              );
              if (!context.mounted || !active()) return false;
              ref.invalidate(pendingWalletPaymentProvider);
              if (action != PaymentCheckoutAction.newAttempt) return false;
              final latest = await repository.getPaymentStatus(
                pending.paymentId!,
              );
              if (!context.mounted || !active()) return false;
              if (latest.isTerminal) {
                await showPaymentCheckout(context, latest);
                return false;
              }
              await repository.beginNewPaymentAttempt(latest);
              if (!context.mounted || !active()) return false;
            }
            final config = await repository.getPaymentConfig();
            if (!context.mounted || !active()) return false;
            if (!config.enabled) {
              throw const ApiException(
                code: 'PAYMENT_UNAVAILABLE',
                message:
                    'Bakiye yükleme şu anda kullanılamıyor. Lütfen daha sonra tekrar dene.',
              );
            }
            if (config.isIyzico && config.requiresBillingDetails) {
              buyer = await showModalBottomSheet<PaymentBuyer>(
                context: context,
                useRootNavigator: true,
                isScrollControlled: true,
                backgroundColor: AppColors.background,
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.vertical(
                    top: Radius.circular(AppRadius.lg),
                  ),
                ),
                builder: (_) => PaymentBillingSheet(
                  amount: amount,
                  user: ref.read(authControllerProvider).value,
                ),
              );
              return buyer != null;
            }
            return showModalBottomSheet<bool>(
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
                        config.isIyzico
                            ? 'Dosso Dossi Kart hesabına ${formatTl(amount)} yüklemek için '
                                  'iyzico’nun güvenli ödeme sayfasına geçeceksin.'
                            : 'Dosso Dossi Kart hesabına ${formatTl(amount)} test bakiyesi eklenecek. '
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
            );
          },
        );
    if (result == null || !context.mounted || !active()) return;
    ref.invalidate(pendingWalletPaymentProvider);
    if (!result.isSucceeded) {
      await showPaymentCheckout(context, result, openBrowser: result.isPending);
      if (active()) ref.invalidate(pendingWalletPaymentProvider);
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppColors.success,
        content: Text(
          result.bonusDrinks > 0
              ? '${formatTl(amount)} yüklendi · ${result.bonusDrinks} ikram kahve hediye! 🎉'
              : '${formatTl(amount)} yüklendi',
        ),
      ),
    );
  } catch (error) {
    if (context.mounted && active()) {
      ref.invalidate(pendingWalletPaymentProvider);
      showApiError(context, error);
    }
  }
}
