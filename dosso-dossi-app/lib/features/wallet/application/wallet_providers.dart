import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../rewards/application/loyalty_providers.dart';
import '../data/wallet_repository.dart';
import '../domain/wallet.dart';

/// Dosso Kart bakiyesi. Ödeme ve yükleme akışları bu kontrolcüden geçer.
final walletProvider =
    AsyncNotifierProvider<WalletController, Wallet>(WalletController.new);

class WalletController extends AsyncNotifier<Wallet> {
  @override
  Future<Wallet> build() {
    return ref.watch(walletRepositoryProvider).getWallet();
  }

  /// Bakiye yeterliyse düşer ve true döner.
  /// Yalnızca mock modunda kullanılır; API modunda ödemeyi sunucu yapar
  /// (sipariş ve hediye kendi endpoint'lerinde bakiyeyi düşer).
  Future<bool> pay(double amount) async {
    final wallet = state.value;
    if (wallet == null || wallet.balance < amount) return false;
    await Future<void>.delayed(const Duration(milliseconds: 600));
    state = AsyncData(
      Wallet(balance: wallet.balance - amount, cardLast4: wallet.cardLast4),
    );
    return true;
  }

  /// Bakiye yükler; uygulanan bonusla birlikte sonucu döner.
  Future<TopUpResult> topUp(double amount) async {
    final wallet = state.value;
    final result = await ref.read(walletRepositoryProvider).topUp(amount);

    if (AppConfig.useMocks) {
      // Mock repo yalnızca bonusu hesaplar; bakiyeyi burada toplarız.
      final balance = (wallet?.balance ?? 0) + amount;
      state = AsyncData(
        Wallet(balance: balance, cardLast4: wallet?.cardLast4 ?? '7412'),
      );
      return TopUpResult(balance: balance, bonusDrinks: result.bonusDrinks);
    }

    // API modunda sunucu hem bakiyeyi hem bonusu işledi.
    state = AsyncData(
      Wallet(balance: result.balance, cardLast4: wallet?.cardLast4 ?? '7412'),
    );
    ref.invalidate(loyaltyStatusProvider);
    return result;
  }
}
