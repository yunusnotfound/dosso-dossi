import 'package:geolocator/geolocator.dart';

import '../../../core/network/api_exception.dart';

class BranchLocation {
  const BranchLocation(this.latitude, this.longitude);
  final double latitude;
  final double longitude;
}

abstract interface class BranchLocationService {
  Future<BranchLocation> requestLocation();
}

/// Yalnızca kullanıcı istediğinde, uygulama açıkken tek konum alınır.
class DeviceBranchLocationService implements BranchLocationService {
  @override
  Future<BranchLocation> requestLocation() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const ApiException(
        code: 'LOCATION_DISABLED',
        message: 'Mesafeleri görmek için cihazının konum servisini aç.',
      );
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) {
      throw const ApiException(
        code: 'LOCATION_DENIED',
        message:
            'Mesafeleri görmek için cihaz ayarlarından konum iznini açabilirsin.',
      );
    }
    if (permission != LocationPermission.whileInUse &&
        permission != LocationPermission.always) {
      throw const ApiException(
        code: 'LOCATION_DENIED',
        message: 'Konum izni verilmedi. Şubeleri yine de seçebilirsin.',
      );
    }
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 15),
        ),
      );
      return BranchLocation(position.latitude, position.longitude);
    } catch (_) {
      throw const ApiException(
        code: 'LOCATION_UNAVAILABLE',
        message:
            'Konumun alınamadı. Tekrar deneyebilir veya listeden şube seçebilirsin.',
      );
    }
  }
}
