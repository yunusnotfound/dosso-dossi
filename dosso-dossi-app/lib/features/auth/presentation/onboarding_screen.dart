import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/coffee_bean_icon.dart';
import '../../../core/widgets/mini_brand_cup.dart';
import '../../../routing/app_router.dart';
import '../application/guest_mode.dart';

/// Uygulama tanıtımı — girişten önceki kaydırmalı karşılama akışı.
/// Her sayfa bir özelliği anlatır: QR ile ödeme, damga, hediye.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  static final _pages = [
    _PageData(
      title: 'QR Okut & Öde',
      description:
          'Kasada QR kodunu okut, saniyeler içinde öde. Cüzdanına TL '
          'yükleyebilir veya kayıtlı kartınla ödeme yapabilirsin.',
      illustration: const _QrIllustration(),
    ),
    _PageData(
      title: 'Damga Kazan',
      description:
          'Uygulamayla aldığın her kahve 1 damga kazandırır. '
          '${AppConfig.stampsPerReward} damgayı topla, ikram kahveni kap.',
      illustration: const _StampIllustration(),
    ),
    _PageData(
      title: 'Arkadaşına Hediye Et',
      description:
          'Sevdiklerine uygulamadan kahve gönder; hediye kodunu kasada '
          'okutsun, ikramını alsın.',
      illustration: const _GiftIllustration(),
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _isLast => _index == _pages.length - 1;

  /// Üye olmadan devam: konuk moduna geçip ana sayfayı açar.
  Future<void> _continueAsGuest() async {
    await ref.read(guestModeProvider.notifier).enter();
    if (mounted) context.go(Routes.home);
  }

  void _next() {
    if (_isLast) {
      context.go(Routes.login);
    } else {
      _controller.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      // Zemin marka kremi (PANTONE 482 PC).
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: _pages.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (context, i) => _OnboardingPage(
              data: _pages[i],
              buttonLabel: i == _pages.length - 1 ? 'Telefonla Devam Et' : 'Devam',
              onNext: _next,
              onSkip: _continueAsGuest,
            ),
          ),
          // Sayfa noktaları: kaydırmadan etkilenmesin diye sabit katmanda.
          Positioned(
            left: 0,
            right: 0,
            bottom: bottomInset + AppSpacing.md,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < _pages.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeOut,
                    margin:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
                    width: i == _index ? 22 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: i == _index
                          ? AppColors.primary
                          : AppColors.textSecondary.withValues(alpha: 0.35),
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PageData {
  const _PageData({
    required this.title,
    required this.description,
    required this.illustration,
  });

  final String title;
  final String description;
  final Widget illustration;
}

class _OnboardingPage extends StatelessWidget {
  const _OnboardingPage({
    required this.data,
    required this.buttonLabel,
    required this.onNext,
    required this.onSkip,
  });

  final _PageData data;
  final String buttonLabel;
  final VoidCallback onNext;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Column(
      children: [
        // Üst bölüm: krem zemin üzerinde illüstrasyon.
        Expanded(
          child: SafeArea(
            bottom: false,
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.page),
                // Küçük ekranlarda taşmak yerine oranıyla küçülür.
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 300,
                        height: 300,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          // Aydınlık zeminde halka beyazla kaybolur; kahve
                          // tonunun en soluk hâli kullanılır.
                          color: AppColors.coffeeDark.withValues(alpha: 0.05),
                        ),
                      ),
                      data.illustration,
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        // Alt bölüm: beyaz kart — başlık, açıklama, butonlar.
        Container(
          width: double.infinity,
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          padding: EdgeInsets.fromLTRB(
            AppSpacing.page,
            AppSpacing.xxl,
            AppSpacing.page,
            // Sabit noktalara yer bırak (nokta katmanı bunun üstüne oturur).
            bottomInset + AppSpacing.xxxl,
          ),
          child: Column(
            children: [
              Text(
                data.title,
                textAlign: TextAlign.center,
                style: AppTypography.displayLarge.copyWith(fontSize: 26),
              ),
              const SizedBox(height: AppSpacing.sm),
              // En az bu yükseklik: kart sınırı sayfalar arasında zıplamasın.
              // Uzun açıklama/büyük yazı ölçeğinde taşmak yerine kısalır.
              ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 66),
                child: Text(
                  data.description,
                  textAlign: TextAlign.center,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodySecondary.copyWith(
                    fontSize: 15,
                    height: 1.4,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              FilledButton(onPressed: onNext, child: Text(buttonLabel)),
              const SizedBox(height: AppSpacing.md),
              OutlinedButton(
                onPressed: onSkip,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(56),
                  foregroundColor: AppColors.textPrimary,
                  side: BorderSide(
                    color: AppColors.textSecondary.withValues(alpha: 0.35),
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  textStyle: AppTypography.button,
                ),
                child: const Text('Üye olmadan devam et'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── İllüstrasyonlar ───────────────────────────────────────────────

/// Sayfa 1: QR kodlu telefon + logolu bardak.
class _QrIllustration extends StatelessWidget {
  const _QrIllustration();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 300,
      height: 300,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned(
            left: 46,
            top: 4,
            child: _PhoneWithQr(),
          ),
          const Positioned(
            right: 34,
            bottom: 0,
            child: _BrandCup(height: 150),
          ),
        ],
      ),
    );
  }
}

class _PhoneWithQr extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 156,
      height: 264,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFF4A3A2F), width: 7),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Hoparlör çentiği
          Positioned(
            top: 10,
            child: Container(
              width: 44,
              height: 6,
              decoration: BoxDecoration(
                color: const Color(0xFF4A3A2F),
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
            ),
          ),
          // QR kod + tarayıcı köşeleri
          CustomPaint(
            foregroundPainter: _ScanFramePainter(AppColors.primary),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: QrImageView(
                data: 'https://dossodossi.coffee',
                version: QrVersions.auto,
                size: 96,
                padding: EdgeInsets.zero,
                backgroundColor: Colors.white,
                eyeStyle: const QrEyeStyle(
                  eyeShape: QrEyeShape.square,
                  color: AppColors.coffeeDark,
                ),
                dataModuleStyle: const QrDataModuleStyle(
                  dataModuleShape: QrDataModuleShape.square,
                  color: AppColors.coffeeDark,
                ),
              ),
            ),
          ),
          // Tarama çizgisi
          Positioned(
            top: 118,
            left: 16,
            right: 16,
            child: Container(
              height: 3,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
            ),
          ),
          // Ana ekran çubuğu
          Positioned(
            bottom: 8,
            child: Container(
              width: 52,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// QR alanının çevresine tarayıcı köşe parantezleri çizer.
class _ScanFramePainter extends CustomPainter {
  const _ScanFramePainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;
    const len = 16.0;
    final r = Rect.fromCenter(
      center: size.center(Offset.zero),
      width: 124,
      height: 124,
    );

    void corner(Offset at, double dx, double dy) {
      canvas.drawLine(at, at + Offset(dx * len, 0), paint);
      canvas.drawLine(at, at + Offset(0, dy * len), paint);
    }

    corner(r.topLeft, 1, 1);
    corner(r.topRight, -1, 1);
    corner(r.bottomLeft, 1, -1);
    corner(r.bottomRight, -1, -1);
  }

  @override
  bool shouldRepaint(_ScanFramePainter oldDelegate) =>
      oldDelegate.color != color;
}

/// Sayfa 2: büyük bardak + damga kartı şeridi.
class _StampIllustration extends StatelessWidget {
  const _StampIllustration();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 300,
      height: 300,
      child: Stack(
        alignment: Alignment.center,
        children: [
          const Positioned(
            top: 6,
            child: _BrandCup(height: 200),
          ),
          Positioned(
            bottom: 18,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                boxShadow: const [
                  BoxShadow(
                    color: AppColors.shadow,
                    blurRadius: 12,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (var i = 0; i < AppConfig.stampsPerReward - 1; i++)
                    Container(
                      width: 36,
                      height: 36,
                      margin: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.xs,
                      ),
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.primary,
                      ),
                      child: const CoffeeBeanIcon(size: 20, color: Colors.white),
                    ),
                  Container(
                    width: 36,
                    height: 36,
                    margin:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.gold,
                    ),
                    // Ödül halkası: elle çizilmiş bardağın küçük hâli.
                    child: const MiniBrandCup(height: 26),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sayfa 3: hediye kutusu + logolu bardak.
class _GiftIllustration extends StatelessWidget {
  const _GiftIllustration();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 300,
      height: 300,
      child: Stack(
        alignment: Alignment.center,
        children: [
          const Positioned(
            right: 52,
            top: 24,
            child: _BrandCup(height: 180),
          ),
          Positioned(
            left: 34,
            bottom: 14,
            child: Image.asset(
              'assets/images/onboarding_hediye_kutusu.png',
              width: 140,
              fit: BoxFit.contain,
            ),
          ),
          const Positioned(
            left: 60,
            top: 52,
            child: Icon(Icons.auto_awesome, size: 26, color: AppColors.gold),
          ),
          const Positioned(
            right: 40,
            bottom: 66,
            child: Icon(Icons.favorite, size: 22, color: AppColors.primary),
          ),
        ],
      ),
    );
  }
}

/// Marka bardağı: turuncu kapaklı, logolu gerçek ürün fotoğrafı.
/// Genişlik, görselin kendi en/boy oranından (471×725) türetilir.
class _BrandCup extends StatelessWidget {
  const _BrandCup({required this.height});

  static const _aspect = 471 / 725;

  final double height;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/images/onboarding_bardak.png',
      height: height,
      width: height * _aspect,
      fit: BoxFit.contain,
      // Retina'da yeniden boyutlandırma maliyetini düşürür.
      cacheHeight: (height * 3).round(),
    );
  }
}
