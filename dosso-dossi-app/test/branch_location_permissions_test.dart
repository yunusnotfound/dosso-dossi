import 'package:dosso_dossi/core/network/api_exception.dart';
import 'package:dosso_dossi/features/branches/data/branch_location_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';

class _LocationPlatform extends GeolocatorPlatform {
  bool enabled = true;
  LocationPermission permission = LocationPermission.denied;
  LocationPermission requestedPermission = LocationPermission.denied;
  int prompts = 0;
  int positionReads = 0;
  LocationSettings? settings;

  @override
  Future<bool> isLocationServiceEnabled() async => enabled;

  @override
  Future<LocationPermission> checkPermission() async => permission;

  @override
  Future<LocationPermission> requestPermission() async {
    prompts++;
    return requestedPermission;
  }

  @override
  Future<Position> getCurrentPosition({
    LocationSettings? locationSettings,
  }) async {
    positionReads++;
    settings = locationSettings;
    return Position(
      longitude: 28.97,
      latitude: 41.01,
      timestamp: DateTime(2026),
      accuracy: 50,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );
  }
}

void main() {
  late GeolocatorPlatform original;
  late _LocationPlatform platform;
  setUp(() {
    original = GeolocatorPlatform.instance;
    platform = _LocationPlatform();
    GeolocatorPlatform.instance = platform;
  });
  tearDown(() => GeolocatorPlatform.instance = original);

  test(
    'disabled device service does not ask permission or fetch position',
    () async {
      platform.enabled = false;
      await expectLater(
        DeviceBranchLocationService().requestLocation(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'LOCATION_DISABLED',
          ),
        ),
      );
      expect(platform.prompts, 0);
      expect(platform.positionReads, 0);
    },
  );

  test('denied permission does not read position', () async {
    await expectLater(
      DeviceBranchLocationService().requestLocation(),
      throwsA(
        isA<ApiException>().having((e) => e.code, 'code', 'LOCATION_DENIED'),
      ),
    );
    expect(platform.prompts, 1);
    expect(platform.positionReads, 0);
  });

  test(
    'permanent denial does not repeatedly trigger permission prompt',
    () async {
      platform.permission = LocationPermission.deniedForever;
      await expectLater(
        DeviceBranchLocationService().requestLocation(),
        throwsA(
          isA<ApiException>().having((e) => e.code, 'code', 'LOCATION_DENIED'),
        ),
      );
      expect(platform.prompts, 0);
      expect(platform.positionReads, 0);
    },
  );

  test(
    'new permission grant reads one current position with bounded timeout',
    () async {
      platform.requestedPermission = LocationPermission.whileInUse;
      final location = await DeviceBranchLocationService().requestLocation();
      expect(platform.prompts, 1);
      expect(platform.positionReads, 1);
      expect(location.latitude, 41.01);
      expect(location.longitude, 28.97);
      expect(platform.settings?.timeLimit, const Duration(seconds: 15));
    },
  );
}
