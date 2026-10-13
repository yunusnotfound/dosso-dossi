import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/network/api_client.dart';
import '../domain/wallet.dart';
import 'api_wallet_repository.dart';
import 'mock_wallet_repository.dart';

/// Bakiye yükleme sonucu; bonus sunucuda hesaplanır.
class TopUpResult {
  const TopUpResult({
    required this.balance,
    required this.bonusDrinks,
    this.status = 'succeeded',
    this.paymentId,
    this.redirectUrl,
    this.amount,
    this.checkoutExpired = false,
    this.idempotencyKeys = const [],
  });

  final String status;
  final String? paymentId;
  final String? redirectUrl;
  final double? amount;
  final bool checkoutExpired;
  final List<String> idempotencyKeys;
  bool get isPending => status == 'pending';
  bool get isSucceeded => status == 'succeeded';
  bool get isTerminal =>
      const {'succeeded', 'failed', 'expired'}.contains(status);

  final double balance;

  /// "Yükle Kazan" kampanyasından kazanılan ikram sayısı (0 = bonus yok)
  final int bonusDrinks;
}

class PaymentConfig {
  const PaymentConfig({
    required this.provider,
    required this.enabled,
    required this.requiresBillingDetails,
  });
  final String provider;
  final bool enabled;
  final bool requiresBillingDetails;
  bool get isIyzico => provider == 'iyzico';
  static const development = PaymentConfig(
    provider: 'dev',
    enabled: true,
    requiresBillingDetails: false,
  );
}

/// Sent only to our API for this checkout; never saved on the device.
class PaymentBuyer {
  const PaymentBuyer({
    required this.name,
    required this.surname,
    required this.email,
    required this.identityNumber,
    required this.city,
    required this.country,
    required this.address,
  });
  final String name, surname, email, identityNumber, city, country, address;
  Map<String, dynamic> toJson() => {
    'name': name,
    'surname': surname,
    'email': email,
    'identityNumber': identityNumber,
    'city': city,
    'country': country,
    'address': address,
  };
}

abstract interface class CheckoutWalletRepository {
  Future<PaymentConfig> getPaymentConfig();
  Future<TopUpResult?> getPendingPayment();
  Future<TopUpResult> getPaymentStatus(String paymentId);
  Future<TopUpResult> startCheckout(double amount, {PaymentBuyer? buyer});
  Future<void> beginNewPaymentAttempt(TopUpResult previous);
}

extension WalletCheckout on WalletRepository {
  Future<void> beginNewPaymentAttempt(TopUpResult previous) =>
      this is CheckoutWalletRepository
      ? (this as CheckoutWalletRepository).beginNewPaymentAttempt(previous)
      : Future.value();
  Future<PaymentConfig> getPaymentConfig() => this is CheckoutWalletRepository
      ? (this as CheckoutWalletRepository).getPaymentConfig()
      : Future.value(PaymentConfig.development);
  Future<TopUpResult?> getPendingPayment() => this is CheckoutWalletRepository
      ? (this as CheckoutWalletRepository).getPendingPayment()
      : Future.value(null);
  Future<TopUpResult> getPaymentStatus(String paymentId) =>
      (this as CheckoutWalletRepository).getPaymentStatus(paymentId);
  Future<TopUpResult> startCheckout(double amount, {PaymentBuyer? buyer}) =>
      this is CheckoutWalletRepository
      ? (this as CheckoutWalletRepository).startCheckout(amount, buyer: buyer)
      : topUp(amount);
}

/// Tara & Öde için tek kullanımlık kod.
class QrTokenData {
  const QrTokenData({required this.code, required this.expiresAt});

  final String code;
  final DateTime expiresAt;
}

/// Dosso Kart bakiye veri kaynağı sözleşmesi.
abstract interface class WalletRepository {
  Future<Wallet> getWallet();

  /// Bakiye yükler; yeni bakiye + uygulanan bonusu döner.
  Future<TopUpResult> topUp(double amount);

  /// Kasada okutulacak tek kullanımlık ödeme kodu üretir.
  Future<QrTokenData> createQrToken(String phone);
}

final walletRepositoryProvider = Provider<WalletRepository>((ref) {
  return AppConfig.useMocks
      ? MockWalletRepository()
      : ApiWalletRepository(ref.watch(apiClientProvider));
});
