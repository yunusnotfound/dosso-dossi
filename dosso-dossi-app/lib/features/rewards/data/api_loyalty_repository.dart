import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../domain/loyalty_status.dart';
import 'loyalty_repository.dart';

class ApiLoyaltyRepository
    implements LoyaltyRepository, PagedLoyaltyRepository {
  ApiLoyaltyRepository(this._dio);

  final Dio _dio;

  @override
  Future<LoyaltyStatus> getStatus() => getHistoryPage();

  @override
  Future<LoyaltyStatus> getHistoryPage({String? cursor}) {
    return apiCall(() async {
      final res = await _dio.get<Map<String, dynamic>>(
        ApiEndpoints.loyalty,
        queryParameters: {'limit': 20, 'cursor': ?cursor},
      );
      final data = res.data!;
      return LoyaltyStatus(
        stamps: data['stamps'] as int,
        target: data['target'] as int,
        freeDrinks: data['freeDrinks'] as int,
        nextCursor: data['nextCursor'] as String?,
        history: [
          for (final entry in data['history'] as List<dynamic>)
            RewardEntry(
              id: (entry as Map<String, dynamic>)['id'] as String?,
              title: entry['title'] as String,
              date: DateTime.parse(entry['date'] as String).toLocal(),
              used: entry['used'] as bool,
            ),
        ],
      );
    });
  }
}
