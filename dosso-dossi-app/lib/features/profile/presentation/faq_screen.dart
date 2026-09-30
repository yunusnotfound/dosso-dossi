import 'package:flutter/material.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/scrollable_page_scaffold.dart';

class FaqScreen extends StatelessWidget {
  const FaqScreen({super.key});

  static final _faqs = [
    (
      q: 'Damga nasıl kazanırım?',
      a:
          'Uygulamayla ödediğin her kahve 1 damga kazandırır. '
          '${AppConfig.stampsPerReward} damgaya ulaştığında 1 ikram içecek hakkın otomatik tanımlanır.',
    ),
    (
      q: 'İkram içeceğimi nasıl kullanırım?',
      a:
          'Sepette "İkram hakkını kullan" anahtarını aç — sepetteki en yüksek '
          'fiyatlı içeceğin ücretsiz olur. İkram, dilediğin boyda tek bir el yapımı içecek için geçerlidir.',
    ),
    (
      q: 'Bakiye yükleme kampanyası nedir?',
      a:
          'Tek seferde ${AppConfig.topUpBonusThreshold.toStringAsFixed(0)} ₺ ve üzeri '
          'bakiye yüklediğinde ${AppConfig.topUpBonusDrinks} ikram kahve hediye edilir.',
    ),
    (
      q: 'Arkadaşıma nasıl hediye gönderirim?',
      a:
          'Hediye sekmesinden kahve veya bakiye seç, arkadaşının telefon numarasını gir. '
          'Hediyeyi kullanmak için alıcının Dosso Dossi Coffee uygulamasına '
          'bu numarayla giriş yapması gerekir. Hesabı yoksa hediyesi giriş yapana kadar bekler. '
          'Kahve hediyesi İkramlarım bölümüne, bakiye hediyesi Dosso Dossi Kart hesabına eklenir. '
          'SMS yalnızca bilgilendirme içindir; SMS ile hediye kullanılamaz.',
    ),
    (
      q: 'Siparişimi nereden teslim alırım?',
      a:
          'Siparişini verdiğin şubeden, seçtiğin saatte Gel-Al olarak teslim alabilirsin. '
          'Şubeyi sipariş ekranından veya Profil > Şubeler bölümünden değiştirebilirsin.',
    ),
    (
      q: 'Dosso Kart bakiyemi iade alabilir miyim?',
      a: 'Bakiye iadesi için şubemize başvurabilir veya müşteri hizmetlerini arayabilirsin: (0212) 242 21 21.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return ScrollablePageScaffold(
      title: 'Yardım & SSS',
      children: [
        for (final faq in _faqs)
          Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Theme(
              data: Theme.of(
                context,
              ).copyWith(dividerColor: Colors.transparent),
              child: ExpansionTile(
                tilePadding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.xs,
                ),
                childrenPadding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  0,
                  AppSpacing.lg,
                  AppSpacing.lg,
                ),
                iconColor: AppColors.primary,
                collapsedIconColor: AppColors.textSecondary,
                title: Text(faq.q, style: AppTypography.body),
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(faq.a, style: AppTypography.bodySecondary),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
