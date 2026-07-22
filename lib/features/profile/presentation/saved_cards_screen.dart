import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';

/// Kayıtlı kartlar — mock. Gerçek kart saklama, ödeme sağlayıcısı
/// entegrasyonunda (iyzico/PayTR tokenizasyon) yapılacak.
class SavedCardsScreen extends StatelessWidget {
  const SavedCardsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Kayıtlı Kartlar')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.page),
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceTint,
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                    ),
                    child: const Icon(Icons.credit_card,
                        color: AppColors.primary),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Visa •••• 7412', style: AppTypography.body),
                        Text('Varsayılan kart',
                            style: AppTypography.bodySecondary
                                .copyWith(fontSize: 13)),
                      ],
                    ),
                  ),
                  const Icon(Icons.check_circle,
                      size: 20, color: AppColors.success),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            OutlinedButton.icon(
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                      'Kart ekleme, ödeme sağlayıcısı entegrasyonuyla açılacak'),
                ),
              ),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                side: const BorderSide(color: AppColors.primary),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
              ),
              icon: const Icon(Icons.add, color: AppColors.primary),
              label: Text('Yeni Kart Ekle',
                  style:
                      AppTypography.body.copyWith(color: AppColors.primary)),
            ),
          ],
        ),
      ),
    );
  }
}
