import 'dart:async';

import 'package:barcode_widget/barcode_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../auth/application/auth_controller.dart';
import '../../rewards/application/loyalty_providers.dart';
import '../../wallet/application/wallet_providers.dart';
import '../../wallet/data/wallet_repository.dart';

/// Tara & Öde: kasada okutulan QR/barkod + bakiye yükleme.
class ScanPayScreen extends ConsumerStatefulWidget {
  const ScanPayScreen({super.key});

  @override
  ConsumerState<ScanPayScreen> createState() => _ScanPayScreenState();
}

class _ScanPayScreenState extends ConsumerState<ScanPayScreen> {
  static const _refreshSeconds = 60;

  int _tab = 0; // 0 = Öde, 1 = Bakiye Yükle
  int _secondsLeft = _refreshSeconds;
  String _code = '';
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _refreshCode();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_secondsLeft <= 1) {
        _refreshCode();
      } else {
        setState(() => _secondsLeft--);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Kasa sisteminin (Kerzz POS) çözeceği tek kullanımlık ödeme kodu.
  /// Mock'ta yerel üretilir; API modunda sunucudan 60 sn'lik token alınır.
  Future<void> _refreshCode() async {
    final phone = ref.read(authControllerProvider).value?.phone ?? '';
    try {
      final token =
          await ref.read(walletRepositoryProvider).createQrToken(phone);
      if (!mounted) return;
      setState(() {
        _code = token.code;
        _secondsLeft = _refreshSeconds;
      });
    } catch (_) {
      // Ağ hatasında eski kod görünmeye devam eder; sayaç yeniden başlar.
      if (!mounted) return;
      setState(() => _secondsLeft = _refreshSeconds);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.page),
          children: [
            Text('Tara & Öde', style: AppTypography.displayLarge),
            const SizedBox(height: AppSpacing.lg),
            _SegmentedTabs(
              selected: _tab,
              onChanged: (i) => setState(() => _tab = i),
            ),
            const SizedBox(height: AppSpacing.lg),
            if (_tab == 0) ...[
              const _DossoCard(),
              const SizedBox(height: AppSpacing.lg),
              _QrCard(code: _code, secondsLeft: _secondsLeft),
              const SizedBox(height: AppSpacing.md),
              const _StampBanner(),
              const SizedBox(height: AppSpacing.xxl),
              Text('HIZLI YÜKLEME', style: AppTypography.sectionLabel),
              const SizedBox(height: AppSpacing.md),
              const _QuickTopUpRow(),
            ] else
              const _TopUpView(),
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
              boxShadow: active
                  ? const [
                      BoxShadow(
                        color: AppColors.shadow,
                        blurRadius: 8,
                        offset: Offset(0, 2),
                      )
                    ]
                  : null,
            ),
            child: Text(
              label,
              style: AppTypography.body.copyWith(
                color:
                    active ? AppColors.textPrimary : AppColors.textSecondary,
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
      child: Row(children: [tab(0, 'Öde'), tab(1, 'Bakiye Yükle')]),
    );
  }
}

class _DossoCard extends ConsumerWidget {
  const _DossoCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(walletProvider);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, AppColors.primaryLight],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const BrandLogo(size: 48),
              const Spacer(),
              Text(
                'Dosso Kart',
                style: AppTypography.body.copyWith(color: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          wallet.when(
            loading: () => Text('••••',
                style: AppTypography.body.copyWith(color: Colors.white)),
            error: (e, _) => Text('—',
                style: AppTypography.body.copyWith(color: Colors.white)),
            data: (w) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '••••  ${w.cardLast4}',
                  style: AppTypography.body
                      .copyWith(color: Colors.white.withValues(alpha: 0.85)),
                ),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      formatTl(w.balance),
                      style: AppTypography.numberLarge
                          .copyWith(color: Colors.white, fontSize: 30),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        'Bakiye',
                        style: AppTypography.badge.copyWith(
                            color: Colors.white.withValues(alpha: 0.85)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QrCard extends StatelessWidget {
  const _QrCard({required this.code, required this.secondsLeft});

  final String code;
  final int secondsLeft;

  @override
  Widget build(BuildContext context) {
    if (code.isEmpty) {
      return Container(
        height: 280,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: const CircularProgressIndicator(color: AppColors.primary),
      );
    }
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        children: [
          QrImageView(
            data: code,
            size: 190,
            backgroundColor: Colors.white,
            eyeStyle: const QrEyeStyle(
              eyeShape: QrEyeShape.square,
              color: AppColors.textPrimary,
            ),
            dataModuleStyle: const QrDataModuleStyle(
              dataModuleShape: QrDataModuleShape.square,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          BarcodeWidget(
            barcode: Barcode.code128(),
            data: code,
            height: 48,
            drawText: false,
            color: AppColors.textPrimary,
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  value: secondsLeft / 60,
                  color: AppColors.primary,
                  backgroundColor: AppColors.divider,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'Kasada okutun · Kod $secondsLeft sn içinde yenilenir',
                style: AppTypography.bodySecondary.copyWith(fontSize: 13),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StampBanner extends StatelessWidget {
  const _StampBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceTint,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.local_cafe, size: 16, color: AppColors.primary),
          const SizedBox(width: AppSpacing.sm),
          Text(
            'Her kahvede 1 damga · ${AppConfig.stampsPerReward} damga = 1 ikram',
            style: AppTypography.bodySecondary
                .copyWith(fontSize: 13, color: AppColors.primary),
          ),
        ],
      ),
    );
  }
}

class _QuickTopUpRow extends ConsumerWidget {
  const _QuickTopUpRow();

  static const _amounts = [100.0, 250.0, 500.0];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      children: [
        for (final amount in _amounts) ...[
          if (amount != _amounts.first) const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: OutlinedButton(
              onPressed: () => confirmTopUp(context, ref, amount),
              style: OutlinedButton.styleFrom(
                backgroundColor: AppColors.surface,
                side: BorderSide.none,
                padding:
                    const EdgeInsets.symmetric(vertical: AppSpacing.lg),
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

/// Yükleme onayı — hızlı yükleme ve Bakiye Yükle sekmesi ortak kullanır.
Future<void> confirmTopUp(
    BuildContext context, WidgetRef ref, double amount) async {
  final confirmed = await showModalBottomSheet<bool>(
    context: context,
    backgroundColor: AppColors.background,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
    ),
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.page),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Bakiye Yükle', style: AppTypography.headline),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Kayıtlı kartın (Visa •7412) ile ${formatTl(amount)} yüklenecek. '
              'Bu bir simülasyondur; gerçek ödeme alınmaz.',
              style: AppTypography.bodySecondary,
            ),
            const SizedBox(height: AppSpacing.xl),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: Text('Onayla · ${formatTl(amount)}'),
            ),
          ],
        ),
      ),
    ),
  );

  if (confirmed != true || !context.mounted) return;

  final TopUpResult result;
  try {
    result = await ref.read(walletProvider.notifier).topUp(amount);
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: AppColors.danger,
        content: Text('Yükleme başarısız. Bağlantını kontrol edip tekrar dene.'),
      ),
    );
    return;
  }

  // Kampanya bonusu sunucuda (mock'ta simülasyonla) hesaplanır.
  final bonusDrinks = result.bonusDrinks;
  if (bonusDrinks > 0 && AppConfig.useMocks) {
    ref.read(loyaltyStatusProvider.notifier).addFreeDrinks(
          bonusDrinks,
          'Yükleme kampanyası — $bonusDrinks ikram kazanıldı',
        );
  }

  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      backgroundColor: AppColors.success,
      content: Text(
        bonusDrinks > 0
            ? '${formatTl(amount)} yüklendi · $bonusDrinks ikram kahve hediye! 🎉'
            : '${formatTl(amount)} yüklendi',
      ),
    ),
  );
}

class _TopUpView extends ConsumerStatefulWidget {
  const _TopUpView();

  @override
  ConsumerState<_TopUpView> createState() => _TopUpViewState();
}

class _TopUpViewState extends ConsumerState<_TopUpView> {
  static const _amounts = [100.0, 250.0, 500.0, 1000.0];
  double? _selected = 250;
  final _customController = TextEditingController();

  double? get _amount {
    final custom = double.tryParse(_customController.text.replaceAll(',', '.'));
    if (custom != null && custom > 0) return custom;
    return _selected;
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
                data: (w) => Text(formatTl(w.balance),
                    style: AppTypography.title.copyWith(fontSize: 22)),
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
              const Icon(Icons.card_giftcard, size: 18, color: AppColors.onGold),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  '${AppConfig.topUpBonusThreshold.toStringAsFixed(0)} ₺ ve üzeri yüklemeye ${AppConfig.topUpBonusDrinks} ikram kahve hediye!',
                  style: AppTypography.badge
                      .copyWith(fontSize: 13, color: AppColors.onGold),
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
                      horizontal: AppSpacing.xl, vertical: AppSpacing.md),
                  decoration: BoxDecoration(
                    color: _selected == amount &&
                            _customController.text.isEmpty
                        ? AppColors.coffeeDark
                        : AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    '${amount.toStringAsFixed(0)} ₺',
                    style: AppTypography.body.copyWith(
                      color: _selected == amount &&
                              _customController.text.isEmpty
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
            prefixIcon: Icon(Icons.edit_outlined,
                size: 20, color: AppColors.textSecondary),
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
              const Icon(Icons.credit_card, color: AppColors.primary),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text('Kayıtlı kart · Visa •7412',
                    style: AppTypography.body),
              ),
              const Icon(Icons.check_circle,
                  size: 20, color: AppColors.success),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        FilledButton(
          onPressed: amount == null
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
