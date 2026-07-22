import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../routing/app_router.dart';
import '../../../rewards/application/loyalty_providers.dart';
import '../../../rewards/domain/loyalty_status.dart';

/// Ana sayfadaki koyu zeminli damga kartı: 3/5 ilerleme + damga rozetleri.
class StampCard extends ConsumerWidget {
  const StampCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loyalty = ref.watch(loyaltyStatusProvider);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: AppColors.coffeeDark,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: loyalty.when(
        loading: () => const SizedBox(
          height: 140,
          child: Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          ),
        ),
        error: (e, _) => SizedBox(
          height: 140,
          child: Center(
            child: Text(
              'Damga bilgisi yüklenemedi',
              style: AppTypography.body.copyWith(color: AppColors.textOnDark),
            ),
          ),
        ),
        data: (status) => _StampContent(status: status),
      ),
    );
  }
}

class _StampContent extends StatelessWidget {
  const _StampContent({required this.status});

  final LoyaltyStatus status;

  @override
  Widget build(BuildContext context) {
    return Column(
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
                          style:
                              AppTypography.body.copyWith(color: AppColors.gold),
                        ),
                        const TextSpan(text: ' kaldı'),
                      ],
                    ),
                  ),
                  if (status.freeDrinks > 0) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Kullanılabilir ikramın: ${status.freeDrinks} ☕',
                      style: AppTypography.badge.copyWith(color: AppColors.gold),
                    ),
                  ],
                ],
              ),
            ),
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.card_giftcard,
                  size: 22, color: AppColors.goldOnDark),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xl),
        // FittedBox: dar ekranlarda damga dizisi taşmak yerine küçülür.
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Row(
            children: List.generate(status.target, (i) {
              final isLast = i == status.target - 1;
              final earned = i < status.stamps;
              return Padding(
                padding: EdgeInsets.only(right: isLast ? 0 : AppSpacing.md),
                child: _StampDot(
                  earned: earned,
                  isRewardSlot: isLast && !earned,
                ),
              );
            }),
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        Row(
          children: [
            Flexible(
              child: OutlinedButton(
                onPressed: () => context.push(Routes.rewards),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textOnDark,
                  side:
                      BorderSide(color: Colors.white.withValues(alpha: 0.35)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.xl,
                    vertical: AppSpacing.md,
                  ),
                ),
                child: Text(
                  'İkramlarım',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style:
                      AppTypography.body.copyWith(color: AppColors.textOnDark),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Flexible(
              child: TextButton(
                onPressed: () => _showHowItWorks(context, status.target),
                child: Text(
                  'Nasıl çalışır?',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body
                      .copyWith(color: AppColors.textOnDarkMuted),
                ),
              ),
            ),
          ],
        ),
      ],
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
      width: 40,
      height: 40,
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
        size: 18,
        color: earned
            ? Colors.white
            : isRewardSlot
                ? AppColors.goldOnDark
                : AppColors.stampInactive,
      ),
    );
  }
}

void _showHowItWorks(BuildContext context, int target) {
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
    ),
    builder: (context) => Padding(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Nasıl çalışır?', style: AppTypography.headline),
          const SizedBox(height: AppSpacing.xl),
          _Step(number: 1, text: 'Kahveni uygulamayla öde'),
          _Step(number: 2, text: 'Her kahve 1 damga kazandırır'),
          _Step(number: 3, text: '$target damga = 1 ikram içecek'),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'İkram içeceğin, dilediğin boyda tek bir el yapımı içecek için geçerlidir.',
            style: AppTypography.bodySecondary,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ),
    ),
  );
}

class _Step extends StatelessWidget {
  const _Step({required this.number, required this.text});

  final int number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
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
              '$number',
              style: AppTypography.badge.copyWith(color: Colors.white),
            ),
          ),
          const SizedBox(width: AppSpacing.lg),
          Expanded(child: Text(text, style: AppTypography.body)),
        ],
      ),
    );
  }
}
