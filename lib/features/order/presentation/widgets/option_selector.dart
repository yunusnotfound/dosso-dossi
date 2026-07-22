import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/product_options.dart';

/// Boy / süt / shot seçim satırı. Ürün detayında ve sepet düzenlemede kullanılır.
class OptionSelector extends StatelessWidget {
  const OptionSelector({
    super.key,
    required this.label,
    required this.options,
    required this.selected,
    required this.onChanged,
  });

  final String label;
  final List<ProductOption> options;
  final ProductOption selected;
  final ValueChanged<ProductOption> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: AppTypography.sectionLabel),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final option in options)
              GestureDetector(
                onTap: () => onChanged(option),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: option.name == selected.name
                        ? AppColors.coffeeDark
                        : AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    border: Border.all(color: AppColors.divider),
                  ),
                  child: Text(
                    option.priceDelta == 0
                        ? option.name
                        : '${option.name} ${option.priceDelta > 0 ? '+' : ''}${option.priceDelta.toStringAsFixed(0)} ₺',
                    style: AppTypography.body.copyWith(
                      fontSize: 14,
                      color: option.name == selected.name
                          ? AppColors.textOnDark
                          : AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}
