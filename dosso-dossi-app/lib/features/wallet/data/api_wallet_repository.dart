import 'dart:convert';

import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/financial_receipt.dart';
import '../../../core/network/mutation_intents.dart';
import '../../../core/diagnostics/app_telemetry.dart';
import '../domain/wallet.dart';
import 'wallet_repository.dart';

class ApiWalletRepository
    implements WalletRepository, CheckoutWalletRepository {
  ApiWalletRepository(this._dio);

  final Dio _dio;

  TopUpResult _decode(Map<String, dynamic> data) {
    final status = data['status'] as String;
    if (!const {'pending', 'succeeded', 'failed', 'expired'}.contains(status)) {
      throw const FormatException('Unknown payment status');
    }
    final balance = (data['balance'] as num).toDouble();
    final rawBonus = data['bonusDrinks'] as num;
    final bonus = rawBonus.toInt();
    final amount = (data['amount'] as num).toDouble();
    final paymentId = data['paymentId'] as String?;
    if (!balance.isFinite ||
        balance < 0 ||
        bonus < 0 ||
        rawBonus != bonus ||
        (status != 'succeeded' && bonus != 0) ||
        !amount.isFinite ||
        amount <= 0 ||
        paymentId == null ||
        paymentId.isEmpty) {
      throw const FormatException('Invalid payment receipt');
    }
    return TopUpResult(
      balance: balance,
      bonusDrinks: bonus,
      status: status,
      paymentId: paymentId,
      redirectUrl: data['redirectUrl'] as String?,
      amount: amount,
      checkoutExpired: data['checkoutExpired'] == true,
      idempotencyKeys:
          (data['idempotencyKeys'] as List?)?.cast<String>() ?? const [],
    );
  }

  String? _accountKey(MutationIntents intents) {
    final raw = intents.store.getString('auth_user');
    if (raw == null) return null;
    final account = (jsonDecode(raw) as Map)['phone'];
    return 'wallet_checkout:$account';
  }

  List<({MutationIntents intents, int epoch, String? key})> _origins() => [
    for (final intents in _dio.interceptors.whereType<MutationIntents>())
      (
        intents: intents,
        epoch: intents.session.revision,
        key: _accountKey(intents),
      ),
  ];

  void _assertOrigins(
    List<({MutationIntents intents, int epoch, String? key})> origins,
  ) {
    if (origins.any(
      (o) =>
          o.intents.session.revision != o.epoch ||
          _accountKey(o.intents) != o.key,
    )) {
      throw const ApiException(
        code: 'SESSION_CHANGED',
        message: 'Oturum değişti.',
      );
    }
  }

  Future<void> _remember(
    TopUpResult receipt,
    List<({MutationIntents intents, int epoch, String? key})> origins,
  ) async {
    _assertOrigins(origins);
    for (final origin in origins) {
      final intents = origin.intents;
      final key = origin.key;
      if (key == null) continue;
      if (receipt.isPending && receipt.paymentId != null) {
        if (!await intents.store.setString(key, receipt.paymentId!)) {
          throw StateError('Ödeme takibi kaydedilemedi.');
        }
      } else if (receipt.isTerminal) {
        if (receipt.amount != null) {
          await intents.confirmWalletAmount(
            receipt.amount!,
            receipt.idempotencyKeys,
          );
        }
        _assertOrigins(origins);
        if (intents.store.getString(key) == receipt.paymentId) {
          await intents.store.remove(key);
        }
      }
      _assertOrigins(origins);
    }
  }

  @override
  Future<Wallet> getWallet() => apiCall(() async {
    final res = await _dio.get<Map<String, dynamic>>(ApiEndpoints.wallet);
    final data = res.data!;
    return Wallet(
      balance: (data['balance'] as num).toDouble(),
      cardLast4: data['cardLast4'] as String,
    );
  });

  @override
  Future<PaymentConfig> getPaymentConfig() => apiCall(() async {
    final res = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.walletPaymentConfig,
    );
    final data = res.data!;
    final provider = data['provider'] as String;
    if (!const {'iyzico', 'dev'}.contains(provider)) {
      throw const FormatException('Unknown payment provider');
    }
    return PaymentConfig(
      provider: provider,
      enabled: data['enabled'] == true,
      requiresBillingDetails: data['requiresBillingDetails'] == true,
    );
  });

  @override
  Future<TopUpResult?> getPendingPayment() => apiCall(() async {
    final origins = _origins();
    final res = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.walletPendingPayment,
    );
    _assertOrigins(origins);
    if (!res.data!.containsKey('payment')) {
      throw const FormatException('Missing payment recovery result');
    }
    final raw = res.data!['payment'];
    if (raw != null && raw is! Map<String, dynamic>) {
      throw const FormatException('Invalid payment recovery result');
    }
    if (raw is Map<String, dynamic>) {
      final receipt = _decode(raw);
      await _remember(receipt, origins);
      return receipt;
    }
    // Recovery after the provider completed while this app was closed.
    for (final intents in _dio.interceptors.whereType<MutationIntents>()) {
      final key = _accountKey(intents);
      final id = key == null ? null : intents.store.getString(key);
      if (id != null) return getPaymentStatus(id);
    }
    return null;
  });

  @override
  Future<TopUpResult> getPaymentStatus(String paymentId) => apiCall(() async {
    final origins = _origins();
    final res = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.walletPayment(paymentId),
    );
    _assertOrigins(origins);
    final receipt = _decode(res.data!);
    if (receipt.paymentId != paymentId) {
      throw const FormatException('Payment receipt mismatch');
    }
    await _remember(receipt, origins);
    return receipt;
  });

  @override
  Future<void> beginNewPaymentAttempt(TopUpResult previous) async {
    if (!previous.isPending ||
        !previous.checkoutExpired ||
        previous.amount == null) {
      throw StateError('Ödeme oturumu henüz sona ermedi.');
    }
    // Only a deliberate new checkout replaces the retry identity. The original
    // payment remains pending on the server and can still be reconciled.
    for (final intents in _dio.interceptors.whereType<MutationIntents>()) {
      await intents.confirmWalletAmount(
        previous.amount!,
        previous.idempotencyKeys,
      );
    }
  }

  @override
  Future<TopUpResult> topUp(double amount) => startCheckout(amount);

  @override
  Future<TopUpResult> startCheckout(
    double amount, {
    PaymentBuyer? buyer,
  }) async {
    final origins = _origins();
    final receipt = await postFinancialReceipt(
      dio: _dio,
      path: ApiEndpoints.walletTopUp,
      data: {'amount': amount, if (buyer != null) 'buyer': buyer.toJson()},
      operation: TelemetryOperation.walletReceipt,
      unconfirmed: const ApiException(
        code: 'TOPUP_RESPONSE_UNCONFIRMED',
        message:
            'Yükleme sonucu doğrulanamadı. Aynı yüklemenin sonucunu tekrar kontrol et.',
      ),
      decode: (data) {
        _assertOrigins(origins);
        final result = _decode(data);
        if (result.amount != amount) {
          throw const FormatException('Payment amount mismatch');
        }
        return result;
      },
      isPending: (result) => result.isPending,
    );
    await _remember(receipt, origins);
    return receipt;
  }

  @override
  Future<QrTokenData> createQrToken(String phone) => apiCall(() async {
    final res = await _dio.post<Map<String, dynamic>>(
      ApiEndpoints.walletQrToken,
    );
    final data = res.data!;
    return QrTokenData(
      code: data['code'] as String,
      expiresAt: DateTime.parse(data['expiresAt'] as String).toLocal(),
    );
  });
}
