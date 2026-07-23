import 'dart:io' show Platform;

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

  /// Kampanya 1: Kaç kahvede 1 ikram içecek kazanılır ("5 kahve alana 1 kahve").
  static const int stampsPerReward = 5;

  /// Kampanya 2: Bu tutar ve üzeri tek seferlik bakiye yüklemede bonus verilir.
  static const double topUpBonusThreshold = 1000;

  /// Kampanya 2: Eşiği geçen yüklemede hediye edilen kahve (ikram) sayısı.
  static const int topUpBonusDrinks = 5;
}
