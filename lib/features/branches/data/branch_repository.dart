import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/branch.dart';
import 'mock_branch_repository.dart';

/// Şube veri kaynağı sözleşmesi.
abstract interface class BranchRepository {
  Future<List<Branch>> getBranches();
}

final branchRepositoryProvider = Provider<BranchRepository>((ref) {
  return MockBranchRepository();
});
