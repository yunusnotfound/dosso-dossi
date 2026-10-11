import 'package:flutter_test/flutter_test.dart';
import 'package:dosso_dossi/core/constants/app_config.dart';

void main() {
  test('release rejects development endpoints and mocks', () {
    for (final url in [
      '',
      'http://api.example.com',
      'https://localhost:3000',
      'https://127.0.0.1',
      'https://[::1]',
      'https://10.0.2.2',
      'https://api.localhost',
      'https://server.local',
      'https://user:password@api.example.com',
      'https://api.example.com?token=secret',
    ]) {
      expect(
        () => AppConfig.validateReleaseConfiguration(
          release: true,
          baseUrl: url,
          mocks: false,
        ),
        throwsStateError,
        reason: url,
      );
    }
    expect(
      () => AppConfig.validateReleaseConfiguration(
        release: true,
        baseUrl: 'https://api.example.com',
        mocks: true,
      ),
      throwsStateError,
    );
  });

  test('release accepts HTTPS API and development keeps local workflow', () {
    expect(
      () => AppConfig.validateReleaseConfiguration(
        release: true,
        baseUrl: 'https://api.example.com/v1',
        mocks: false,
      ),
      returnsNormally,
    );
    expect(
      () => AppConfig.validateReleaseConfiguration(
        release: false,
        baseUrl: 'http://localhost:3000',
        mocks: true,
      ),
      returnsNormally,
    );
  });
}
