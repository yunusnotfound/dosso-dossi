import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';

/// KVKK aydınlatma metni — TASLAK. Yayın öncesi hukuk ekibinin onayladığı
/// nihai metinle değiştirilmeli.
class KvkkScreen extends StatelessWidget {
  const KvkkScreen({super.key});

  static const _sections = [
    (
      title: 'Veri Sorumlusu',
      body:
          'Kişisel verileriniz, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") '
          'uyarınca veri sorumlusu sıfatıyla Dosso Dossi Coffee tarafından işlenmektedir.'
    ),
    (
      title: 'İşlenen Veriler',
      body:
          'Üyelik ve sipariş süreçlerinde ad-soyad, telefon numarası, e-posta adresi, '
          'sipariş ve ödeme geçmişi ile sadakat programı (damga/ikram) verileriniz işlenir.'
    ),
    (
      title: 'İşleme Amaçları',
      body:
          'Verileriniz; siparişlerin alınması ve teslimi, Dosso Kart bakiye işlemleri, '
          'sadakat kampanyalarının yürütülmesi, yasal yükümlülüklerin yerine getirilmesi '
          've onay vermeniz hâlinde kampanya bildirimlerinin iletilmesi amacıyla işlenir.'
    ),
    (
      title: 'Haklarınız',
      body:
          'KVKK m.11 kapsamında; verilerinize erişme, düzeltilmesini veya silinmesini isteme, '
          'işlenmesine itiraz etme haklarına sahipsiniz. Başvurularınızı şubelerimiz veya '
          'müşteri hizmetleri üzerinden iletebilirsiniz.'
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('KVKK ve Gizlilik')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.page),
        children: [
          Text(
            'Bu metin taslaktır; yayın öncesi hukuki onaydan geçmelidir.',
            style: AppTypography.bodySecondary.copyWith(fontSize: 12),
          ),
          const SizedBox(height: AppSpacing.lg),
          for (final section in _sections) ...[
            Text(section.title, style: AppTypography.title),
            const SizedBox(height: AppSpacing.sm),
            Text(section.body, style: AppTypography.bodySecondary),
            const SizedBox(height: AppSpacing.xl),
          ],
        ],
      ),
    );
  }
}
