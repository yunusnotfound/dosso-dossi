import 'dart:async';

import 'package:dosso_dossi/core/network/api_exception.dart';
import 'package:dosso_dossi/core/network/mutation_intents.dart';
import 'package:dosso_dossi/core/network/runtime_mode.dart';
import 'package:dosso_dossi/core/network/session_scope.dart';
import 'package:dosso_dossi/features/gift/application/gift_controller.dart';
import 'package:dosso_dossi/features/gift/data/api_gift_repository.dart';
import 'package:dosso_dossi/features/gift/data/gift_repository.dart';
import 'package:dosso_dossi/features/gift/domain/gift_record.dart';
import 'package:dosso_dossi/features/wallet/data/api_wallet_repository.dart';
import 'package:dosso_dossi/features/wallet/application/wallet_providers.dart';
import 'package:dosso_dossi/features/wallet/domain/wallet.dart';
import 'package:dosso_dossi/features/rewards/application/loyalty_providers.dart';
import 'package:dosso_dossi/features/rewards/domain/loyalty_status.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'network_safety_test.dart' show offlineDio, jsonResponse;

GiftRecord _gift(String id) => GiftRecord(
  id: id,
  phone: '5551112233',
  label: 'Hediye',
  amount: 100,
  date: DateTime(2026, 10, 7),
);

class _Gifts implements GiftRepository {
  final loads = <Completer<List<GiftRecord>>>[];
  @override
  Future<List<GiftRecord>> getGifts() {
    final pending = Completer<List<GiftRecord>>();
    loads.add(pending);
    return pending.future;
  }

  @override
  Future<GiftRecord> sendGift({
    required String recipientPhone,
    required String type,
    String? productId,
    double? amount,
    double? expectedTotal,
    String note = '',
  }) async => _gift('new');
}

class _ClaimingGifts extends _Gifts implements GiftClaimRepository {
  var claims = 0;
  @override
  Future<int> claimReceivedGifts() async {
    claims++;
    return 1;
  }
}

class _Wallet extends WalletController {
  var loads = 0;
  @override
  Future<Wallet> build() async =>
      Wallet(balance: (++loads) * 100, cardLast4: '0000');
}

class _Loyalty extends LoyaltyController {
  var loads = 0;
  @override
  Future<LoyaltyStatus> build() async =>
      LoyaltyStatus(stamps: 0, freeDrinks: ++loads);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'malformed successful gift receipt reuses intent until decoded',
    () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final keys = <String>[];
      final dio = offlineDio((request) {
        keys.add(request.data['idempotencyKey'] as String);
        return jsonResponse(200, {
          'id': 'gift',
          'recipientPhone': '5551112233',
          'label': 'Hediye',
          'amount': 100,
          if (keys.length > 1) 'date': '2026-10-07T12:00:00Z',
        });
      })..interceptors.add(MutationIntents(prefs, session: SessionScope()));
      addTearDown(dio.close);
      final repository = ApiGiftRepository(dio);
      Future<GiftRecord> send() => repository.sendGift(
        recipientPhone: '5551112233',
        type: 'balance',
        amount: 100,
      );
      await expectLater(
        send(),
        throwsA(
          isA<ApiException>().having(
            (error) => error.code,
            'code',
            'GIFT_RESPONSE_UNCONFIRMED',
          ),
        ),
      );
      expect((await send()).id, 'gift');
      await send();
      expect(keys[1], keys[0]);
      expect(keys[2], isNot(keys[0]));
    },
  );

  test(
    'top-up retains intent through malformed and pending receipts',
    () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final keys = <String>[];
      final dio = offlineDio((request) {
        keys.add(request.data['idempotencyKey'] as String);
        return jsonResponse(200, {
          if (keys.length > 1) 'balance': 100,
          'bonusDrinks': 0,
          'status': keys.length == 2 ? 'pending' : 'succeeded',
        });
      })..interceptors.add(MutationIntents(prefs, session: SessionScope()));
      addTearDown(dio.close);
      final repository = ApiWalletRepository(dio);
      await expectLater(repository.topUp(100), throwsA(isA<ApiException>()));
      expect((await repository.topUp(100)).isPending, isTrue);
      await repository.topUp(100);
      await repository.topUp(100);
      expect(keys.take(3).toSet(), hasLength(1));
      expect(keys.last, isNot(keys.first));
    },
  );

  test(
    'late history preserves sent gift until server returns its ID',
    () async {
      final repository = _Gifts();
      final container = ProviderContainer(
        overrides: [
          apiModeProvider.overrideWithValue(true),
          giftRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);
      final controller = container.read(giftControllerProvider.notifier);
      await Future<void>.delayed(Duration.zero);
      await controller.send(_gift('draft'));
      repository.loads.first.complete([]);
      await Future<void>.delayed(Duration.zero);
      expect(container.read(giftControllerProvider).single.id, 'new');
      final refresh = controller.refresh();
      repository.loads.last.complete([_gift('new')]);
      await refresh;
      expect(container.read(giftControllerProvider).map((gift) => gift.id), [
        'new',
      ]);
    },
  );

  test('older history request cannot overwrite newer history', () async {
    final repository = _Gifts();
    final container = ProviderContainer(
      overrides: [
        apiModeProvider.overrideWithValue(true),
        giftRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);
    final controller = container.read(giftControllerProvider.notifier);
    await Future<void>.delayed(Duration.zero);
    final refresh = controller.refresh();
    repository.loads.last.complete([_gift('latest')]);
    await refresh;
    repository.loads.first.complete([_gift('older')]);
    await Future<void>.delayed(Duration.zero);
    expect(container.read(giftControllerProvider).single.id, 'latest');
  });

  test(
    'claim reconciliation precedes history and refreshes account balances',
    () async {
      final repository = _ClaimingGifts();
      final container = ProviderContainer(
        overrides: [
          apiModeProvider.overrideWithValue(true),
          giftRepositoryProvider.overrideWithValue(repository),
          walletProvider.overrideWith(_Wallet.new),
          loyaltyStatusProvider.overrideWith(_Loyalty.new),
        ],
      );
      addTearDown(container.dispose);
      expect((await container.read(walletProvider.future)).balance, 100);
      expect(
        (await container.read(loyaltyStatusProvider.future)).freeDrinks,
        1,
      );
      container.read(giftControllerProvider);
      await Future<void>.delayed(Duration.zero);
      expect(repository.claims, 1);
      expect(repository.loads, hasLength(1));
      repository.loads.single.complete([]);
      await Future<void>.delayed(Duration.zero);
      expect((await container.read(walletProvider.future)).balance, 200);
      expect(
        (await container.read(loyaltyStatusProvider.future)).freeDrinks,
        2,
      );
    },
  );
}
