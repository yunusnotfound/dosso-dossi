import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
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
    return apiCall(() async {
      final res = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.walletTopUp,
        data: {'amount': amount},
      );
      final data = res.data!;
      return TopUpResult(
        balance: (data['balance'] as num).toDouble(),
        bonusDrinks: data['bonusDrinks'] as int,
      );
    });
  }

  @override
  Future<QrTokenData> createQrToken(String phone) {
    return apiCall(() async {
      final res =
          await _dio.post<Map<String, dynamic>>(ApiEndpoints.walletQrToken);
      final data = res.data!;
      return QrTokenData(
        code: data['code'] as String,
        expiresAt: DateTime.parse(data['expiresAt'] as String).toLocal(),
      );
    });
  }
}
