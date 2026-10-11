import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/scrollable_page_scaffold.dart';

/// Dosso Dossi cüzdan kartı bir banka kartı kaydı değildir.
class SavedCardsScreen extends StatelessWidget {
  const SavedCardsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ScrollablePageScaffold(
      title: 'Kayıtlı Kartlar',
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.xl),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Column(
            children: [
              const Icon(
                Icons.credit_card_outlined,
                color: AppColors.primary,
                size: 44,
              ),
              const SizedBox(height: AppSpacing.lg),
              Text('Kayıtlı banka kartın yok', style: AppTypography.title),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Banka kartı kaydetme şu anda kullanılamıyor. Dosso Dossi Kart bakiyeni Tara & Öde ekranından görüntüleyebilirsin.',
                style: AppTypography.bodySecondary,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
