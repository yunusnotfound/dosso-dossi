import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/branch_location_service.dart';

final branchLocationServiceProvider = Provider<BranchLocationService>(
  (ref) => DeviceBranchLocationService(),
);

final branchLocationProvider =
    AsyncNotifierProvider<BranchLocationController, BranchLocation?>(
      BranchLocationController.new,
    );

class BranchLocationController extends AsyncNotifier<BranchLocation?> {
  @override
  BranchLocation? build() => null;

  Future<void> requestLocation() async {
    if (state.isLoading) return;
    state = const AsyncLoading();
    final result = await AsyncValue.guard(
      ref.read(branchLocationServiceProvider).requestLocation,
    );
    if (ref.mounted) state = result;
  }
}
