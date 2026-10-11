import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kReleaseMode;

/// Uygulama geneli iş kuralları. Değişince tüm ekranlar otomatik uyum sağlar.
/// Kaynak: CEO'nun onayladığı sadakat kampanyaları (Temmuz 2026).
abstract final class AppConfig {
  /// false → gerçek REST API (flutter run varsayılanı),
  /// true → mock repository'ler (flutter test varsayılanı).
  ///
  /// Açık bayrak her zaman kazanır: `--dart-define=USE_MOCKS=true|false`.
  /// Bayrak verilmediyse `flutter test`'in koştuğu VM'deki FLUTTER_TEST
  /// ortam değişkeniyle testler kendiliğinden mock'ta kalır (bu bir
  /// dart-define DEĞİL, o yüzden çalışma zamanında okunur).
  /// (Android emülatöründe API_BASE_URL=http://10.0.2.2:3000 gerekir.)
  static bool get useMocks => const bool.hasEnvironment('USE_MOCKS')
      ? const bool.fromEnvironment('USE_MOCKS')
      : Platform.environment.containsKey('FLUTTER_TEST');

  /// Backend adresi (dosso-dossi-backend, docs/API_CONTRACT.md).
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  /// Yayın paketi, geliştirme sunucusuna veya mock verilere bağlanamaz.
  static void validateReleaseConfiguration({
    bool release = kReleaseMode,
    String baseUrl = apiBaseUrl,
    bool? mocks,
  }) {
    if (!release) return;
    final uri = Uri.tryParse(baseUrl);
    final host = uri?.host.toLowerCase() ?? '';
    final localHost =
        host == 'localhost' ||
        host.endsWith('.localhost') ||
        host.endsWith('.local') ||
        host.startsWith('127.') ||
        host == '0.0.0.0' ||
        host == '10.0.2.2' ||
        host == '::1' ||
        host == '[::1]';
    if ((mocks ?? useMocks) ||
        uri == null ||
        uri.scheme != 'https' ||
        host.isEmpty ||
        localHost ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment) {
      throw StateError(
        'Yayın için HTTPS API_BASE_URL ve USE_MOCKS=false gereklidir.',
      );
    }
  }

  /// Mapbox erişim anahtarı. GitHub gizli anahtar taraması repo'da tutulmasına
  /// izin vermediği için derlemede dışarıdan verilir:
  ///   flutter run/build ... --dart-define-from-file=dart_defines.json
  /// (dart_defines.json git'e girmez; şablonu dart_defines.example.json)
  static const String mapboxToken = String.fromEnvironment('MAPBOX_TOKEN');

  /// Markaya özel harita stili (Mapbox hesabındaki "Dosso Dossi Coffee").
  /// light-v11 tabanından krem/kahve paletine boyanmış 50 katman.
  static const String mapboxStyle = 'beko17/cmt1qq20v002n01s37dx4hblj';

  /// Kampanya 1: Kaç kahvede 1 ikram içecek kazanılır ("5 kahve alana 1 kahve").
  static const int stampsPerReward = 5;

  /// Kampanya 2: Bu tutar ve üzeri tek seferlik bakiye yüklemede bonus verilir.
  static const double topUpBonusThreshold = 1000;

  /// Kampanya 2: Eşiği geçen yüklemede hediye edilen kahve (ikram) sayısı.
  static const int topUpBonusDrinks = 5;
}
