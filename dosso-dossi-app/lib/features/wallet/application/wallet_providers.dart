import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/runtime_mode.dart';
import '../../../core/network/session_scope.dart';
import '../../../core/network/api_exception.dart';
import '../../rewards/application/loyalty_providers.dart';
import '../data/wallet_repository.dart';
import '../domain/wallet.dart';

/// Dosso Kart bakiyesi. Ödeme ve yükleme akışları bu kontrolcüden geçer.
final walletProvider = AsyncNotifierProvider<WalletController, Wallet>(
  WalletController.new,
);

class WalletController extends AsyncNotifier<Wallet> {
  Future<TopUpResult>? _topUpPending;
  int? _topUpEpoch;
  int _dataVersion = 0;

  void clearForSession() {
    _dataVersion++;
    state = const AsyncLoading();
  }

  @override
  Future<Wallet> build() async {
    final version = _dataVersion;
    final wallet = await ref.watch(walletRepositoryProvider).getWallet();
    if (ref.mounted && version != _dataVersion && state.value != null) {
      return state.value!;
    }
    return wallet;
  }

  /// Bakiye yeterliyse düşer ve true döner.
  /// Yalnızca mock modunda kullanılır; API modunda ödemeyi sunucu yapar
  /// (sipariş ve hediye kendi endpoint'lerinde bakiyeyi düşer).
  Future<bool> pay(double amount) async {
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    final wallet = state.value;
    if (wallet == null || wallet.balance < amount) return false;
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!ref.mounted || scope.revision != epoch) return false;
    _dataVersion++;
    state = AsyncData(
      Wallet(balance: wallet.balance - amount, cardLast4: wallet.cardLast4),
    );
    return true;
  }

  /// Bakiye yükler; uygulanan bonusla birlikte sonucu döner.
  Future<TopUpResult> topUp(double amount) {
    final epoch = ref.read(sessionScopeProvider).revision;
    if (_topUpPending != null && _topUpEpoch == epoch) return _topUpPending!;
    _topUpEpoch = epoch;
    final pending = _topUp(amount);
    _topUpPending = pending;
    return pending.whenComplete(() {
      if (identical(_topUpPending, pending)) _topUpPending = null;
    });
  }

  Future<TopUpResult> _topUp(double amount) async {
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    // Kart numarası uydurulmaz: state henüz yüklenmediyse repodan çekilir.
    final wallet =
        state.value ?? await ref.read(walletRepositoryProvider).getWallet();
    if (!ref.mounted || scope.revision != epoch) {
      throw const ApiException(
        code: 'SESSION_CHANGED',
        message: 'Oturum değişti.',
      );
    }
    final result = await ref.read(walletRepositoryProvider).topUp(amount);

    if (!ref.mounted || scope.revision != epoch) {
      throw const ApiException(
        code: 'SESSION_CHANGED',
        message: 'Oturum değişti. Bakiyeni yeniden kontrol et.',
      );
    }

    if (!ref.read(apiModeProvider)) {
      // Mock repo yalnızca bonusu hesaplar; bakiyeyi burada toplarız.
      final balance = wallet.balance + amount;
      _dataVersion++;
      state = AsyncData(Wallet(balance: balance, cardLast4: wallet.cardLast4));
      return TopUpResult(balance: balance, bonusDrinks: result.bonusDrinks);
    }

    // API modunda sunucu hem bakiyeyi hem bonusu işledi.
    _dataVersion++;
    state = AsyncData(
      Wallet(balance: result.balance, cardLast4: wallet.cardLast4),
    );
    ref.invalidate(loyaltyStatusProvider);
    return result;
  }
}

final topUpFlowProvider = NotifierProvider<TopUpFlowController, bool>(
  TopUpFlowController.new,
);

class TopUpFlowController extends Notifier<bool> {
  @override
  bool build() => false;
  void set(bool value) => state = value;
}
