import 'dart:math';

import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../domain/branch.dart';
import 'branch_repository.dart';

/// Cihaz konum servisi bu fazda bağlı değil; mesafeler sabit bir referans
/// noktadan (Beylikdüzü) hesaplanır. Konum izni eklendiğinde referans
/// gerçek kullanıcı konumu olacak.
const _refLat = 41.0021;
const _refLng = 28.6543;

class ApiBranchRepository implements BranchRepository {
  ApiBranchRepository(this._dio);

  final Dio _dio;

  @override
  Future<List<Branch>> getBranches() {
    return apiCall(() async {
      final res = await _dio.get<List<dynamic>>(ApiEndpoints.branches);
      final branches = [
        for (final item in res.data!) _branchFromJson(item as Map<String, dynamic>),
      ]..sort((a, b) => a.distanceMeters.compareTo(b.distanceMeters));
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
      distanceMeters: _haversineMeters(_refLat, _refLng, lat, lng),
      isOpen: json['isOpen'] as bool,
      hours: json['hours'] as String,
      prepMinutes: (json['prepMinutes'] as num?)?.toInt() ?? 7,
    );
  }
}

int _haversineMeters(double lat1, double lng1, double lat2, double lng2) {
  const earthRadius = 6371000.0;
  double rad(double deg) => deg * pi / 180;
  final dLat = rad(lat2 - lat1);
  final dLng = rad(lng2 - lng1);
  final a = pow(sin(dLat / 2), 2) +
      cos(rad(lat1)) * cos(rad(lat2)) * pow(sin(dLng / 2), 2);
  return (2 * earthRadius * asin(sqrt(a))).round();
}
