import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../order/application/order_providers.dart';

/// Bu oturumda verilen siparişler. API bağlanınca sunucudan gelecek.
class OrderHistoryScreen extends ConsumerWidget {
  const OrderHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(ordersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Geçmiş Siparişler')),
      body: orders.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('🧾', style: TextStyle(fontSize: 56)),
                  const SizedBox(height: AppSpacing.md),
                  Text('Henüz siparişin yok', style: AppTypography.title),
                  const SizedBox(height: AppSpacing.xs),
                  Text('İlk siparişini Sipariş sekmesinden ver',
                      style: AppTypography.bodySecondary),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.page),
              itemCount: orders.length,
              separatorBuilder: (_, _) =>
                  const SizedBox(height: AppSpacing.md),
              itemBuilder: (context, index) {
                final order = orders[index];
                return Container(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(order.id, style: AppTypography.title),
                          const Spacer(),
                          Text(formatTl(order.total),
                              style: AppTypography.title),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(order.itemsLabel, style: AppTypography.body),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        '${order.branchName} · ${formatDayMonth(order.createdAt)} · ${order.pickupLabel}',
                        style: AppTypography.bodySecondary
                            .copyWith(fontSize: 13),
                      ),
                      if (order.stampsEarned > 0) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          '+${order.stampsEarned} damga kazanıldı',
                          style: AppTypography.badge
                              .copyWith(color: AppColors.primary),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
    );
  }
}
