/// Uygulama geneli iş kuralları. Değişince tüm ekranlar otomatik uyum sağlar.
/// Kaynak: CEO'nun onayladığı sadakat kampanyaları (Temmuz 2026).
abstract final class AppConfig {
  /// Kampanya 1: Kaç kahvede 1 ikram içecek kazanılır ("5 kahve alana 1 kahve").
  static const int stampsPerReward = 5;

  /// Kampanya 2: Bu tutar ve üzeri tek seferlik bakiye yüklemede bonus verilir.
  static const double topUpBonusThreshold = 1000;

  /// Kampanya 2: Eşiği geçen yüklemede hediye edilen kahve (ikram) sayısı.
  static const int topUpBonusDrinks = 5;
}
