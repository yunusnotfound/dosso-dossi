import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/branch_repository.dart';
import '../domain/branch.dart';

final branchesProvider = FutureProvider<List<Branch>>((ref) {
  return ref.watch(branchRepositoryProvider).getBranches();
});

/// Kullanıcıya en yakın şube (mock: listenin ilki).
final nearestBranchProvider = FutureProvider<Branch>((ref) async {
  final branches = await ref.watch(branchesProvider.future);
  return branches.first;
});
