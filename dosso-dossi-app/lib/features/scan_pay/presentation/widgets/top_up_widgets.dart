import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/formatters.dart';
import '../../../campaigns/application/public_config.dart';
import '../../../wallet/application/wallet_providers.dart';
import 'top_up_confirmation.dart';
import 'payment_checkout_sheet.dart';

class QuickTopUpRow extends ConsumerWidget {
  const QuickTopUpRow({super.key});

  static const _amounts = [100.0, 250.0, 500.0];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      children: [
        for (final amount in _amounts) ...[
          if (amount != _amounts.first) const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: OutlinedButton(
              onPressed: ref.watch(topUpFlowProvider)
                  ? null
                  : () => confirmTopUp(context, ref, amount),
              style: OutlinedButton.styleFrom(
                backgroundColor: AppColors.surface,
                side: BorderSide.none,
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
              ),
              child: Text(
                '${amount.toStringAsFixed(0)} ₺',
                style: AppTypography.body,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class TopUpView extends ConsumerStatefulWidget {
  const TopUpView({super.key});

  @override
  ConsumerState<TopUpView> createState() => _TopUpViewState();
}

class _TopUpViewState extends ConsumerState<TopUpView> {
  static const _amounts = [100.0, 250.0, 500.0, 1000.0];
  double? _selected = 250;
  final _customController = TextEditingController();

  double? get _amount {
    final custom = double.tryParse(_customController.text.replaceAll(',', '.'));
    if (_customController.text.trim().isEmpty) return _selected;
    if (custom != null &&
        custom.isFinite &&
        custom > 0 &&
        custom <= 100000 &&
        (custom * 100 - (custom * 100).round()).abs() < 0.000001) {
      return custom;
    }
    return null;
  }

  @override
  void dispose() {
    _customController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final wallet = ref.watch(walletProvider);
    final amount = _amount;
    final config = ref.watch(walletPaymentConfigProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Mevcut bakiye', style: AppTypography.bodySecondary),
              const SizedBox(height: 2),
              wallet.when(
                loading: () => Text('...', style: AppTypography.title),
                error: (e, _) => Text('—', style: AppTypography.title),
                data: (w) => Text(
                  formatTl(w.balance),
                  style: AppTypography.title.copyWith(fontSize: 22),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.gold,
            borderRadius: BorderRadius.circular(AppRadius.sm),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.card_giftcard,
                size: 18,
                color: AppColors.onGold,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  '${ref.watch(campaignRulesProvider).topupFirstOnly ? 'İlk yüklemende ' : ''}${ref.watch(campaignRulesProvider).topupThreshold.toStringAsFixed(0)} ₺ ve üzeri yüklemeye ${ref.watch(campaignRulesProvider).topupBonusDrinks} ikram kahve hediye!',
                  style: AppTypography.badge.copyWith(
                    fontSize: 13,
                    color: AppColors.onGold,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        Text('TUTAR SEÇ', style: AppTypography.sectionLabel),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final amount in _amounts)
              GestureDetector(
                onTap: () => setState(() {
                  _selected = amount;
                  _customController.clear();
                }),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.xl,
                    vertical: AppSpacing.md,
                  ),
                  decoration: BoxDecoration(
                    color: _selected == amount && _customController.text.isEmpty
                        ? AppColors.coffeeDark
                        : AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    '${amount.toStringAsFixed(0)} ₺',
                    style: AppTypography.body.copyWith(
                      color:
                          _selected == amount && _customController.text.isEmpty
                          ? AppColors.textOnDark
                          : AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        TextField(
          controller: _customController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[\d,\.]')),
          ],
          decoration: const InputDecoration(
            hintText: 'Farklı tutar gir (₺)',
            helperText: 'En fazla 100.000 ₺ · En fazla 2 ondalık basamak',
            prefixIcon: Icon(
              Icons.edit_outlined,
              size: 20,
              color: AppColors.textSecondary,
            ),
          ),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: AppSpacing.xl),
        Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline, color: AppColors.primary),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  config.when(
                    loading: () => 'Ödeme yöntemi kontrol ediliyor…',
                    error: (_, _) => 'Ödeme yöntemi şu an doğrulanamıyor',
                    data: (value) => !value.enabled
                        ? 'Bakiye yükleme yakında hizmetinde'
                        : value.isIyzico
                        ? 'iyzico ile güvenli ödeme · Kart bilgilerin iyzico’da alınır'
                        : 'Simülasyon yüklemesi · Gerçek ödeme alınmaz',
                  ),
                  style: AppTypography.body,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        FilledButton(
          onPressed:
              ref.watch(topUpFlowProvider) ||
                  amount == null ||
                  config.value?.enabled != true
              ? null
              : () => confirmTopUp(context, ref, amount),
          child: Text(
            amount == null ? 'Tutar seç' : 'Yükle · ${formatTl(amount)}',
          ),
        ),
      ],
    );
  }
}
