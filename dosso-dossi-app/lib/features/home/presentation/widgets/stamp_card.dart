import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/coffee_bean_icon.dart';
import '../../../../routing/app_router.dart';
import '../../../rewards/application/loyalty_providers.dart';
import '../../../rewards/domain/loyalty_status.dart';
import '../../../rewards/presentation/loyalty_how_it_works_sheet.dart';

/// Ana sayfadaki damga kartı: tablo arka planı + 3/5 ilerleme + damga rozetleri.
class StampCard extends ConsumerWidget {
  const StampCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loyalty = ref.watch(loyaltyStatusProvider);

    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Tablo kartın sağ/sol/üst kenarından dışarı taşar ve kenarlara
        // doğru eriyerek sayfa zeminine karışır (kart hizası korunur).
        Positioned(
          left: -_bleed,
          right: -_bleed,
          top: -_bleed,
          bottom: 0,
          child: IgnorePointer(
            // Taşan katman hafif bulanık: kartın içindeki net görselle
            // arasındaki ölçek farkı sırıtmaz, ışıma gibi karışır.
            child: ImageFiltered(
              imageFilter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
              child: ShaderMask(
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
                  stops: [0.0, 0.34, 0.66, 1.0],
                ).createShader(rect),
                child: ShaderMask(
                  blendMode: BlendMode.dstIn,
                  shaderCallback: (rect) => const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.white],
                    stops: [0.0, 0.42],
                  ).createShader(rect),
                  child: Image.asset(
                    'assets/images/damga_karti_arka_plan.jpg',
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
              ),
            ),
          ),
        ),
        _card(loyalty),
      ],
    );
  }

  /// Kartın dışına taşan pay (px).
  static const double _bleed = 34;

  Widget _card(AsyncValue<LoyaltyStatus> loyalty) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Stack(
        children: [
          // Tablo tüm kartı kaplar; taşan kısmı ClipRRect kırpar.
          Positioned.fill(
            child: Image.asset(
              'assets/images/damga_karti_arka_plan.jpg',
              fit: BoxFit.cover,
              // Görsel yüklenemezse kart marka turuncusuna düşer.
              errorBuilder: (_, _, _) =>
                  const ColoredBox(color: AppColors.brandOrange),
            ),
          ),
          // Perde yok: tablo orijinal canlılığında. (Metinlerin okunurluğu
          // için gerekirse buraya hafif aydınlık bir perde geri eklenebilir.)
          Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: loyalty.when(
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
                    style: AppTypography.body.copyWith(
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
              data: (status) => _StampContent(status: status),
            ),
          ),
        ],
      ),
    );
  }
}

class _StampContent extends StatelessWidget {
  const _StampContent({required this.status});

  final LoyaltyStatus status;

  /// Canlı tablo zemininde yazı rengi: neredeyse siyah kahve.
  static const Color _muted = Color(0xFF120B06);

  /// Aydınlık perdede yazılar kendi rengiyle ayrışıyor; parlama/gölge yok.
  static const List<Shadow> _shadow = [];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(
                    TextSpan(
                      text: '${status.stamps}',
                      style: AppTypography.numberLarge.copyWith(
                        color: AppColors.primary,
                        shadows: _shadow,
                      ),
                      children: [
                        TextSpan(
                          text: '/${status.target}',
                          style: AppTypography.title.copyWith(
                            color: _muted,
                            shadows: _shadow,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (status.freeDrinks > 0) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Kullanılabilir ikramın: ${status.freeDrinks} ☕',
                      style: AppTypography.badge.copyWith(
                        color: AppColors.primary,
                        shadows: _shadow,
                      ),
                    ),
                  ],
                ],
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
        // FittedBox: dar ekranlarda damga dizisi taşmak yerine küçülür.
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Row(
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
        const SizedBox(height: AppSpacing.xl),
        // Referans tasarım: iki eylem tek beyaz hapın içinde, ortada ayraç.
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
                  onPressed: () => context.push(Routes.rewards),
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
    );
  }
}

class _StampDot extends StatelessWidget {
  const _StampDot({required this.earned, required this.isRewardSlot});

  final bool earned;
  final bool isRewardSlot;

  @override
  Widget build(BuildContext context) {
    // Aydınlık zeminde rozetler beyaz dolgulu: kazanılan damga turuncu
    // çekirdek, bekleyenler soluk kahve, ödül halkası turuncu çerçeveli.
    final iconColor = earned
        ? AppColors.primary
        : (isRewardSlot ? AppColors.primary : const Color(0xFFB08968));
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
        // Tablo zemininde daireler silik durmasın: her rozetin ince bir
        // çerçevesi ve hafif gölgesi var; ödül rozeti turuncu ve daha kalın.
        border: Border.all(
          width: isRewardSlot ? 2 : 1.5,
          color: isRewardSlot
              ? AppColors.primary
              : AppColors.primary.withValues(alpha: 0.35),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.18),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: isRewardSlot
          ? Icon(Icons.card_giftcard, size: 18, color: iconColor)
          : CoffeeBeanIcon(size: 18, color: iconColor),
    );
  }
}
