import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';

/// "Kahve İçtikçe Kahve Kazan" kampanya sayfası.
/// Basılı afişin (51x117) kendisi gösterilir: tasarım matbaadaki hâliyle
/// birebir aynı kalsın diye ekranda yeniden dizilmez.
class CampaignKahveScreen extends StatelessWidget {
  const CampaignKahveScreen({super.key});

  /// Afişin zemin turuncusu; görselin kenarında boşluk kalırsa aynı renk
  /// devam etsin diye sayfa zemini de bu renk.
  static const _posterBackground = AppColors.brandOrange;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _posterBackground,
      body: Stack(
        children: [
          // Afiş genişliğe oturur; uzun afişte kalan kısım kaydırılarak görülür.
          Positioned.fill(
            // Afişin başlığı durum çubuğunun altında kalmasın.
            child: SafeArea(
              bottom: false,
              child: SingleChildScrollView(
                child: Image.asset(
                  'assets/images/kahve_ictikce_afis.jpg',
                  width: double.infinity,
                  fit: BoxFit.fitWidth,
                ),
              ),
            ),
          ),
          // Geri: afişin üzerinde yüzen buton.
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Align(
                alignment: Alignment.topLeft,
                child: CircleAvatar(
                  backgroundColor: Colors.black.withValues(alpha: 0.28),
                  child: BackButton(
                    color: Colors.white,
                    onPressed: () => context.pop(),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
