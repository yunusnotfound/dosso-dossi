import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../application/notification_prefs.dart';

class NotificationPrefsScreen extends ConsumerWidget {
  const NotificationPrefsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefs = ref.watch(notificationPrefsProvider);
    final controller = ref.read(notificationPrefsProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('Bildirim Tercihleri')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.page),
          children: [
            _PrefTile(
              title: 'Kampanya bildirimleri',
              subtitle: 'Yeni kampanya ve fırsatlardan haberdar ol',
              value: prefs.campaigns,
              onChanged: (v) =>
                  controller.update(prefs.copyWith(campaigns: v)),
            ),
            const SizedBox(height: AppSpacing.md),
            _PrefTile(
              title: 'Sipariş durumu',
              subtitle: 'Siparişin hazırlanınca haber ver',
              value: prefs.orderStatus,
              onChanged: (v) =>
                  controller.update(prefs.copyWith(orderStatus: v)),
            ),
            const SizedBox(height: AppSpacing.md),
            _PrefTile(
              title: 'SMS bildirimleri',
              subtitle: 'Kampanyaları SMS ile de al',
              value: prefs.sms,
              onChanged: (v) => controller.update(prefs.copyWith(sms: v)),
            ),
          ],
        ),
      ),
    );
  }
}

class _PrefTile extends StatelessWidget {
  const _PrefTile({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTypography.body),
                const SizedBox(height: 2),
                Text(subtitle,
                    style:
                        AppTypography.bodySecondary.copyWith(fontSize: 13)),
              ],
            ),
          ),
          Switch(
            value: value,
            activeTrackColor: AppColors.primary,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}
