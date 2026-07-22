import '../domain/campaign.dart';
import 'campaign_repository.dart';

/// CEO'nun onayladığı gerçek kampanyalar (Temmuz 2026).
class MockCampaignRepository implements CampaignRepository {
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
