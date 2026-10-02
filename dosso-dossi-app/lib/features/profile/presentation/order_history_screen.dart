import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/scrollable_page_scaffold.dart';
import '../../../routing/app_router.dart';
import '../../order/application/order_providers.dart';

/// Geçmiş siparişler; aktif sipariş canlı takibe götürür.
class OrderHistoryScreen extends ConsumerWidget {
  const OrderHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(ordersProvider);
    final load = ref.watch(ordersLoadProvider);

    return ScrollablePageScaffold.slivers(
      title: 'Geçmiş Siparişler',
      slivers: [
        if (load.isLoading)
          const SliverToBoxAdapter(child: LinearProgressIndicator()),
        if (load.hasError)
          SliverToBoxAdapter(
            child: Column(
              children: [
                const Text(
                  'Siparişler yüklenemedi. Önceki kayıtlar güncel olmayabilir.',
                ),
                TextButton(
                  onPressed: () async {
                    try {
                      await ref.read(ordersProvider.notifier).refresh();
                    } catch (_) {}
                  },
                  child: const Text('Tekrar dene'),
                ),
              ],
            ),
          ),
        orders.isEmpty && (load.isLoading || load.hasError)
            ? const SliverToBoxAdapter(child: SizedBox.shrink())
            : orders.isEmpty
            ? SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('🧾', style: TextStyle(fontSize: 56)),
                      const SizedBox(height: AppSpacing.md),
                      Text('Henüz siparişin yok', style: AppTypography.title),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'İlk siparişini Sipariş sekmesinden ver',
                        style: AppTypography.bodySecondary,
                      ),
                    ],
                  ),
                ),
              )
            : SliverList.separated(
                itemCount: orders.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(height: AppSpacing.md),
                itemBuilder: (context, index) {
                  final order = orders[index];
                  return GestureDetector(
                    onTap: () =>
                        context.push(Routes.orderTrackingPath(order.id)),
                    child: Container(
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
                              ...[
                                Text(
                                  order.statusLabel,
                                  style: AppTypography.badge.copyWith(
                                    color: AppColors.primary,
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.sm),
                              ],
                              Text(
                                formatTl(order.total),
                                style: AppTypography.title,
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(order.itemsLabel, style: AppTypography.body),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            '${order.branchName} · ${formatDayMonth(order.createdAt)} · ${order.pickupLabel}',
                            style: AppTypography.bodySecondary.copyWith(
                              fontSize: 13,
                            ),
                          ),
                          if (order.stampsEarned > 0) ...[
                            const SizedBox(height: AppSpacing.sm),
                            Text(
                              '+${order.stampsEarned} damga kazanıldı',
                              style: AppTypography.badge.copyWith(
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
      ],
    );
  }
}
