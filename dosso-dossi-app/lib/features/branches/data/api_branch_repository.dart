import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../domain/branch.dart';
import 'branch_repository.dart';

class ApiBranchRepository implements BranchRepository {
  ApiBranchRepository(this._dio);

  final Dio _dio;

  @override
  Future<List<Branch>> getBranches() {
    return apiCall(() async {
      final res = await _dio.get<List<dynamic>>(ApiEndpoints.branches);
      final branches = [
        for (final item in res.data!)
          _branchFromJson(item as Map<String, dynamic>),
      ];
      return branches;
    });
  }

  Branch _branchFromJson(Map<String, dynamic> json) {
    final lat = (json['lat'] as num).toDouble();
    final lng = (json['lng'] as num).toDouble();
    return Branch(
      id: json['id'] as String,
      name: json['name'] as String,
      address: json['address'] as String,
      city: json['city'] as String,
      phone: (json['phone'] as String?) ?? '',
      lat: lat,
      lng: lng,
      isOpen: json['isOpen'] as bool,
      hours: json['hours'] as String,
      prepMinutes: (json['prepMinutes'] as num?)?.toInt() ?? 7,
    );
  }
}
