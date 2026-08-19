import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';

/// Sadakat kartının nasıl işlediğini anlatan alt sayfa.
/// Ana sayfadaki damga kartı ve kampanya sayfası aynı içeriği paylaşır.
void showLoyaltyHowItWorksSheet(BuildContext context, int target) {
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
          const _Step(number: 1, text: 'Kahveni uygulamayla öde'),
          const _Step(number: 2, text: 'Her kahve 1 damga kazandırır'),
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
