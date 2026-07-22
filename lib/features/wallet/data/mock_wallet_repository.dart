import '../domain/wallet.dart';
import 'wallet_repository.dart';

class MockWalletRepository implements WalletRepository {
  @override
  Future<Wallet> getWallet() async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return const Wallet(balance: 425.50, cardLast4: '7412');
  }
}
