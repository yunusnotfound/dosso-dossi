import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../home/presentation/widgets/stamp_card.dart';
import '../application/loyalty_providers.dart';
import '../domain/loyalty_status.dart';

/// İkramlarım: damga ilerlemesi, kullanım bilgisi ve ikram geçmişi.
class RewardsScreen extends ConsumerWidget {
  const RewardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loyalty = ref.watch(loyaltyStatusProvider);
    final topPadding =
        MediaQuery.paddingOf(context).top + kToolbarHeight + AppSpacing.page;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('İkramlarım'),
        backgroundColor: WidgetStateColor.resolveWith(
          (states) => states.contains(WidgetState.scrolledUnder)
              ? AppColors.background
              : Colors.transparent,
        ),
        surfaceTintColor: Colors.transparent,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
      ),
      body: loyalty.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(
            'İkram bilgisi yüklenemedi',
            style: AppTypography.bodySecondary,
          ),
        ),
        data: (status) => ListView(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.page,
            topPadding,
            AppSpacing.page,
            AppSpacing.page,
          ),
          children: [
            _ProgressCard(status: status, topBleed: topPadding),
            const SizedBox(height: AppSpacing.xxl),
            Text('NASIL ÇALIŞIR', style: AppTypography.sectionLabel),
            const SizedBox(height: AppSpacing.md),
            const _HowItWorksCard(),
            const SizedBox(height: AppSpacing.xxl),
            Text('İKRAM GEÇMİŞİ', style: AppTypography.sectionLabel),
            const SizedBox(height: AppSpacing.md),
            if (status.history.isEmpty)
              Container(
                padding: const EdgeInsets.all(AppSpacing.xl),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Center(
                  child: Text(
                    'Henüz ikram geçmişin yok',
                    style: AppTypography.bodySecondary,
                  ),
                ),
              )
            else
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Column(
                  children: [
                    for (var i = 0; i < status.history.length; i++) ...[
                      if (i > 0) const Divider(indent: AppSpacing.lg),
                      _HistoryRow(entry: status.history[i]),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'İkram içeceğin, dilediğin boyda tek bir el yapımı içecek için geçerlidir.',
              textAlign: TextAlign.center,
              style: AppTypography.bodySecondary.copyWith(fontSize: 13),
            ),
            const SizedBox(height: AppSpacing.xl),
          ],
        ),
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.status, required this.topBleed});

  final LoyaltyStatus status;
  final double topBleed;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Tablo başlığın ve durum çubuğunun arkasından ekran tepesine uzanır.
        // Alt kenar sonraki bölüm başlamadan sayfa zeminine karışır.
        Positioned(
          left: -AppSpacing.page,
          right: -AppSpacing.page,
          top: -topBleed,
          bottom: -AppSpacing.xxl,
          child: const StampCardBleed(),
        ),
        Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: LoyaltyStampContent(status: status),
        ),
      ],
    );
  }
}

class _HowItWorksCard extends StatelessWidget {
  const _HowItWorksCard();

  @override
  Widget build(BuildContext context) {
    final steps = [
      'Kahveni uygulamayla öde',
      'Her kahve 1 damga kazandırır',
      '${AppConfig.stampsPerReward} damga = 1 ikram içecek',
    ];

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        children: [
          for (var i = 0; i < steps.length; i++) ...[
            if (i > 0) const Divider(indent: AppSpacing.lg),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '${i + 1}',
                      style: AppTypography.badge.copyWith(color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.lg),
                  Expanded(child: Text(steps[i], style: AppTypography.body)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.entry});

  final RewardEntry entry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: entry.used ? AppColors.gold : AppColors.surfaceTint,
              shape: BoxShape.circle,
            ),
            child: Icon(
              entry.used ? Icons.card_giftcard : Icons.add,
              size: 20,
              color: entry.used ? AppColors.onGold : AppColors.primary,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entry.title, style: AppTypography.body),
                const SizedBox(height: 2),
                Text(
                  '${formatDayMonth(entry.date)} · ${entry.used ? 'İkram kullanıldı' : 'İkram kazanıldı'}',
                  style: AppTypography.bodySecondary.copyWith(fontSize: 13),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: entry.used ? AppColors.successSoft : AppColors.surfaceTint,
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
            child: Text(
              entry.used ? 'İkram' : 'Kazanıldı',
              style: AppTypography.badge.copyWith(
                fontSize: 12,
                color: entry.used ? AppColors.success : AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
