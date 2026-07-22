import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/network/api_client.dart';
import '../domain/wallet.dart';
import 'api_wallet_repository.dart';
import 'mock_wallet_repository.dart';

/// Bakiye yükleme sonucu; bonus sunucuda hesaplanır.
class TopUpResult {
  const TopUpResult({required this.balance, required this.bonusDrinks});

  final double balance;

  /// "Yükle Kazan" kampanyasından kazanılan ikram sayısı (0 = bonus yok)
  final int bonusDrinks;
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
