import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../../routing/app_router.dart';

/// "Yüklediçke Daha Çok Kazan" kampanya sayfası.
/// Basılı afişin (dosso-cuzdan-afis) mobil uyarlaması: afiş görselini olduğu
/// gibi göstermek yerine aynı içerik telefon ölçeğinde yeniden dizildi ki
/// başlıklar ve rakamlar okunur kalsın.
class CampaignYukleKazanScreen extends StatelessWidget {
  const CampaignYukleKazanScreen({super.key});

  @override
  Widget build(BuildContext context) {
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
            // Afişteki turuncu ışıma
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
                        _orange400.withValues(alpha: 0.34),
                        _orange600.withValues(alpha: 0.12),
                        Colors.transparent,
                      ],
                      stops: const [0.0, 0.4, 0.75],
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
                  AppSpacing.xxl,
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
                    Align(
                      alignment: Alignment.centerLeft,
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
                            Icon(
                              Icons.account_balance_wallet_outlined,
                              size: 16,
                              color: _gold300,
                            ),
                            const SizedBox(width: AppSpacing.md),
                            Text(
                              'DOSSO CÜZDAN',
                              style: AppTypography.badge.copyWith(
                                color: _gold300,
                                fontSize: 13,
                                letterSpacing: 2.2,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    // ── Başlık ──
                    Text.rich(
                      TextSpan(
                        text: 'Yükle\n',
                        style: AppTypography.displayLarge.copyWith(
                          color: _onDark,
                          fontSize: 40,
                          height: 1.08,
                        ),
                        children: [
                          TextSpan(
                            text: 'Kazan',
                            style: AppTypography.displayLarge.copyWith(
                              color: _gold300,
                              fontSize: 40,
                              height: 1.08,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      "İlk bakiye yüklemeni Dosso Cüzdan'a yap, 5 ikram "
                      'kahve anında cüzdanına gelsin.',
                      style: AppTypography.body.copyWith(
                        color: _onDark.withValues(alpha: 0.72),
                        fontSize: 16,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    // ── Ana teklif kutusu ──
                    const _OfferBox(),
                    const SizedBox(height: AppSpacing.lg),
                    // ── Kampanyanın tek kademesi ──
                    const Center(
                      child: _TierCard(amount: '1.000 ₺', gift: '5 kahve'),
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    // ── CTA ──
                    GestureDetector(
                      onTap: () => context.go(Routes.scanPay),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
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
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.account_balance_wallet,
                              color: Colors.white,
                              size: 22,
                            ),
                            const SizedBox(width: AppSpacing.md),
                            Text(
                              'Uygulamadan yükle',
                              style: AppTypography.button.copyWith(
                                fontSize: 17,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    // ── Kullanım süresi rozeti ──
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.lg,
                          vertical: AppSpacing.md,
                        ),
                        decoration: BoxDecoration(
                          color: _gold.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                          border: Border.all(
                            color: _gold.withValues(alpha: 0.4),
                          ),
                        ),
                        child: Text.rich(
                          TextSpan(
                            text: '60 gün ',
                            style: AppTypography.title.copyWith(
                              color: _gold300,
                              fontSize: 20,
                            ),
                            children: [
                              TextSpan(
                                text: 'hediye kahvelerini kullanma süren',
                                style: AppTypography.body.copyWith(
                                  color: _onDark.withValues(alpha: 0.8),
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    // ── Maddeler ──
                    const _Bullet(
                      icon: Icons.bolt,
                      text: 'Hediye kahveler anında tanımlanır',
                    ),
                    const _Bullet(
                      icon: Icons.qr_code_scanner,
                      text: 'Kasada QR ile öde, bakiyeden düşsün',
                    ),
                    const _Bullet(
                      icon: Icons.local_cafe,
                      text: 'Espresso bazlı tüm sıcak içeceklerde geçerli',
                    ),
                    const _Bullet(
                      icon: Icons.looks_one_outlined,
                      text: 'Tek seferlik: yalnızca ilk yüklemende geçerli',
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    // ── Künye ──
                    Text(
                      'Kampanya 31 Aralık 2026 tarihine kadar geçerlidir. '
                      'İkram yalnızca hesabındaki ilk bakiye yüklemesinde ve '
                      'bir kez verilir; ilk yükleme 1.000 ₺ altındaysa hak '
                      'düşer, sonraki yüklemelerde ikram verilmez. Hediye '
                      'kahveler yükleme sonrası uygulamana tanımlanır; 60 gün '
                      'içinde kullanılmalıdır. Espresso bazlı sıcak içecekler '
                      'için geçerlidir.',
                      style: AppTypography.bodySecondary.copyWith(
                        color: _onDark.withValues(alpha: 0.45),
                        fontSize: 12,
                        height: 1.6,
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

/// "YÜKLE 1.000 ₺ → 5 kahve hediye bizden" kutusu.
class _OfferBox extends StatelessWidget {
  const _OfferBox();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: _gold.withValues(alpha: 0.45), width: 1.5),
      ),
      child: Row(
        children: [
          // Dar ekranda sol sütun sağdaki metni ezmesin.
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'İLK YÜKLEMEYE ÖZEL',
                    maxLines: 1,
                    style: AppTypography.badge.copyWith(
                      color: _gold300.withValues(alpha: 0.9),
                      fontSize: 11,
                      letterSpacing: 1.6,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    '1.000 ₺',
                    maxLines: 1,
                    style: AppTypography.displayLarge.copyWith(
                      color: _onDark,
                      fontSize: 30,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: _orange500,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.arrow_forward,
              color: Colors.white,
              size: 18,
            ),
          ),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerRight,
                  child: Text(
                    '5 kahve',
                    style: AppTypography.displayLarge.copyWith(
                      color: _gold300,
                      fontSize: 30,
                    ),
                  ),
                ),
                Text(
                  'hediye bizden',
                  style: AppTypography.body.copyWith(
                    color: _onDark,
                    fontSize: 14,
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

/// Kampanyanın yükleme kademesi: tutar + karşılığındaki ikram.
class _TierCard extends StatelessWidget {
  const _TierCard({required this.amount, required this.gift});

  final String amount;
  final String gift;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.lg,
        horizontal: AppSpacing.xxxl,
      ),
      decoration: BoxDecoration(
        color: _gold.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: _gold.withValues(alpha: 0.55)),
      ),
      child: Column(
        children: [
          Text(
            amount,
            style: AppTypography.title.copyWith(color: _gold300, fontSize: 20),
          ),
          const SizedBox(height: 2),
          Text(
            '$gift hediye',
            style: AppTypography.bodySecondary.copyWith(
              color: _onDark.withValues(alpha: 0.6),
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: _gold.withValues(alpha: 0.35)),
            ),
            child: Icon(icon, size: 18, color: _gold300),
          ),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Text(
              text,
              style: AppTypography.body.copyWith(color: _onDark, fontSize: 15),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Afiş paleti: campaign_kahve_screen.dart ile aynı ──
const _bgTop = Color(0xFF301D11);
const _bgMid = Color(0xFF2A1B12);
const _bgBottom = Color(0xFF20140C);
const _orange400 = Color(0xFFF1832A);
const _orange500 = Color(0xFFE86A10);
const _orange600 = Color(0xFFC55408);
const _gold = Color(0xFFD9A13B);
const _gold300 = Color(0xFFE8BE68);
const _onDark = Color(0xFFFFF9F2);
