import 'dart:async';

import 'package:barcode_widget/barcode_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../auth/application/guest_mode.dart';
import '../../campaigns/application/public_config.dart';
import '../../../core/network/session_scope.dart';
import '../../auth/presentation/guest_gate.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/brand_artwork.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../../routing/app_router.dart';
import '../../auth/application/auth_controller.dart';
import '../../wallet/application/wallet_providers.dart';
import '../../wallet/data/wallet_repository.dart';
import '../../wallet/domain/wallet.dart';
import 'widgets/top_up_widgets.dart';

export 'widgets/top_up_confirmation.dart' show confirmTopUp;

/// Tara & Öde: kasada okutulan QR/barkod + bakiye yükleme.
class ScanPayScreen extends ConsumerStatefulWidget {
  const ScanPayScreen({super.key, this.initialTab = 0});

  final int initialTab;

  @override
  ConsumerState<ScanPayScreen> createState() => _ScanPayScreenState();
}

class _ScanPayScreenState extends ConsumerState<ScanPayScreen>
    with WidgetsBindingObserver {
  int _tab = 0;
  int _secondsLeft = 0;
  String _code = '';
  DateTime? _expiresAt;
  Timer? _timer;
  bool _visible = false;
  bool _foreground = true;
  bool _loading = false;
  Object? _qrError;

  @override
  void initState() {
    super.initState();
    _tab = widget.initialTab;
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _visible = TickerMode.valuesOf(context).enabled;
    _schedule();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    _schedule();
  }

  void _schedule() {
    _timer?.cancel();
    if (!_visible || !_foreground || _tab != 0) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _tick();
    });
  }

  void _tick() {
    if (!mounted || !_visible || !_foreground || _tab != 0) return;
    final left = _expiresAt == null
        ? 0
        : (_expiresAt!.difference(DateTime.now()).inMilliseconds / 1000)
              .ceil()
              .clamp(0, 86400);
    if (left != _secondsLeft) {
      setState(() {
        _secondsLeft = left;
        if (left == 0) _code = '';
      });
    }
    if (left == 0 && !_loading && _qrError == null) _refreshCode();
  }

  @override
  void didUpdateWidget(covariant ScanPayScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTab != widget.initialTab) {
      _tab = widget.initialTab;
      _schedule();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _refreshCode() async {
    if (_loading || ref.read(guestModeProvider)) return;
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    final phone = ref.read(authControllerProvider).value?.phone ?? '';
    setState(() {
      _loading = true;
      _qrError = null;
      _code = '';
      _secondsLeft = 0;
    });
    try {
      final token = await ref
          .read(walletRepositoryProvider)
          .createQrToken(phone);
      if (!mounted || scope.revision != epoch) return;
      final remaining =
          (token.expiresAt.difference(DateTime.now()).inMilliseconds / 1000)
              .ceil();
      if (remaining <= 0) throw StateError('Kodun süresi doldu.');
      setState(() {
        _expiresAt = token.expiresAt;
        _code = token.code;
        _secondsLeft = remaining;
      });
    } catch (error) {
      if (mounted && scope.revision == epoch) {
        setState(() {
          _code = '';
          _secondsLeft = 0;
          _qrError = error;
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authControllerProvider, (previous, next) {
      if (previous?.value?.phone != next.value?.phone) {
        setState(() {
          _code = '';
          _expiresAt = null;
          _secondsLeft = 0;
          _qrError = null;
        });
        _schedule();
      }
    });
    // Konuk kullanıcının cüzdanı ve QR kodu yok: sekme kilitli görünür.
    if (ref.watch(guestModeProvider)) {
      return const Scaffold(
        body: SafeArea(
          child: GuestLockedView(
            title: 'Tara & Öde üyelere özel',
            message:
                'Kasada QR ile ödemek, bakiye yüklemek ve damga '
                'kazanmak için giriş yap.',
            action: 'QR ile ödemek',
          ),
        ),
      );
    }
    return Scaffold(
      body: SafeArea(
        // Üst güvenli alan kapalı: içerik ekranın tepesine kadar uzanır.
        top: false,
        bottom: false,
        child: ListView(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.page,
            MediaQuery.paddingOf(context).top + AppSpacing.page,
            AppSpacing.page,
            AppSpacing.page + MediaQuery.paddingOf(context).bottom,
          ),
          children: [
            Text('Tara & Öde', style: AppTypography.headline),
            const SizedBox(height: AppSpacing.lg),
            _SegmentedTabs(
              selected: _tab,
              onChanged: (i) {
                setState(() => _tab = i);
                _schedule();
                context.go(i == 1 ? Routes.scanPayTopUp : Routes.scanPay);
              },
            ),
            const SizedBox(height: AppSpacing.lg),
            if (_tab == 0) ...[
              const _DossoCard(),
              const SizedBox(height: AppSpacing.lg),
              _QrCard(
                code: _code,
                secondsLeft: _secondsLeft,
                error: _qrError,
                onRetry: _refreshCode,
              ),
              const SizedBox(height: AppSpacing.md),
              const _StampBanner(),
              const SizedBox(height: AppSpacing.xxl),
              Text('HIZLI YÜKLEME', style: AppTypography.sectionLabel),
              const SizedBox(height: AppSpacing.md),
              const QuickTopUpRow(),
            ] else
              const TopUpView(),
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
                      ),
                    ]
                  : null,
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
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      // Görselin köşeleri kartın yarıçapına uysun.
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          const Positioned.fill(child: BrandArtwork()),
          // Turuncu perde solda tam opak, sağa doğru incelerek görseli açar:
          // kart numarası ve bakiye rakamı solda net kalır.
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    AppColors.primary,
                    AppColors.primaryLight.withValues(alpha: 0.35),
                  ],
                  stops: const [0.45, 1],
                ),
              ),
            ),
          ),
          // Üst banda ikinci bir perde: sağ üstteki beyaz "Dosso Dossi Kart"
          // yazısı okunur kalsın; kartın alt yarısı tam renkte kalır.
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppColors.primary.withValues(alpha: 0.7),
                    AppColors.primary.withValues(alpha: 0),
                  ],
                  stops: const [0, 0.5],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: _content(wallet),
          ),
        ],
      ),
    );
  }

  Widget _content(AsyncValue<Wallet> wallet) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const BrandLogo(size: 48),
            const Spacer(),
            Text(
              'Dosso Dossi Kart',
              style: AppTypography.body.copyWith(color: Colors.white),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        wallet.when(
          loading: () => Text(
            '••••',
            style: AppTypography.body.copyWith(color: Colors.white),
          ),
          error: (e, _) => Text(
            '—',
            style: AppTypography.body.copyWith(color: Colors.white),
          ),
          data: (w) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '••••  ${w.cardLast4}',
                style: AppTypography.body.copyWith(
                  color: Colors.white.withValues(alpha: 0.85),
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatTl(w.balance),
                    style: AppTypography.numberLarge.copyWith(
                      color: Colors.white,
                      fontSize: 30,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      'Bakiye',
                      style: AppTypography.badge.copyWith(
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _QrCard extends StatelessWidget {
  const _QrCard({
    required this.code,
    required this.secondsLeft,
    this.error,
    required this.onRetry,
  });
  final Object? error;
  final VoidCallback onRetry;

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
        child: error == null
            ? const CircularProgressIndicator(color: AppColors.primary)
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Ödeme kodu yüklenemedi.'),
                  TextButton(
                    onPressed: onRetry,
                    child: const Text('Tekrar dene'),
                  ),
                ],
              ),
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
                  value: (secondsLeft / 60).clamp(0.0, 1.0),
                  color: AppColors.primary,
                  backgroundColor: AppColors.divider,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              // Flexible: dar ekranlarda tek satıra sığmayınca alta kayar.
              Flexible(
                child: Text(
                  'Kasada okutun · Kod $secondsLeft sn içinde yenilenir',
                  textAlign: TextAlign.center,
                  style: AppTypography.bodySecondary.copyWith(fontSize: 13),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StampBanner extends ConsumerWidget {
  const _StampBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
            'Her kahvede 1 damga · ${ref.watch(currentStampTargetProvider)} damga = 1 ikram',
            style: AppTypography.bodySecondary.copyWith(
              fontSize: 13,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }
}
