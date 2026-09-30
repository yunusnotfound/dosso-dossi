import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../routing/app_router.dart';

/// Referanstaki hediye görseli ve yazılarıyla Yükle-Kazan kısayolu.
class LoadRewardsBanner extends StatelessWidget {
  const LoadRewardsBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Kahveni yükle, ödülleri topla! Sürpriz ödüller seni bekliyor.',
      hint: 'Yükle-Kazan kampanyasını aç',
      child: Material(
        color: AppColors.surfaceTint,
        borderRadius: BorderRadius.circular(AppRadius.md),
        clipBehavior: Clip.antiAlias,
        child: Ink.image(
          image: const AssetImage('assets/images/yukle_kazan_banner.png'),
          fit: BoxFit.cover,
          child: InkWell(
            onTap: () => context.push(Routes.campaignYukleKazan),
            child: const AspectRatio(aspectRatio: 4),
          ),
        ),
      ),
    );
  }
}
