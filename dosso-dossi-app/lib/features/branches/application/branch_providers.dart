import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../data/branch_location_service.dart';
import '../data/branch_repository.dart';
import '../domain/branch.dart';
import 'branch_location_provider.dart';

final branchesProvider = FutureProvider<List<Branch>>((ref) async {
  final locationState = ref.watch(branchLocationProvider);
  // AsyncNotifier retains prior data on errors; a denied or failed refresh
  // must not keep presenting an older position as the current location.
  final location = locationState.hasError || locationState.isLoading
      ? null
      : locationState.value;
  final branches = await ref.watch(branchRepositoryProvider).getBranches();
  return branchesByDistance(branches, location);
});

List<Branch> branchesByDistance(
  List<Branch> branches,
  BranchLocation? location,
) {
  if (location == null) {
    return [for (final branch in branches) branch.withDistance(null)];
  }
  final result = [
    for (final branch in branches)
      branch.withDistance(
        Geolocator.distanceBetween(
          location.latitude,
          location.longitude,
          branch.lat,
          branch.lng,
        ).round(),
      ),
  ];
  result.sort((a, b) => a.distanceMeters!.compareTo(b.distanceMeters!));
  return result;
}

/// Konum alınmadan hiçbir şube 'en yakın' olarak gösterilmez.
final nearestBranchProvider = FutureProvider<Branch?>((ref) async {
  final branches = await ref.watch(branchesProvider.future);
  if (branches.isEmpty || branches.first.distanceMeters == null) return null;
  return branches.first;
});
