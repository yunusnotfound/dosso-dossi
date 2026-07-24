import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../routing/app_router.dart';
import '../application/order_tracking_provider.dart';

/// Canlı sipariş takibi: Alındı → Hazırlanıyor → Hazır.
class OrderTrackingScreen extends ConsumerWidget {
  const OrderTrackingScreen({super.key, required this.orderId});

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tracking = ref.watch(orderTrackingProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: Text('Sipariş $orderId')),
      body: SafeArea(
        child: tracking.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.page),
              child: Text(
                'Sipariş bilgisi alınamadı. Bağlantını kontrol et.',
                textAlign: TextAlign.center,
                style: AppTypography.bodySecondary,
              ),
            ),
          ),
          data: (order) => ListView(
            padding: const EdgeInsets.all(AppSpacing.page),
            children: [
              if (order.status == 'cancelled')
                _CancelledBanner()
              else
                _StatusSteps(status: order.status),
              const SizedBox(height: AppSpacing.xl),
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
                    _row('Tutar', formatTl(order.total)),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              if (order.status == 'ready')
                Container(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.local_cafe, color: AppColors.success),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Text(
                          'Siparişin hazır! Kasadan teslim alabilirsin.',
                          style: AppTypography.body,
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: AppSpacing.xl),
              FilledButton(
                onPressed: () => context.go(Routes.home),
                child: const Text('Ana Sayfaya Dön'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 110,
          child: Text(label, style: AppTypography.bodySecondary),
        ),
        Expanded(
          child: Text(value, textAlign: TextAlign.right, style: AppTypography.body),
        ),
      ],
    );
  }
}

class _StatusSteps extends StatelessWidget {
  const _StatusSteps({required this.status});

  final String status;

  static const _steps = [
    ('received', 'Siparişin alındı', Icons.receipt_long),
    ('preparing', 'Hazırlanıyor', Icons.coffee_maker_outlined),
    ('ready', 'Hazır — afiyet olsun!', Icons.check_circle_outline),
  ];

  int get _activeIndex => switch (status) {
        'preparing' => 1,
        'ready' || 'completed' => 2,
        _ => 0,
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        children: [
          for (var i = 0; i < _steps.length; i++) ...[
            if (i > 0)
              Padding(
                padding: const EdgeInsets.only(left: 19),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    width: 2,
                    height: 24,
                    color:
                        i <= _activeIndex ? AppColors.primary : AppColors.divider,
                  ),
                ),
              ),
            Row(
              children: [
                _StepDot(
                  icon: _steps[i].$3,
                  state: i < _activeIndex
                      ? _StepState.done
                      : i == _activeIndex
                          ? _StepState.active
                          : _StepState.pending,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    _steps[i].$2,
                    style: i <= _activeIndex
                        ? AppTypography.body
                        : AppTypography.bodySecondary,
                  ),
                ),
                if (i == _activeIndex && status != 'ready' && status != 'completed')
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.primary,
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

enum _StepState { done, active, pending }

class _StepDot extends StatelessWidget {
  const _StepDot({required this.icon, required this.state});

  final IconData icon;
  final _StepState state;

  @override
  Widget build(BuildContext context) {
    final color = switch (state) {
      _StepState.done || _StepState.active => AppColors.primary,
      _StepState.pending => AppColors.divider,
    };
    return CircleAvatar(
      radius: 20,
      backgroundColor: color.withValues(alpha: 0.15),
      child: Icon(icon, size: 20, color: color),
    );
  }
}

class _CancelledBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          const Icon(Icons.cancel_outlined, color: AppColors.danger),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              'Sipariş iptal edildi. Ödemen bakiyene iade edilecek.',
              style: AppTypography.body,
            ),
          ),
        ],
      ),
    );
  }
}
