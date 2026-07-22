import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/wallet_repository.dart';
import '../domain/wallet.dart';

/// Dosso Kart bakiyesi. Ödeme ve yükleme simülasyonları bu kontrolcüden geçer.
final walletProvider =
    AsyncNotifierProvider<WalletController, Wallet>(WalletController.new);

class WalletController extends AsyncNotifier<Wallet> {
  @override
  Future<Wallet> build() {
    return ref.watch(walletRepositoryProvider).getWallet();
  }

  /// Bakiye yeterliyse düşer ve true döner.
  Future<bool> pay(double amount) async {
    final wallet = state.value;
    if (wallet == null || wallet.balance < amount) return false;
    // Ödeme simülasyonu — gerçek entegrasyonda API çağrısı olacak.
    await Future<void>.delayed(const Duration(milliseconds: 600));
    state = AsyncData(
      Wallet(balance: wallet.balance - amount, cardLast4: wallet.cardLast4),
    );
    return true;
  }

  Future<void> topUp(double amount) async {
    final wallet = state.value;
    if (wallet == null) return;
    await Future<void>.delayed(const Duration(milliseconds: 600));
    state = AsyncData(
      Wallet(balance: wallet.balance + amount, cardLast4: wallet.cardLast4),
    );
  }
}
