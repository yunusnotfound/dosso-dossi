import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/financial_receipt.dart';
import '../../../core/diagnostics/app_telemetry.dart';
import '../domain/wallet.dart';
import 'wallet_repository.dart';

class ApiWalletRepository implements WalletRepository {
  ApiWalletRepository(this._dio);

  final Dio _dio;

  @override
  Future<Wallet> getWallet() {
    return apiCall(() async {
      final res = await _dio.get<Map<String, dynamic>>(ApiEndpoints.wallet);
      final data = res.data!;
      return Wallet(
        balance: (data['balance'] as num).toDouble(),
        cardLast4: data['cardLast4'] as String,
      );
    });
  }

  @override
  Future<TopUpResult> topUp(double amount) {
    return postFinancialReceipt(
      dio: _dio,
      path: ApiEndpoints.walletTopUp,
      data: {'amount': amount},
      operation: TelemetryOperation.walletReceipt,
      unconfirmed: const ApiException(
        code: 'TOPUP_RESPONSE_UNCONFIRMED',
        message:
            'Yükleme sonucu doğrulanamadı. Aynı yüklemenin sonucunu tekrar kontrol et.',
      ),
      decode: (data) => TopUpResult(
        balance: (data['balance'] as num).toDouble(),
        bonusDrinks: (data['bonusDrinks'] as num).toInt(),
        status: data['status'] as String? ?? 'succeeded',
        paymentId: data['paymentId'] as String?,
      ),
      isPending: (result) => result.isPending,
    );
  }

  @override
  Future<QrTokenData> createQrToken(String phone) {
    return apiCall(() async {
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
}
