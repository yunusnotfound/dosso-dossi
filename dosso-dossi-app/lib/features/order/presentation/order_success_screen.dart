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
import '../domain/order_record.dart';

/// Ödeme sonrası onay ekranı, yalnızca bu işlemin siparişini gösterir.
class OrderSuccessScreen extends ConsumerWidget {
  const OrderSuccessScreen({
    super.key,
    required this.orderId,
    this.initialOrder,
  });

  final String orderId;
  final OrderRecord? initialOrder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final receipt = initialOrder?.id == orderId
        ? AsyncData(initialOrder!)
        : ref.watch(orderReceiptProvider(orderId));
    return receipt.when(
      data: (order) => _receipt(context, order),
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (_, _) => Scaffold(
        appBar: AppBar(title: const Text('Sipariş bilgisi')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.page),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Sipariş bilgisi alınamadı. Tekrar deneyebilirsin.'),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: () =>
                      ref.invalidate(orderReceiptProvider(orderId)),
                  child: const Text('Tekrar dene'),
                ),
                TextButton(
                  onPressed: () => context.go(Routes.orderHistory),
                  child: const Text('Siparişlerime git'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _receipt(BuildContext context, OrderRecord order) {
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
            ...[
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
            ...[
              FilledButton(
                onPressed: () => context.go(Routes.orderTrackingPath(order.id)),
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
