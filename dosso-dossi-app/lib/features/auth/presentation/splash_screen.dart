import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../../core/widgets/coffee_bean_icon.dart';

/// Açılış animasyonu tamamlanana kadar router'ı splash'te tutan bekletme.
/// Uygulama her soğuk başlatıldığında bir kez çalışır.
final splashHoldProvider = FutureProvider<void>((ref) {
  // Testlerde bekletme yok: pumpAndSettle açılış animasyonuna takılmasın.
  if (Platform.environment.containsKey('FLUTTER_TEST')) {
    return Future<void>.value();
  }
  return Future<void>.delayed(const Duration(milliseconds: 3000));
});

/// Oturum kontrolü sırasında ve açılışta gösterilen marka animasyonu:
/// dalga halkaları içinde beliren logo, çizilen altın çember,
/// yukarı süzülen kahve çekirdekleri ve marka yazısı.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late final AnimationController _intro =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 2600))
        ..forward();
  late final AnimationController _loop =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 2400))
        ..repeat();

  @override
  void dispose() {
    _intro.dispose();
    _loop.dispose();
    super.dispose();
  }

  /// Ana animasyonun [a, b] aralığındaki ilerlemesi (0–1).
  double _seg(double a, double b, [Curve curve = Curves.easeOut]) {
    final t = ((_intro.value - a) / (b - a)).clamp(0.0, 1.0);
    return curve.transform(t);
  }

  // Arka planda süzülen çekirdekler: (x, y ekran oranı, boy, faz, açı, opaklık)
  static const _beans = [
    (0.10, 0.16, 26.0, 0.00, 0.5, 0.16),
    (0.84, 0.12, 20.0, 0.35, -0.7, 0.13),
    (0.16, 0.74, 22.0, 0.55, 0.9, 0.14),
    (0.88, 0.68, 28.0, 0.20, -0.4, 0.16),
    (0.06, 0.44, 16.0, 0.75, 1.3, 0.11),
    (0.92, 0.40, 18.0, 0.10, 0.2, 0.12),
    (0.26, 0.06, 16.0, 0.60, -1.0, 0.11),
    (0.70, 0.86, 24.0, 0.45, 0.7, 0.14),
  ];

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.coffeeDark,
        body: AnimatedBuilder(
          animation: Listenable.merge([_intro, _loop]),
          builder: (context, _) {
            final loop = _loop.value;
            final beanFade = _seg(0.40, 0.90);
            return Stack(
              children: [
                // Zemin: merkezi hafif aydınlık radyal gradyan
                const Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        radius: 1.0,
                        colors: [Color(0xFF3B2B20), AppColors.coffeeDark],
                      ),
                    ),
                  ),
                ),
                // Süzülen çekirdekler
                for (final (x, y, s, ph, rot, op) in _beans)
                  Positioned(
                    left: x * size.width - s / 2,
                    top: y * size.height -
                        s / 2 -
                        10 * math.sin(2 * math.pi * (loop + ph)),
                    child: Opacity(
                      opacity: op * beanFade,
                      child: Transform.rotate(
                        angle: rot + 0.15 * math.sin(2 * math.pi * (loop + ph)),
                        child: CoffeeBeanIcon(size: s, color: AppColors.gold),
                      ),
                    ),
                  ),
                Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildLogo(loop),
                      const SizedBox(height: 28),
                      _buildTitle(),
                      const SizedBox(height: 10),
                      _buildSubtitle(),
                      const SizedBox(height: 40),
                      _buildLoaderBeans(loop),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildLogo(double loop) {
    final entry = _seg(0.12, 0.60, Curves.elasticOut);
    final fade = _seg(0.12, 0.30);
    // Yerleştikten sonra hafif "nefes alma"
    final breath = 1 + 0.015 * math.sin(2 * math.pi * loop) * _seg(0.6, 1.0);
    return SizedBox(
      width: 260,
      height: 260,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Kahve damlası dalgası: dışa yayılan halkalar
          CustomPaint(
            size: const Size.square(260),
            painter: _RipplePainter(
              progress: loop,
              opacity: _seg(0.35, 0.7),
            ),
          ),
          // Logonun çevresine çizilen altın çember
          CustomPaint(
            size: const Size.square(176),
            painter: _ArcPainter(
              sweep: _seg(0.30, 0.78, Curves.easeInOutCubic),
            ),
          ),
          Transform.rotate(
            angle: (1 - _seg(0.12, 0.60, Curves.easeOutCubic)) * -0.5,
            child: Transform.scale(
              scale: entry * breath,
              child: Opacity(
                opacity: fade,
                child: const BrandLogo(size: 148),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTitle() {
    final v = _seg(0.50, 0.72, Curves.easeOutCubic);
    return Opacity(
      opacity: v,
      child: Transform.translate(
        offset: Offset(0, (1 - v) * 26),
        child: Text(
          'Dosso Dossi',
          style: AppTypography.displayLarge.copyWith(
            color: AppColors.textOnDark,
            fontSize: 36,
          ),
        ),
      ),
    );
  }

  Widget _buildSubtitle() {
    final v = _seg(0.60, 0.84, Curves.easeOutCubic);
    return Opacity(
      opacity: v,
      child: Text(
        'COFFEE',
        style: AppTypography.sectionLabel.copyWith(
          color: AppColors.goldOnDark,
          fontSize: 15,
          letterSpacing: 3 + 9 * v,
        ),
      ),
    );
  }

  /// Yükleme göstergesi: sırayla beliren, ritimle zıplayan 3 çekirdek.
  Widget _buildLoaderBeans(double loop) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < 3; i++)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Transform.translate(
              offset: Offset(
                0,
                -4 *
                    math.sin(2 * math.pi * (loop * 2 - i * 0.18))
                        .clamp(0.0, 1.0) *
                    _seg(0.9, 1.0),
              ),
              child: Transform.scale(
                scale: _seg(0.70 + i * 0.08, 0.82 + i * 0.08, Curves.elasticOut),
                child: CoffeeBeanIcon(
                  size: 15,
                  color: i == 1 ? AppColors.gold : AppColors.primary,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Merkezden dışa yayılıp sönen dalga halkaları (kahveye damla düşmüş gibi).
class _RipplePainter extends CustomPainter {
  const _RipplePainter({required this.progress, required this.opacity});

  final double progress;
  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    if (opacity <= 0) return;
    final center = size.center(Offset.zero);
    final maxR = size.shortestSide / 2;
    // İki halka: aynı dalganın yarım faz arayla tekrarı
    for (final phase in const [0.0, 0.5]) {
      final p = (progress + phase) % 1.0;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..color = AppColors.primary
            .withValues(alpha: (1 - p) * 0.30 * opacity);
      canvas.drawCircle(center, maxR * (0.62 + 0.38 * p), paint);
    }
  }

  @override
  bool shouldRepaint(_RipplePainter old) =>
      old.progress != progress || old.opacity != opacity;
}

/// Logo çevresinde saat yönünde çizilen altın çember.
class _ArcPainter extends CustomPainter {
  const _ArcPainter({required this.sweep});

  final double sweep;

  @override
  void paint(Canvas canvas, Size size) {
    if (sweep <= 0) return;
    final rect = Offset.zero & size;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..color = AppColors.goldOnDark;
    canvas.drawArc(
      rect.deflate(1.5),
      -math.pi / 2,
      sweep * 2 * math.pi,
      false,
      paint,
    );
  }

  @override
  bool shouldRepaint(_ArcPainter old) => old.sweep != sweep;
}
