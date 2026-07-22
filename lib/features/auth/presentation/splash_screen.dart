import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/brand_logo.dart';

/// Oturum kontrolü yapılırken gösterilen açılış ekranı.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.coffeeDark,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const BrandLogo(size: 132),
            const SizedBox(height: 16),
            Text(
              'Dosso Dossi',
              style: AppTypography.headline.copyWith(color: AppColors.textOnDark),
            ),
          ],
        ),
      ),
    );
  }
}
