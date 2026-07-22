import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../order/application/menu_providers.dart';
import '../../order/domain/menu.dart';
import '../application/gift_controller.dart';
import '../domain/gift_record.dart';

/// Hediye sekmesi: arkadaşına kahve veya bakiye gönder.
class GiftScreen extends ConsumerStatefulWidget {
  const GiftScreen({super.key});

  @override
  ConsumerState<GiftScreen> createState() => _GiftScreenState();
}

class _GiftScreenState extends ConsumerState<GiftScreen> {
  int _tab = 0; // 0 = Kahve Gönder, 1 = Bakiye Gönder
  final _phoneController = TextEditingController();
  final _noteController = TextEditingController();
  Product? _selectedDrink;
  double _selectedAmount = 100;
  bool _sending = false;

  static const _amounts = [50.0, 100.0, 250.0, 500.0];

  bool get _phoneValid {
    final digits = _phoneController.text;
    return digits.length == 10 && digits.startsWith('5');
  }

  double? get _giftAmount =>
      _tab == 0 ? _selectedDrink?.price : _selectedAmount;

  String? get _giftLabel => _tab == 0
      ? _selectedDrink?.name
      : '${_selectedAmount.toStringAsFixed(0)} ₺ bakiye';

  @override
  void dispose() {
    _phoneController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final amount = _giftAmount;
    final label = _giftLabel;
    if (amount == null || label == null) return;

    setState(() => _sending = true);
    try {
      final ok = await ref
          .read(giftControllerProvider.notifier)
          .send(
            GiftRecord(
              phone: _phoneController.text,
              label: label,
              amount: amount,
              date: DateTime.now(),
              note: _noteController.text.trim(),
            ),
            type: _tab == 0 ? 'drink' : 'balance',
            productId: _selectedDrink?.id,
          );
      if (!mounted) return;
      if (!ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.danger,
            content: Text('Bakiye yetersiz. Önce Dosso Kart\'ına yükleme yap.'),
          ),
        );
        return;
      }
      _showSuccess(label);
      _phoneController.clear();
      _noteController.clear();
      setState(() => _selectedDrink = null);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _showSuccess(String label) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('🎁', style: TextStyle(fontSize: 56)),
              const SizedBox(height: AppSpacing.md),
              Text('Hediyen yolda!', style: AppTypography.headline),
              const SizedBox(height: AppSpacing.sm),
              Text(
                '$label hediyesi alıcıya SMS ile iletilecek. '
                'Hediye kodu kasada okutulda kullanılır. (Simülasyon)',
                textAlign: TextAlign.center,
                style: AppTypography.bodySecondary,
              ),
              const SizedBox(height: AppSpacing.xl),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Tamam'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final gifts = ref.watch(giftControllerProvider);
    final amount = _giftAmount;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.page),
          children: [
            Text('Hediye', style: AppTypography.displayLarge),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Arkadaşına kahve ısmarla ya da bakiye gönder — anında SMS ile ulaşsın.',
              style: AppTypography.bodySecondary,
            ),
            const SizedBox(height: AppSpacing.lg),
            _SegmentedTabs(
              selected: _tab,
              onChanged: (i) => setState(() => _tab = i),
            ),
            const SizedBox(height: AppSpacing.xl),
            Text('KİME', style: AppTypography.sectionLabel),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(10),
              ],
              decoration: const InputDecoration(
                prefixText: '+90  ',
                hintText: '5XX XXX XX XX',
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: AppSpacing.xl),
            if (_tab == 0) ...[
              Text('HANGİ KAHVE', style: AppTypography.sectionLabel),
              const SizedBox(height: AppSpacing.md),
              _DrinkPicker(
                selected: _selectedDrink,
                onSelected: (p) => setState(() => _selectedDrink = p),
              ),
            ] else ...[
              Text('TUTAR', style: AppTypography.sectionLabel),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final value in _amounts)
                    GestureDetector(
                      onTap: () => setState(() => _selectedAmount = value),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xl,
                          vertical: AppSpacing.md,
                        ),
                        decoration: BoxDecoration(
                          color: _selectedAmount == value
                              ? AppColors.coffeeDark
                              : AppColors.surface,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                        child: Text(
                          '${value.toStringAsFixed(0)} ₺',
                          style: AppTypography.body.copyWith(
                            color: _selectedAmount == value
                                ? AppColors.textOnDark
                                : AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            Text('NOT (İSTEĞE BAĞLI)', style: AppTypography.sectionLabel),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _noteController,
              maxLength: 80,
              decoration: const InputDecoration(
                hintText: 'Örn. Bu kahve benden, iyi gelsin ☕',
                counterText: '',
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            FilledButton(
              onPressed: _phoneValid && amount != null && !_sending
                  ? _send
                  : null,
              child: _sending
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      amount == null
                          ? 'Hediye Gönder'
                          : 'Hediye Gönder · ${formatTl(amount)}',
                    ),
            ),
            if (gifts.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.xxl),
              Text('GÖNDERİLEN HEDİYELER', style: AppTypography.sectionLabel),
              const SizedBox(height: AppSpacing.md),
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Column(
                  children: [
                    for (var i = 0; i < gifts.length; i++) ...[
                      if (i > 0) const Divider(indent: AppSpacing.lg),
                      _GiftRow(gift: gifts[i]),
                    ],
                  ],
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
          ],
        ),
      ),
    );
  }
}

class _SegmentedTabs extends StatelessWidget {
  const _SegmentedTabs({required this.selected, required this.onChanged});

  final int selected;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget tab(int index, String label) {
      final active = index == selected;
      return Expanded(
        child: GestureDetector(
          onTap: () => onChanged(index),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: active ? AppColors.surface : Colors.transparent,
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
            child: Text(
              label,
              style: AppTypography.body.copyWith(
                color: active ? AppColors.textPrimary : AppColors.textSecondary,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(AppSpacing.xs),
      decoration: BoxDecoration(
        color: AppColors.surfaceSunken,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(children: [tab(0, 'Kahve Gönder'), tab(1, 'Bakiye Gönder')]),
    );
  }
}

class _DrinkPicker extends ConsumerWidget {
  const _DrinkPicker({required this.selected, required this.onSelected});

  final Product? selected;
  final ValueChanged<Product> onSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(menuProductsProvider);

    return products.when(
      loading: () => const SizedBox(
        height: 120,
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) =>
          Text('Menü yüklenemedi', style: AppTypography.bodySecondary),
      data: (list) {
        final drinks = list
            .where((p) => p.stampMultiplier > 0)
            .toList(growable: false);
        return SizedBox(
          height: 138,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: drinks.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
            itemBuilder: (context, index) {
              final drink = drinks[index];
              final isSelected = selected?.id == drink.id;
              return GestureDetector(
                onTap: () => onSelected(drink),
                child: Container(
                  width: 112,
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(
                      width: 2,
                      color: isSelected
                          ? AppColors.primary
                          : Colors.transparent,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(drink.emoji, style: const TextStyle(fontSize: 26)),
                      const SizedBox(height: AppSpacing.xs),
                      // Flexible: iki satıra sarkan isimler kartı taşıramaz.
                      Flexible(
                        child: Text(
                          drink.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: AppTypography.body.copyWith(
                            fontSize: 13,
                            height: 1.2,
                          ),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        formatTl(drink.price),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.badge.copyWith(
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class _GiftRow extends StatelessWidget {
  const _GiftRow({required this.gift});

  final GiftRecord gift;

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
            decoration: const BoxDecoration(
              color: AppColors.gold,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.card_giftcard,
              size: 20,
              color: AppColors.onGold,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(gift.label, style: AppTypography.body),
                const SizedBox(height: 2),
                Text(
                  '+90 ${gift.phone} · ${formatDayMonth(gift.date)}',
                  style: AppTypography.bodySecondary.copyWith(fontSize: 13),
                ),
              ],
            ),
          ),
          Text(formatTl(gift.amount), style: AppTypography.title),
        ],
      ),
    );
  }
}
