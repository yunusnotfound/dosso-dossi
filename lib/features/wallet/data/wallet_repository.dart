import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/wallet.dart';
import 'mock_wallet_repository.dart';

/// Dosso Kart bakiye veri kaynağı sözleşmesi.
abstract interface class WalletRepository {
  Future<Wallet> getWallet();
}

final walletRepositoryProvider = Provider<WalletRepository>((ref) {
  return MockWalletRepository();
});
