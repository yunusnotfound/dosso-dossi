/// Uygulama geneli iş kuralları. Değişince tüm ekranlar otomatik uyum sağlar.
/// Kaynak: CEO'nun onayladığı sadakat kampanyaları (Temmuz 2026).
abstract final class AppConfig {
  /// true (varsayılan) → mock repository'ler; false → gerçek REST API.
  /// Gerçek API ile çalıştırmak için:
  ///   flutter run --dart-define=USE_MOCKS=false \
  ///               --dart-define=API_BASE_URL=http://localhost:3000
  /// (Android emülatöründe API_BASE_URL=http://10.0.2.2:3000)
  /// Testler mock varsayılanıyla çalışır.
  static const bool useMocks = bool.fromEnvironment(
    'USE_MOCKS',
    defaultValue: true,
  );

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
