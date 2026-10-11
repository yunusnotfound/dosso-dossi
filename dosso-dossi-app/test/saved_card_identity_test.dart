import 'dart:convert';

import 'package:dosso_dossi/core/network/runtime_mode.dart';
import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/campaigns/application/public_config.dart';
import 'package:dosso_dossi/features/profile/presentation/profile_screen.dart';
import 'package:dosso_dossi/features/rewards/data/loyalty_repository.dart';
import 'package:dosso_dossi/features/rewards/domain/loyalty_status.dart';
import 'package:dosso_dossi/features/scan_pay/presentation/scan_pay_screen.dart';
import 'package:dosso_dossi/features/wallet/data/wallet_repository.dart';
import 'package:dosso_dossi/features/wallet/domain/wallet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _WalletRepository implements WalletRepository {
  int topUps = 0;

  @override
  Future<Wallet> getWallet() async =>
      const Wallet(balance: 425.50, cardLast4: '7412');

  @override
  Future<TopUpResult> topUp(double amount) async {
    topUps++;
    return TopUpResult(balance: amount, bonusDrinks: 0);
  }

  @override
  Future<QrTokenData> createQrToken(String phone) => throw UnimplementedError();
}

class _LoyaltyRepository implements LoyaltyRepository {
  @override
  Future<LoyaltyStatus> getStatus() async => const LoyaltyStatus(stamps: 0);
}

Future<void> _pumpScreen(
  WidgetTester tester,
  Widget screen,
  _WalletRepository wallet,
) async {
  SharedPreferences.setMockInitialValues({
    'auth_user': jsonEncode({'phone': '5551112233', 'name': 'Berkay'}),
  });
  final prefs = await SharedPreferences.getInstance();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        apiModeProvider.overrideWithValue(false),
        walletRepositoryProvider.overrideWithValue(wallet),
        loyaltyRepositoryProvider.overrideWithValue(_LoyaltyRepository()),
        publicConfigProvider.overrideWith((ref) async => const CampaignRules()),
      ],
      child: MaterialApp(home: screen),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('profile menu never turns wallet identity into a saved Visa', (
    tester,
  ) async {
    await _pumpScreen(tester, const ProfileScreen(), _WalletRepository());
    expect(find.text('₺425,50'), findsOneWidget);
    expect(find.text('Kayıtlı Kartlar'), findsOneWidget);
    expect(find.text('Kart yok'), findsOneWidget);
    expect(find.textContaining('Visa'), findsNothing);
    expect(find.textContaining('7412'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'top-up selection and confirmation show simulation without invented bank card',
    (tester) async {
      final wallet = _WalletRepository();
      await _pumpScreen(tester, const ScanPayScreen(initialTab: 1), wallet);
      expect(
        find.text('Simülasyon yüklemesi · Gerçek ödeme alınmaz'),
        findsOneWidget,
      );
      expect(find.textContaining('Visa'), findsNothing);
      expect(find.textContaining('7412'), findsNothing);
      final topUp = find.widgetWithText(FilledButton, 'Yükle · ₺250,00');
      await tester.ensureVisible(topUp);
      await tester.tap(topUp);
      await tester.pumpAndSettle();
      expect(
        find.textContaining(
          'Dosso Dossi Kart hesabına ₺250,00 test bakiyesi eklenecek.',
        ),
        findsOneWidget,
      );
      expect(find.textContaining('Visa'), findsNothing);
      expect(find.textContaining('7412'), findsNothing);
      expect(wallet.topUps, 0);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
