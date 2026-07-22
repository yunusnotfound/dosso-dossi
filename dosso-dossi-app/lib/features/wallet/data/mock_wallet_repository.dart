import '../../../core/constants/app_config.dart';
import '../domain/wallet.dart';
import 'wallet_repository.dart';

class MockWalletRepository implements WalletRepository {
  @override
  Future<Wallet> getWallet() async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return const Wallet(balance: 425.50, cardLast4: '7412');
  }

  /// Mock'ta bakiye durumu WalletController'da tutulur; burada yalnızca
  /// bonus kuralı hesaplanır (sunucu davranışının simülasyonu).
  @override
  Future<TopUpResult> topUp(double amount) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    return TopUpResult(
      balance: amount, // controller mevcut bakiyeyle toplar
      bonusDrinks: amount >= AppConfig.topUpBonusThreshold
          ? AppConfig.topUpBonusDrinks
          : 0,
    );
  }

  @override
  Future<QrTokenData> createQrToken(String phone) async {
    return QrTokenData(
      code: 'DDPAY|$phone|${DateTime.now().millisecondsSinceEpoch}',
      expiresAt: DateTime.now().add(const Duration(seconds: 60)),
    );
  }
}
