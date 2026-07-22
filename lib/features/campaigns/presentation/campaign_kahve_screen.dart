import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../../routing/app_router.dart';
import '../../rewards/application/loyalty_providers.dart';

/// "Kahve İçtikçe Kahve Kazan" kampanya sayfası.
/// Resmi afişin (yukle-kazan-afis-standalone.html) birebir uygulama uyarlaması:
/// koyu kahve zemin, altın degrade "1", numaralı fincan dizisi.
/// Fincanlar kullanıcının GERÇEK damga durumuyla dolar.
class CampaignKahveScreen extends ConsumerStatefulWidget {
  const CampaignKahveScreen({super.key});

  @override
  ConsumerState<CampaignKahveScreen> createState() =>
      _CampaignKahveScreenState();
}

// ── Afiş renk paleti (HTML :root değerleri) ──
const _bgTop = Color(0xFF301D11);
const _bgMid = Color(0xFF2A1B12);
const _bgBottom = Color(0xFF20140C);
const _orange400 = Color(0xFFF1832A);
const _orange500 = Color(0xFFE86A10);
const _orange600 = Color(0xFFC55408);
const _gold = Color(0xFFD9A13B);
const _gold300 = Color(0xFFE8BE68);
const _onDark = Color(0xFFFFF9F2);

class _CampaignKahveScreenState extends ConsumerState<CampaignKahveScreen>
    with TickerProviderStateMixin {
  /// Fincanların sırayla dolma animasyonu
  late final AnimationController _stampController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  )..forward();

  /// ÜCRETSİZ fincanının nabız animasyonu
  late final AnimationController _pulseController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _stampController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  void _replayStamps() {
    HapticFeedback.lightImpact();
    _stampController.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final loyalty = ref.watch(loyaltyStatusProvider).value;
    final stamps = loyalty?.stamps ?? 0;
    final target = loyalty?.target ?? 5;
    final rewardReady = (loyalty?.freeDrinks ?? 0) > 0 || stamps >= target;

    return Scaffold(
      backgroundColor: _bgBottom,
      body: Container(
        constraints: const BoxConstraints.expand(),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [_bgTop, _bgMid, _bgBottom],
            stops: [0.0, 0.46, 1.0],
          ),
        ),
        child: Stack(
          children: [
            // Üstte turuncu, altta altın ışıma (afişteki radial glow'lar)
            Positioned(
              top: -180,
              left: -120,
              right: -120,
              height: 520,
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      colors: [
                        _orange400.withValues(alpha: 0.38),
                        _orange600.withValues(alpha: 0.14),
                        Colors.transparent,
                      ],
                      stops: const [0.0, 0.4, 0.75],
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: -220,
              left: -80,
              right: -80,
              height: 420,
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      colors: [
                        _gold.withValues(alpha: 0.24),
                        Colors.transparent,
                      ],
                      stops: const [0.0, 0.65],
                    ),
                  ),
                ),
              ),
            ),
            // Zemindeki nokta dokusu
            const Positioned.fill(
              child: IgnorePointer(child: CustomPaint(painter: _DotsPainter())),
            ),
            // Dev filigran "5"
            Positioned.fill(
              child: IgnorePointer(
                child: Align(
                  alignment: const Alignment(0, 0.1),
                  child: Text(
                    '5',
                    style: AppTypography.displayLarge.copyWith(
                      fontSize: 420,
                      height: 0.8,
                      color: _onDark.withValues(alpha: 0.035),
                    ),
                  ),
                ),
              ),
            ),
            SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.page,
                  AppSpacing.sm,
                  AppSpacing.page,
                  AppSpacing.xl,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ── Logo + geri ──
                    SizedBox(
                      height: 104,
                      child: Stack(
                        children: [
                          const Center(child: BrandLogo(size: 96)),
                          Positioned(
                            left: 0,
                            top: 4,
                            child: CircleAvatar(
                              backgroundColor: Colors.white.withValues(
                                alpha: 0.14,
                              ),
                              child: BackButton(
                                color: _onDark,
                                onPressed: () => context.pop(),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    // ── Eyebrow rozeti ──
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xl,
                          vertical: AppSpacing.md,
                        ),
                        decoration: BoxDecoration(
                          color: _gold.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                          border: Border.all(
                            color: _gold.withValues(alpha: 0.5),
                            width: 1.5,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const _EyebrowDot(),
                            const SizedBox(width: AppSpacing.md),
                            Text(
                              'KAHVE İÇTİKÇE · KAHVE KAZAN',
                              style: AppTypography.badge.copyWith(
                                color: _gold300,
                                fontSize: 13,
                                letterSpacing: 2.2,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.md),
                            const _EyebrowDot(),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    // ── Başlık: "5 kahve sizden / 1 / KAHVE BİZDEN" ──
                    Text.rich(
                      TextSpan(
                        text: '5 kahve',
                        style: AppTypography.displayLarge.copyWith(
                          color: _orange400,
                          fontSize: 32,
                        ),
                        children: [
                          TextSpan(
                            text: ' sizden',
                            style: AppTypography.displayLarge.copyWith(
                              color: _onDark,
                              fontSize: 32,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      textAlign: TextAlign.center,
                    ),
                    // Altın degrade dev "1"
                    ShaderMask(
                      shaderCallback: (bounds) => const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Color(0xFFFCE7BE),
                          Color(0xFFEAB559),
                          Color(0xFFD9A13B),
                          Color(0xFFB67E22),
                        ],
                        stops: [0.04, 0.34, 0.62, 1.0],
                      ).createShader(bounds),
                      child: Text(
                        '1',
                        textAlign: TextAlign.center,
                        style: AppTypography.displayLarge.copyWith(
                          color: Colors.white,
                          fontSize: 150,
                          height: 0.9,
                        ),
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const _Rule(),
                        const SizedBox(width: AppSpacing.lg),
                        Text(
                          'KAHVE BİZDEN',
                          style: AppTypography.displayLarge.copyWith(
                            color: _onDark,
                            fontSize: 30,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.lg),
                        const _Rule(),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    // ── Fincan dizisi (canlı damga durumu) ──
                    GestureDetector(
                      onTap: _replayStamps,
                      child: AnimatedBuilder(
                        animation: _stampController,
                        // FittedBox: dar ekranlarda fincan dizisi taşmak
                        // yerine oranlı küçülür.
                        builder: (context, _) => FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              for (var i = 0; i < target - 1; i++) ...[
                                _Cup(
                                  number: i + 1,
                                  earned: i < stamps,
                                  scale: CurvedAnimation(
                                    parent: _stampController,
                                    curve: Interval(
                                      (i * 0.14).clamp(0, 0.8),
                                      ((i * 0.14) + 0.4).clamp(0.05, 1),
                                      curve: Curves.elasticOut,
                                    ),
                                  ).value,
                                ),
                                const _Plus(),
                              ],
                              _GiftCup(
                                ready: rewardReady,
                                lastEarned: stamps >= target,
                                pulse: _pulseController,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    // ── Değer şeridi ──
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xxl,
                          vertical: AppSpacing.lg,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.28),
                          borderRadius: BorderRadius.circular(AppRadius.lg),
                          border: Border.all(
                            color: _onDark.withValues(alpha: 0.12),
                            width: 1.5,
                          ),
                        ),
                        child: Text.rich(
                          TextSpan(
                            text: '5 damga',
                            style: AppTypography.title.copyWith(
                              color: _onDark,
                              fontSize: 22,
                            ),
                            children: [
                              TextSpan(
                                text: '  =  ',
                                style: AppTypography.body.copyWith(
                                  color: _onDark.withValues(alpha: 0.66),
                                  fontSize: 16,
                                ),
                              ),
                              TextSpan(
                                text: '1 ücretsiz kahve',
                                style: AppTypography.title.copyWith(
                                  color: _gold300,
                                  fontSize: 22,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    // ── CTA ──
                    Center(
                      child: GestureDetector(
                        onTap: () => context.push(Routes.rewards),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.xxxl,
                            vertical: AppSpacing.lg,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(AppRadius.pill),
                            gradient: const LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [_orange500, _orange600],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: _orange600.withValues(alpha: 0.5),
                                blurRadius: 30,
                                offset: const Offset(0, 12),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.credit_card,
                                color: Colors.white,
                                size: 22,
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Text(
                                'Sadakat kartını kasadan iste',
                                style: AppTypography.button.copyWith(
                                  fontSize: 17,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    Text(
                      'Sadakat kartınızı kasadan isteyin, damgaları biriktirin, '
                      'kahve keyfinize biz de ortak olalım.',
                      textAlign: TextAlign.center,
                      style: AppTypography.bodySecondary.copyWith(
                        color: _onDark.withValues(alpha: 0.66),
                        fontSize: 14,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EyebrowDot extends StatelessWidget {
  const _EyebrowDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: 8,
      decoration: const BoxDecoration(color: _gold300, shape: BoxShape.circle),
    );
  }
}

class _Rule extends StatelessWidget {
  const _Rule();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 3,
      decoration: BoxDecoration(
        color: _onDark.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }
}

/// Numaralı fincan — kazanılmış damgalar turuncu dolar.
class _Cup extends StatelessWidget {
  const _Cup({required this.number, required this.earned, required this.scale});

  final int number;
  final bool earned;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Transform.scale(
          scale: earned ? scale.clamp(0, 1.2) : 1,
          child: Container(
            width: 46,
            height: 46,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: earned ? _orange500 : _onDark.withValues(alpha: 0.06),
              border: earned
                  ? null
                  : Border.all(
                      color: _onDark.withValues(alpha: 0.16),
                      width: 2,
                    ),
            ),
            child: Icon(
              Icons.coffee,
              size: 22,
              color: earned ? Colors.white : _onDark.withValues(alpha: 0.66),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          '$number',
          style: AppTypography.title.copyWith(
            color: earned ? _orange400 : _onDark.withValues(alpha: 0.66),
            fontSize: 16,
          ),
        ),
      ],
    );
  }
}

class _Plus extends StatelessWidget {
  const _Plus();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '+',
            style: AppTypography.title.copyWith(color: _gold300, fontSize: 24),
          ),
          const SizedBox(height: 26),
        ],
      ),
    );
  }
}

/// Altın "ÜCRETSİZ" fincanı — ikram hazırsa nabız gibi atar.
class _GiftCup extends StatelessWidget {
  const _GiftCup({
    required this.ready,
    required this.lastEarned,
    required this.pulse,
  });

  final bool ready;
  final bool lastEarned;
  final AnimationController pulse;

  @override
  Widget build(BuildContext context) {
    final circle = Container(
      width: 60,
      height: 60,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF0C979), _gold, Color(0xFFB67E22)],
        ),
        border: Border.all(color: _onDark.withValues(alpha: 0.35), width: 2),
        boxShadow: [
          BoxShadow(
            color: _gold.withValues(alpha: ready ? 0.45 : 0.25),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: const Icon(Icons.coffee, size: 30, color: _bgMid),
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ready
            ? AnimatedBuilder(
                animation: pulse,
                builder: (context, child) => Transform.scale(
                  scale: 1 + pulse.value * 0.08,
                  child: child,
                ),
                child: circle,
              )
            : circle,
        const SizedBox(height: AppSpacing.sm),
        Text(
          'ÜCRETSİZ',
          style: AppTypography.badge.copyWith(
            color: _gold300,
            fontSize: 13,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

/// Zemindeki soluk nokta dokusu (afişteki bean texture).
class _DotsPainter extends CustomPainter {
  const _DotsPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    for (double y = 23; y < size.height; y += 46) {
      for (double x = 23; x < size.width; x += 46) {
        canvas.drawCircle(Offset(x, y), 1.5, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
