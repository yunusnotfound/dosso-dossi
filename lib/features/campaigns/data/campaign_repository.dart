import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/campaign.dart';
import 'mock_campaign_repository.dart';

/// Kampanya veri kaynağı sözleşmesi.
abstract interface class CampaignRepository {
  Future<List<Campaign>> getCampaigns();
}

final campaignRepositoryProvider = Provider<CampaignRepository>((ref) {
  return MockCampaignRepository();
});
