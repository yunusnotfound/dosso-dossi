import 'dart:async';

import 'package:dosso_dossi/core/network/session_scope.dart';
import 'package:dosso_dossi/features/rewards/application/loyalty_providers.dart';
import 'package:dosso_dossi/features/rewards/domain/loyalty_status.dart';
import 'package:dosso_dossi/features/scan_pay/application/top_up_flow_coordinator.dart';
import 'package:dosso_dossi/features/wallet/application/wallet_providers.dart';
import 'package:dosso_dossi/features/wallet/data/wallet_repository.dart';
import 'package:dosso_dossi/features/wallet/domain/wallet.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FlowWallet extends WalletController {
  final payment = Completer<TopUpResult>();
  final amounts = <double>[];

  @override
  Future<Wallet> build() async => const Wallet(balance: 100, cardLast4: '7412');

  @override
  Future<TopUpResult> topUp(double amount) {
    amounts.add(amount);
    return payment.future;
  }
}

class _FlowLoyalty extends LoyaltyController {
  int bonusesGranted = 0;

  @override
  Future<LoyaltyStatus> build() async => const LoyaltyStatus(stamps: 0);

  @override
  void addFreeDrinks(int count, String reason) => bonusesGranted += count;
}

void main() {
  late _FlowWallet wallet;
  late _FlowLoyalty loyalty;
  late ProviderContainer container;
  late TopUpFlowCoordinator coordinator;

  setUp(() {
    wallet = _FlowWallet();
    loyalty = _FlowLoyalty();
    container = ProviderContainer(
      overrides: [
        walletProvider.overrideWith(() => wallet),
        loyaltyStatusProvider.overrideWith(() => loyalty),
      ],
    );
    coordinator = container.read(topUpFlowCoordinatorProvider);
  });
  tearDown(() => container.dispose());

  Future<TopUpResult?> start({Future<bool?> Function()? confirm}) =>
      coordinator.confirmAndTopUp(
        amount: 1000,
        confirm: confirm ?? () async => true,
        isActive: () => true,
      );

  test(
    'a second action cannot open confirmation or charge while busy',
    () async {
      final confirmation = Completer<bool?>();
      final first = start(confirm: () => confirmation.future);
      var duplicateConfirmations = 0;
      Future<bool?> duplicateConfirmation() async {
        duplicateConfirmations++;
        return true;
      }

      expect(await start(confirm: duplicateConfirmation), isNull);
      expect(duplicateConfirmations, 0);
      expect(wallet.amounts, isEmpty);
      expect(container.read(topUpFlowProvider), isTrue);

      confirmation.complete(true);
      await Future<void>.delayed(Duration.zero);
      expect(wallet.amounts, [1000]);
      expect(await start(confirm: duplicateConfirmation), isNull);
      expect(duplicateConfirmations, 0);
      wallet.payment.complete(const TopUpResult(balance: 1100, bonusDrinks: 5));
      expect((await first)?.balance, 1100);
      expect(loyalty.bonusesGranted, 5);
      expect(container.read(topUpFlowProvider), isFalse);
    },
  );

  test('canceling confirmation releases the lock without charging', () async {
    expect(await start(confirm: () async => false), isNull);
    expect(wallet.amounts, isEmpty);
    expect(container.read(topUpFlowProvider), isFalse);
  });

  test(
    'switching account while confirmation is open prevents charging',
    () async {
      final confirmation = Completer<bool?>();
      final result = start(confirm: () => confirmation.future);
      container.read(sessionScopeProvider).advance();
      confirmation.complete(true);

      expect(await result, isNull);
      expect(wallet.amounts, isEmpty);
      expect(container.read(topUpFlowProvider), isFalse);
    },
  );

  test(
    'pending payments preserve their result and grant no mock bonus',
    () async {
      const pending = TopUpResult(
        balance: 100,
        bonusDrinks: 5,
        status: 'pending',
        paymentId: 'payment-1',
      );
      final result = start();
      wallet.payment.complete(pending);

      expect(await result, same(pending));
      expect(loyalty.bonusesGranted, 0);
      expect(container.read(topUpFlowProvider), isFalse);
    },
  );

  test('current payment failure is surfaced and releases the lock', () async {
    final error = StateError('offline');
    final result = start();
    final expectation = expectLater(result, throwsA(same(error)));
    await Future<void>.delayed(Duration.zero);
    wallet.payment.completeError(error);

    await expectation;
    expect(loyalty.bonusesGranted, 0);
    expect(container.read(topUpFlowProvider), isFalse);
  });

  test('late payment failure is hidden after the account changes', () async {
    final result = start();
    await Future<void>.delayed(Duration.zero);
    container.read(sessionScopeProvider).advance();
    wallet.payment.completeError(StateError('old account failure'));

    expect(await result, isNull);
    expect(loyalty.bonusesGranted, 0);
    expect(container.read(topUpFlowProvider), isFalse);
  });
}
