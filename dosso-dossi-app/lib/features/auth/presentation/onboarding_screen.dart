import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../../core/widgets/coffee_bean_icon.dart';
import '../../../routing/app_router.dart';

/// Uygulama tanıtımı — girişten önceki kaydırmalı karşılama akışı.
/// Her sayfa bir özelliği anlatır: QR ile ödeme, damga, hediye.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
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
      backgroundColor: AppColors.coffeeDark,
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
              onSkip: () => context.go(Routes.login),
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
        // Üst bölüm: koyu zemin üzerinde illüstrasyon.
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
                          color: Colors.white.withValues(alpha: 0.05),
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
                child: const Text('Atla'),
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
                    child: const Icon(
                      Icons.card_giftcard,
                      size: 18,
                      color: AppColors.onGold,
                    ),
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
            left: 48,
            bottom: 22,
            child: _GiftBox(size: 110),
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

class _GiftBox extends StatelessWidget {
  const _GiftBox({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    final ribbon = size * 0.16;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          // Gövde
          Positioned(
            top: size * 0.26,
            left: size * 0.06,
            right: size * 0.06,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(size * 0.10),
              ),
            ),
          ),
          // Kapak
          Positioned(
            top: size * 0.16,
            left: 0,
            right: 0,
            child: Container(
              height: size * 0.16,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(size * 0.06),
              ),
            ),
          ),
          // Dikey kurdele
          Positioned(
            top: size * 0.16,
            bottom: 0,
            child: Container(width: ribbon, color: AppColors.gold),
          ),
          // Fiyonk
          Positioned(
            top: 0,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Transform.rotate(
                  angle: -0.5,
                  child: _bowLoop(),
                ),
                SizedBox(width: size * 0.02),
                Transform.rotate(
                  angle: 0.5,
                  child: _bowLoop(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _bowLoop() => Container(
        width: size * 0.24,
        height: size * 0.16,
        decoration: BoxDecoration(
          color: AppColors.gold,
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
      );
}

/// Kapaklı karton bardak; gövdesindeki bandın üstünde marka logosu taşır.
class _BrandCup extends StatelessWidget {
  const _BrandCup({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    final width = height * 0.74;
    return SizedBox(
      width: width,
      height: height,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned.fill(child: CustomPaint(painter: _CupPainter())),
          // Logo, banda basılı damga gibi bardağın ortasında.
          Positioned(
            top: height * 0.44,
            child: BrandLogo(size: width * 0.52),
          ),
        ],
      ),
    );
  }
}

class _CupPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Kapak: üst kubbe + geniş kenar.
    final lidPaint = Paint()..color = AppColors.primary;
    canvas.drawRRect(
      RRect.fromRectAndCorners(
        Rect.fromLTRB(w * 0.14, h * 0.02, w * 0.86, h * 0.12),
        topLeft: Radius.circular(w * 0.08),
        topRight: Radius.circular(w * 0.08),
      ),
      lidPaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTRB(w * 0.02, h * 0.10, w * 0.98, h * 0.185),
        Radius.circular(w * 0.04),
      ),
      Paint()
        ..color = Color.lerp(AppColors.primary, AppColors.coffeeDark, 0.25)!,
    );

    // Gövde: alta doğru daralan, alt köşeleri yuvarlatılmış karton bardak.
    final body = Path()
      ..moveTo(w * 0.07, h * 0.185)
      ..lineTo(w * 0.93, h * 0.185)
      ..lineTo(w * 0.81, h * 0.955)
      ..quadraticBezierTo(w * 0.80, h, w * 0.74, h)
      ..lineTo(w * 0.26, h)
      ..quadraticBezierTo(w * 0.20, h, w * 0.19, h * 0.955)
      ..close();
    canvas.drawPath(body, Paint()..color = const Color(0xFFFBF6EC));

    // Bant (kraft şerit): gövde şekliyle kırpılır, logo bunun üstüne oturur.
    canvas.save();
    canvas.clipPath(body);
    canvas.drawRect(
      Rect.fromLTRB(0, h * 0.42, w, h * 0.80),
      Paint()..color = AppColors.gold,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_CupPainter oldDelegate) => false;
}
