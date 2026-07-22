import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../application/loyalty_providers.dart';
import '../domain/loyalty_status.dart';

/// İkramlarım: damga ilerlemesi, kullanılabilir ikramlar, kampanyalar, geçmiş.
class RewardsScreen extends ConsumerWidget {
  const RewardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loyalty = ref.watch(loyaltyStatusProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('İkramlarım')),
      body: loyalty.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child:
              Text('İkram bilgisi yüklenemedi', style: AppTypography.bodySecondary),
        ),
        data: (status) => ListView(
          padding: const EdgeInsets.all(AppSpacing.page),
          children: [
            _ProgressCard(status: status),
            const SizedBox(height: AppSpacing.xxl),
            Text('NASIL ÇALIŞIR', style: AppTypography.sectionLabel),
            const SizedBox(height: AppSpacing.md),
            const _HowItWorksCard(),
            const SizedBox(height: AppSpacing.xxl),
            Text('KAMPANYALAR', style: AppTypography.sectionLabel),
            const SizedBox(height: AppSpacing.md),
            const _CampaignNoteCard(),
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
                  child: Text('Henüz ikram geçmişin yok',
                      style: AppTypography.bodySecondary),
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
  const _ProgressCard({required this.status});

  final LoyaltyStatus status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: AppColors.coffeeDark,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        text: '${status.stamps}',
                        style: AppTypography.numberLarge
                            .copyWith(color: AppColors.textOnDark),
                        children: [
                          TextSpan(
                            text: '/${status.target}',
                            style: AppTypography.title
                                .copyWith(color: AppColors.textOnDarkMuted),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text.rich(
                      TextSpan(
                        text: 'İkram içeceğine ',
                        style: AppTypography.bodySecondary
                            .copyWith(color: AppColors.textOnDarkMuted),
                        children: [
                          TextSpan(
                            text: '${status.remaining} kahve',
                            style: AppTypography.body
                                .copyWith(color: AppColors.gold),
                          ),
                          const TextSpan(text: ' kaldı'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (status.freeDrinks > 0)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.gold,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.card_giftcard,
                          size: 16, color: AppColors.onGold),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        '${status.freeDrinks} ikram',
                        style: AppTypography.badge
                            .copyWith(color: AppColors.onGold),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.md,
            children: [
              for (var i = 0; i < status.target; i++)
                _StampDot(
                  earned: i < status.stamps,
                  isRewardSlot: i == status.target - 1 &&
                      status.stamps < status.target,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Her kahve 1 damga · ${status.target}. damga = ikram',
            style: AppTypography.bodySecondary
                .copyWith(color: AppColors.textOnDarkMuted, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _StampDot extends StatelessWidget {
  const _StampDot({required this.earned, required this.isRewardSlot});

  final bool earned;
  final bool isRewardSlot;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: earned ? AppColors.primary : Colors.transparent,
        border: earned
            ? null
            : Border.all(
                width: 1.5,
                color: isRewardSlot
                    ? AppColors.goldOnDark
                    : AppColors.stampInactive,
              ),
      ),
      child: Icon(
        isRewardSlot ? Icons.card_giftcard : Icons.coffee,
        size: 20,
        color: earned
            ? Colors.white
            : isRewardSlot
                ? AppColors.goldOnDark
                : AppColors.stampInactive,
      ),
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
                      style:
                          AppTypography.badge.copyWith(color: Colors.white),
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

class _CampaignNoteCard extends StatelessWidget {
  const _CampaignNoteCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.gold,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          const Icon(Icons.bolt, color: AppColors.onGold),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              'Tek seferde ${AppConfig.topUpBonusThreshold.toStringAsFixed(0)} ₺ ve üzeri bakiye yükle, '
              '${AppConfig.topUpBonusDrinks} ikram kahve hediye kazan!',
              style: AppTypography.body.copyWith(color: AppColors.onGold),
            ),
          ),
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
                horizontal: AppSpacing.md, vertical: AppSpacing.xs),
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
