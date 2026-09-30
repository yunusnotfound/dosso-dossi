import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/coffee_bean_icon.dart';
import '../../../../core/widgets/mini_brand_cup.dart';
import '../../../../routing/app_router.dart';
import '../../../auth/application/guest_mode.dart';
import '../../../auth/presentation/guest_gate.dart';
import '../../../rewards/application/loyalty_providers.dart';
import '../../../rewards/domain/loyalty_status.dart';
import '../../../rewards/presentation/loyalty_how_it_works_sheet.dart';

/// Ana sayfadaki damga kartı: tablo arka planı + 3/5 ilerleme + damga rozetleri.
class StampCard extends ConsumerWidget {
  const StampCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Konuk kullanıcının damgası yok: kartın yerinde giriş çağrısı durur.
    if (ref.watch(guestModeProvider)) {
      return _shell(const _GuestStampContent());
    }
    final loyalty = ref.watch(loyaltyStatusProvider);
    return _shell(
      loyalty.when(
        loading: () => const SizedBox(
          height: 140,
          child: Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          ),
        ),
        error: (e, _) => SizedBox(
          height: 140,
          child: Center(
            child: Text(
              'Damga bilgisi yüklenemedi',
              style: AppTypography.body.copyWith(color: AppColors.textPrimary),
            ),
          ),
        ),
        data: (status) => LoyaltyStampContent(
          status: status,
          onRewardsPressed: () => context.push(Routes.rewards),
        ),
      ),
    );
  }

  /// Damgalar doğrudan tablo üzerinde durur; yalnızca iç boşluk korunur.
  Widget _shell(Widget child) {
    return Padding(padding: const EdgeInsets.all(AppSpacing.xl), child: child);
  }
}

/// Konuk kullanıcıya damga kartının yerinde gösterilen giriş çağrısı.
class _GuestStampContent extends ConsumerWidget {
  const _GuestStampContent();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Damga biriktirmeye başla',
          style: AppTypography.title.copyWith(color: const Color(0xFF120B06)),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Üye ol, her kahvende damga kazan; 5. kahven bizden.',
          style: AppTypography.body.copyWith(color: const Color(0xFF120B06)),
        ),
        const SizedBox(height: AppSpacing.lg),
        Align(
          alignment: Alignment.centerLeft,
          child: FilledButton(
            onPressed: () =>
                showGuestSignInSheet(context, ref, action: 'Damga biriktirmek'),
            child: const Text('Giriş yap / Üye ol'),
          ),
        ),
      ],
    );
  }
}

/// Ana sayfa ve İkramlarım ekranının ortak damga düzeni.
class LoyaltyStampContent extends StatelessWidget {
  const LoyaltyStampContent({
    super.key,
    required this.status,
    this.onRewardsPressed,
  });

  final LoyaltyStatus status;

  /// Yalnızca ana sayfada alt eylem şeridi gösterilir.
  final VoidCallback? onRewardsPressed;

  /// Canlı tablo zemininde yazı rengi: neredeyse siyah kahve.
  static const Color _muted = Color(0xFF120B06);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  width: 44,
                  height: 44,
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    shape: BoxShape.circle,
                  ),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text.rich(
                      TextSpan(
                        text: '${status.stamps}',
                        children: [
                          TextSpan(
                            text: '/${status.target}',
                            style: const TextStyle(color: Colors.black),
                          ),
                        ],
                      ),
                      style: AppTypography.title.copyWith(
                        fontSize: 20,
                        height: 1,
                        color: AppColors.primary,
                      ),
                      maxLines: 1,
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
            ),
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.card_giftcard,
                size: 22,
                color: AppColors.primary,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xl),
        // Damgalar ayrı beyaz dairelerde; dar ekranda birlikte küçülür.
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(status.target, (i) {
              final isLast = i == status.target - 1;
              final earned = i < status.stamps;
              return Padding(
                padding: EdgeInsets.only(right: isLast ? 0 : AppSpacing.md),
                child: _StampDot(
                  earned: earned,
                  isRewardSlot: isLast && !earned,
                ),
              );
            }),
          ),
        ),
        if (onRewardsPressed != null) ...[
          const SizedBox(height: AppSpacing.xl),
          // Ana sayfa: iki eylem tek beyaz hapın içinde, ortada ayraç.
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: TextButton.icon(
                    onPressed: onRewardsPressed,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.lg,
                        vertical: AppSpacing.md,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                    ),
                    icon: const Icon(
                      Icons.card_giftcard,
                      size: 18,
                      color: AppColors.primary,
                    ),
                    label: Text(
                      'İkramlarım',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body.copyWith(
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ),
                Container(width: 1, height: 22, color: AppColors.divider),
                Flexible(
                  child: TextButton(
                    onPressed: () =>
                        showLoyaltyHowItWorksSheet(context, status.target),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.lg,
                        vertical: AppSpacing.md,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(
                            'Nasıl çalışır?',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.body.copyWith(color: _muted),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        const Icon(
                          Icons.chevron_right,
                          size: 18,
                          color: AppColors.textPrimary,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _StampDot extends StatelessWidget {
  const _StampDot({required this.earned, required this.isRewardSlot});

  final bool earned;
  final bool isRewardSlot;

  @override
  Widget build(BuildContext context) {
    // Her damga ayrı beyaz dairede; kazanılan çekirdek turuncu,
    // bekleyen çekirdek soluk kahve.
    final iconColor = earned ? AppColors.primary : const Color(0xFFB08968);
    return Container(
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.surface,
      ),
      child: isRewardSlot
          // Ödül halkası: logolu marka bardağı — ödül henüz açılmadığı için
          // (isRewardSlot yalnızca kazanılmamış son kutuda true) soluk.
          ? const Opacity(opacity: 0.45, child: MiniBrandCup(height: 28))
          : CoffeeBeanIcon(size: 18, color: iconColor),
    );
  }
}

/// Damga kartının tablosunun sayfaya taşan hâli. Ana sayfada selamlama ve
/// kartın ARKASINDA çizilir; yanlarda ekran kenarına kadar uzanır, yukarı
/// doğru eriyerek zemine karışır.
class StampCardBleed extends StatelessWidget {
  const StampCardBleed({super.key});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      // Bulanıklık yok: görsel net, kenarlar saydamlaşarak zemine karışır.
      // Köşe yuvarlatma yok; yumuşaklık yalnızca geçişlerden geliyor.
      child: ClipRect(
        child: ShaderMask(
          // Yanlar: kenarlara doğru erir.
          blendMode: BlendMode.dstIn,
          shaderCallback: (rect) => const LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: [
              Colors.transparent,
              Colors.white,
              Colors.white,
              Colors.transparent,
            ],
            stops: [0.0, 0.09, 0.91, 1.0],
          ).createShader(rect),
          child: ShaderMask(
            // Dikey: üstte tamamen erir, altta yumuşak biter.
            blendMode: BlendMode.dstIn,
            shaderCallback: (rect) => const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.transparent,
                Colors.white,
                Colors.white,
                Colors.transparent,
              ],
              stops: [0.0, 0.07, 0.89, 1.0],
            ).createShader(rect),
            child: Image.asset(
              'assets/images/damga_karti_arka_plan.jpg',
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => const SizedBox.shrink(),
            ),
          ),
        ),
      ),
    );
  }
}
