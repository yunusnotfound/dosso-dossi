import '../constants/app_config.dart';

/// REST API adresleri; docs/API_CONTRACT.md ile birebir aynı.
abstract final class ApiEndpoints {
  static const String baseUrl = AppConfig.apiBaseUrl;

  // Kimlik
  static const String otpSend = '/auth/otp/send';
  static const String otpVerify = '/auth/otp/verify';
  static const String me = '/me';

  // Sadakat & cüzdan
  static const String loyalty = '/me/loyalty';
  static const String wallet = '/me/wallet';
  static const String walletTopUp = '/me/wallet/topup';
  static const String walletQrToken = '/me/wallet/qr-token';

  // Menü & şubeler & kampanyalar
  static const String menuCategories = '/menu/categories';
  static const String menuProducts = '/menu/products';
  static const String branches = '/branches';
  static const String campaigns = '/campaigns';
  static const String validatePromoCode = '/campaigns/validate-code';

  // Sipariş & hediye & bildirim
  static const String orders = '/orders';
  static const String gifts = '/gifts';
  static const String notificationPrefs = '/me/notification-prefs';
}
