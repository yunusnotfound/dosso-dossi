import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../routing/app_router.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/application/guest_mode.dart';
import '../../branches/application/branch_providers.dart';
import '../../campaigns/application/campaign_providers.dart';
import 'widgets/campaign_carousel.dart';
import 'widgets/stamp_card.dart';
import 'widgets/wallet_card.dart';

/// Ana Sayfa: selamlama, damga kartı, Dosso Kart, kampanyalar, yakın şube.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Tablo durum çubuğunun arkasına kadar uzansın diye üst güvenli alan
    // kapatılır; boşluk ListView padding'iyle telafi edilir.
    final topInset = MediaQuery.paddingOf(context).top;
    // Konuk kullanıcının cüzdanı yok: kart hiç gösterilmez.
    final isGuest = ref.watch(guestModeProvider);
    return Scaffold(
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          color: AppColors.primary,
          // Bakiye ve damga bilerek yenilenmiyor: simüle ödeme/damga
          // durumu sıfırlanmasın. API bağlanınca buraya eklenecekler.
          onRefresh: () async {
            ref.invalidate(campaignsProvider);
            ref.invalidate(branchesProvider);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(
              AppSpacing.page,
              topInset + AppSpacing.sm,
              AppSpacing.page,
              AppSpacing.page,
            ),
            children: [
              // Damga kartının tablosu selamlama ve kartın ARKASINDA,
              // yanlarda ekran kenarına kadar taşar; yukarı doğru erir.
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    left: -AppSpacing.page,
                    right: -AppSpacing.page,
                    // Ekranın tepesine kadar: durum çubuğunun arkasında da
                    // tablo devam eder, üstte gri bir bant kalmaz.
                    top: -(topInset + AppSpacing.sm),
                    // Kartın altına da taşar; oradaki sönüm daha uzun sürer.
                    bottom: -52,
                    child: StampCardBleed(),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: const [
                      _GreetingHeader(),
                      SizedBox(height: AppSpacing.xl),
                      StampCard(),
                    ],
                  ),
                ],
              ),
              if (!isGuest) ...[
                const SizedBox(height: AppSpacing.lg),
                const WalletCard(),
              ],
              const SizedBox(height: AppSpacing.xxl),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('SANA ÖZEL', style: AppTypography.sectionLabel),
                  GestureDetector(
                    onTap: () => context.push(Routes.campaigns),
                    child: Text(
                      'Tümü',
                      style: AppTypography.bodySecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              const CampaignCarousel(),
              const SizedBox(height: AppSpacing.xl),
            ],
          ),
        ),
      ),
    );
  }
}

class _GreetingHeader extends ConsumerWidget {
  const _GreetingHeader();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).value;
    final now = DateTime.now();
    final firstName =
        user == null || user.name.isEmpty ? '' : user.name.split(' ').first;

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(formatDayHeader(now), style: AppTypography.bodySecondary),
              const SizedBox(height: 2),
              // Her ekran genişliğine kendiliğinden uyar: kısa isimlerde tek
              // satır, uzun isimlerde ikinci satıra sarar (küçülterek okunmaz
              // hale getirmez), taşacak kadar uzunsa kısaltır.
              Text(
                firstName.isEmpty
                    ? greetingFor(now)
                    : '${greetingFor(now)}, $firstName',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.greeting,
              ),
            ],
          ),
        ),
        GestureDetector(
          onTap: () => context.push(Routes.profile),
          child: CircleAvatar(
            radius: 24,
            backgroundColor: AppColors.primary,
            child: Text(
              initialsOf(user?.name ?? ''),
              style: AppTypography.title.copyWith(color: Colors.white),
            ),
          ),
        ),
      ],
    );
  }
}
