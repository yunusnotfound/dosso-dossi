import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/loyalty_status.dart';
import 'mock_loyalty_repository.dart';

/// Damga/ikram veri kaynağı sözleşmesi.
abstract interface class LoyaltyRepository {
  Future<LoyaltyStatus> getStatus();
}

final loyaltyRepositoryProvider = Provider<LoyaltyRepository>((ref) {
  return MockLoyaltyRepository();
});
