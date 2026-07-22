import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/network/api_client.dart';
import '../domain/branch.dart';
import 'api_branch_repository.dart';
import 'mock_branch_repository.dart';

/// Şube veri kaynağı sözleşmesi.
abstract interface class BranchRepository {
  Future<List<Branch>> getBranches();
}

final branchRepositoryProvider = Provider<BranchRepository>((ref) {
  return AppConfig.useMocks
      ? MockBranchRepository()
      : ApiBranchRepository(ref.watch(apiClientProvider));
});
