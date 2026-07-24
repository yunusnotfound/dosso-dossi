import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/scrollable_column.dart';
import '../../../routing/app_router.dart';
import '../application/order_providers.dart';

/// Ödeme sonrası sipariş onay ekranı. Son siparişi gösterir.
class OrderSuccessScreen extends ConsumerWidget {
  const OrderSuccessScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(ordersProvider);
    final order = orders.isEmpty ? null : orders.first;

    return Scaffold(
      body: SafeArea(
        child: ScrollableColumn(
          padding: const EdgeInsets.all(AppSpacing.page),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Spacer(),
            const CircleAvatar(
              radius: 44,
              backgroundColor: AppColors.success,
              child: Icon(Icons.check, size: 48, color: Colors.white),
            ),
            const SizedBox(height: AppSpacing.xl),
            Text(
              'Siparişin alındı!',
              textAlign: TextAlign.center,
              style: AppTypography.displayLarge,
            ),
            const SizedBox(height: AppSpacing.sm),
            if (order != null) ...[
              Text(
                'Sipariş No: ${order.id}',
                textAlign: TextAlign.center,
                style: AppTypography.bodySecondary,
              ),
              const SizedBox(height: AppSpacing.xxl),
              Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Column(
                  children: [
                    _row('Şube', order.branchName),
                    const SizedBox(height: AppSpacing.sm),
                    _row('Teslim', order.pickupLabel),
                    const SizedBox(height: AppSpacing.sm),
                    _row('Ürünler', order.itemsLabel),
                    const SizedBox(height: AppSpacing.sm),
                    _row('Ödenen', formatTl(order.total)),
                    if (order.stampsEarned > 0) ...[
                      const SizedBox(height: AppSpacing.sm),
                      _row('Kazanılan damga', '+${order.stampsEarned}'),
                    ],
                  ],
                ),
              ),
            ],
            const Spacer(),
            if (order != null) ...[
              FilledButton(
                onPressed: () =>
                    context.go(Routes.orderTrackingPath(order.id)),
                child: const Text('Siparişimi Takip Et'),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            OutlinedButton(
              onPressed: () => context.go(Routes.home),
              child: const Text('Ana Sayfaya Dön'),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 130,
          child: Text(label, style: AppTypography.bodySecondary),
        ),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: AppTypography.body,
          ),
        ),
      ],
    );
  }
}
