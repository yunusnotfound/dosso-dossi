import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/network/api_client.dart';
import '../domain/campaign.dart';
import 'api_campaign_repository.dart';
import 'mock_campaign_repository.dart';

/// Kampanya kodu doğrulama sonucu.
class PromoValidation {
  const PromoValidation({required this.valid, required this.discountRate});

  final bool valid;

  /// 0.10 = %10 indirim
  final double discountRate;
}

/// Kampanya veri kaynağı sözleşmesi.
abstract interface class CampaignRepository {
  Future<List<Campaign>> getCampaigns();

  /// Sepetteki kampanya kodunu doğrular (kural sunucuda).
  Future<PromoValidation> validateCode(String code);
}

final campaignRepositoryProvider = Provider<CampaignRepository>((ref) {
  return AppConfig.useMocks
      ? MockCampaignRepository()
      : ApiCampaignRepository(ref.watch(apiClientProvider));
});
