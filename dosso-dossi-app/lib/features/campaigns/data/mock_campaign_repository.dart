import '../domain/campaign.dart';
import 'campaign_repository.dart';

/// CEO'nun onayladığı gerçek kampanyalar (Temmuz 2026).
class MockCampaignRepository implements CampaignRepository {
  /// Geçerli kampanya kodları (mock). API'de sunucu doğrular.
  static const _promoCodes = <String, double>{
    'DOSSO10': 0.10,
    'KAHVE20': 0.20,
  };

  @override
  Future<PromoValidation> validateCode(String code) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final rate = _promoCodes[code.trim().toUpperCase()];
    return PromoValidation(valid: rate != null, discountRate: rate ?? 0);
  }

  @override
  Future<List<Campaign>> getCampaigns() async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return const [
      Campaign(
        id: 'kahve-ictikce',
        title: 'Kahve İçtikçe Kahve Kazan',
        badge: '5+1',
        description: '5 kahve sizden, 1. kahve bizden!',
        style: CampaignStyle.orange,
      ),
      Campaign(
        id: 'yukle-kazan',
        title: 'Yükle Kazan',
        badge: '+5 ☕',
        description:
            'Tek seferde 1.000 ₺ ve üzeri bakiye yüklemeye 5 ikram kahve hediye.',
        style: CampaignStyle.dark,
      ),
    ];
  }
}
