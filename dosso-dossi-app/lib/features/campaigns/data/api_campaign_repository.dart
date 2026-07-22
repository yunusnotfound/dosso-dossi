import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../domain/campaign.dart';
import 'campaign_repository.dart';

class ApiCampaignRepository implements CampaignRepository {
  ApiCampaignRepository(this._dio);

  final Dio _dio;

  @override
  Future<List<Campaign>> getCampaigns() {
    return apiCall(() async {
      final res = await _dio.get<List<dynamic>>(ApiEndpoints.campaigns);
      return [
        for (final item in res.data!)
          Campaign(
            id: (item as Map<String, dynamic>)['id'] as String,
            title: item['title'] as String,
            badge: item['badge'] as String,
            description: item['description'] as String,
            style: item['style'] == 'dark'
                ? CampaignStyle.dark
                : CampaignStyle.orange,
          ),
      ];
    });
  }

  @override
  Future<PromoValidation> validateCode(String code) {
    return apiCall(() async {
      final res = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.validatePromoCode,
        data: {'code': code},
      );
      final data = res.data!;
      return PromoValidation(
        valid: data['valid'] as bool,
        discountRate: (data['discountRate'] as num).toDouble(),
      );
    });
  }
}
