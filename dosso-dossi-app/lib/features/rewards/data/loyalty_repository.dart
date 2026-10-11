import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/network/api_client.dart';
import '../domain/loyalty_status.dart';
import 'api_loyalty_repository.dart';
import 'mock_loyalty_repository.dart';

/// Damga/ikram veri kaynağı sözleşmesi.
abstract interface class LoyaltyRepository {
  Future<LoyaltyStatus> getStatus();
}

abstract interface class PagedLoyaltyRepository {
  Future<LoyaltyStatus> getHistoryPage({String? cursor});
}

final loyaltyRepositoryProvider = Provider<LoyaltyRepository>((ref) {
  return AppConfig.useMocks
      ? MockLoyaltyRepository()
      : ApiLoyaltyRepository(ref.watch(apiClientProvider));
});
