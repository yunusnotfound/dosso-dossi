import 'dart:convert';

import 'package:dosso_dossi/app.dart';
import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/campaigns/presentation/campaign_kahve_screen.dart';
import 'package:dosso_dossi/features/campaigns/presentation/campaign_yukle_kazan_screen.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/campaign_progress_card.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/campaign_wallet_card.dart';
import 'package:dosso_dossi/features/home/presentation/widgets/load_rewards_banner.dart';
import 'package:dosso_dossi/features/rewards/application/loyalty_providers.dart';
import 'package:dosso_dossi/features/rewards/data/loyalty_repository.dart';
import 'package:dosso_dossi/features/rewards/domain/loyalty_status.dart';
import 'package:dosso_dossi/features/scan_pay/presentation/scan_pay_screen.dart';
import 'package:dosso_dossi/features/wallet/application/wallet_providers.dart';
import 'package:dosso_dossi/features/wallet/data/wallet_repository.dart';
import 'package:dosso_dossi/features/wallet/domain/wallet.dart';
import 'package:dosso_dossi/routing/app_router.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> _pumpApp(
  WidgetTester tester, {
  bool guest = false,
  WalletRepository? walletRepository,
  LoyaltyRepository? loyaltyRepository,
}) async {
  SharedPreferences.setMockInitialValues({
    if (guest)
      'auth_guest': true
    else
      'auth_user': jsonEncode({'phone': '5551112233', 'name': 'Elif Kaya'}),
  });
  final prefs = await SharedPreferences.getInstance();
  // These tests exercise navigation and account data, using the test suite's
  // default viewport. Mobile layout is checked separately with the real fonts.
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        if (walletRepository != null)
          walletRepositoryProvider.overrideWithValue(walletRepository),
        if (loyaltyRepository != null)
          loyaltyRepositoryProvider.overrideWithValue(loyaltyRepository),
      ],
      child: const DossoDossiApp(),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _openCampaign(WidgetTester tester) async {
  final banner = find.byType(LoadRewardsBanner);
  await tester.dragUntilVisible(
    banner,
    find.byType(ListView).first,
    const Offset(0, -160),
  );
  await Scrollable.ensureVisible(tester.element(banner), alignment: 0.15);
  await tester.pumpAndSettle();
  await tester.tap(banner);
  await tester.pumpAndSettle();
  expect(find.byType(CampaignYukleKazanScreen), findsOneWidget);
}

Future<void> _tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Finder _inLoadCampaign(Finder finder) => find.descendant(
  of: find.byType(CampaignYukleKazanScreen),
  matching: finder,
);

Finder _inCoffeeCampaign(Finder finder) =>
    find.descendant(of: find.byType(CampaignKahveScreen), matching: finder);

Finder _inWallet(Finder finder) => find.descendant(
  of: _inLoadCampaign(find.byType(CampaignWalletCard)),
  matching: finder,
);

Finder _inProgress(Finder finder) => find.descendant(
  of: _inCoffeeCampaign(find.byType(CampaignProgressCard)),
  matching: finder,
);

void main() {
  testWidgets('load campaign keeps wallet, coffee campaign shows live progress', (
    tester,
  ) async {
    await _pumpApp(tester);
    await _openCampaign(tester);

    expect(_inWallet(find.textContaining('425,50')), findsOneWidget);
    expect(_inLoadCampaign(find.byType(CampaignProgressCard)), findsNothing);

    // Loading rewards retain the live wallet, with no coffee-progress block.
    final container = ProviderScope.containerOf(
      tester.element(find.byType(CampaignYukleKazanScreen)),
    );
    final payment = container.read(walletProvider.notifier).pay(25.50);
    await tester.pump(const Duration(milliseconds: 600));
    expect(await payment, isTrue);
    await tester.pumpAndSettle();
    expect(_inWallet(find.textContaining('400,00')), findsOneWidget);
    expect(_inLoadCampaign(find.byType(CampaignProgressCard)), findsNothing);

    // The moved block reads the same account and continues reacting to changes.
    container.read(appRouterProvider).go(Routes.campaignKahve);
    await tester.pumpAndSettle();
    expect(find.byType(CampaignKahveScreen), findsOneWidget);
    expect(
      _inCoffeeCampaign(find.byType(CampaignProgressCard)),
      findsOneWidget,
    );
    expect(_inProgress(find.text('3 / 5', findRichText: true)), findsOneWidget);
    container.read(loyaltyStatusProvider.notifier).addStamps(1);
    await tester.pumpAndSettle();
    expect(_inProgress(find.text('4 / 5', findRichText: true)), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('both load actions open top-up, including a retained pay tab', (
    tester,
  ) async {
    await _pumpApp(tester);
    await _openCampaign(tester);
    await _tapVisible(tester, _inWallet(find.text('Yükle')));

    expect(find.byType(ScanPayScreen), findsOneWidget);
    expect(find.text('Mevcut bakiye'), findsOneWidget);
    expect(find.text('TUTAR SEÇ'), findsOneWidget);
    expect(find.byType(QrImageView), findsNothing);

    // The shell retains this screen. Opening the campaign again must override
    // the customer's previous choice of the Öde segment.
    await _tapVisible(tester, find.text('Öde'));
    expect(find.byType(QrImageView), findsOneWidget);
    expect(find.text('TUTAR SEÇ'), findsNothing);
    await tester.tap(find.text('Ana Sayfa').last);
    await tester.pumpAndSettle();
    await _openCampaign(tester);
    await _tapVisible(tester, find.text('Uygulamadan yükle'));

    expect(find.byType(ScanPayScreen), findsOneWidget);
    expect(find.text('Mevcut bakiye'), findsOneWidget);
    expect(find.text('TUTAR SEÇ'), findsOneWidget);
    expect(find.byType(QrImageView), findsNothing);
    expect(tester.takeException(), isNull);

    // Dispose the retained screen and its refresh timer before test teardown.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets(
    'guest load action requests sign-in without fetching account data',
    (tester) async {
      final wallet = _NoGuestWallet();
      final loyalty = _NoGuestLoyalty();
      await _pumpApp(
        tester,
        guest: true,
        walletRepository: wallet,
        loyaltyRepository: loyalty,
      );
      await _openCampaign(tester);

      expect(_inWallet(find.text('Giriş yap')), findsOneWidget);
      expect(_inWallet(find.textContaining('₺')), findsNothing);
      expect(_inLoadCampaign(find.byType(CampaignProgressCard)), findsNothing);
      expect(
        _inLoadCampaign(find.text('3 / 5', findRichText: true)),
        findsNothing,
      );
      await _tapVisible(tester, find.text('Uygulamadan yükle'));

      expect(find.text('Bunun için hesap gerekiyor'), findsOneWidget);
      expect(find.textContaining('Bakiye yüklemek için giriş'), findsOneWidget);
      expect(find.byType(ScanPayScreen), findsNothing);
      expect(wallet.requestCount, 0);
      expect(loyalty.requestCount, 0);

      await _tapVisible(tester, find.text('Konuk olarak devam et'));
      final container = ProviderScope.containerOf(
        tester.element(find.byType(CampaignYukleKazanScreen)),
      );
      container.read(appRouterProvider).go(Routes.campaignKahve);
      await tester.pumpAndSettle();
      expect(find.byType(CampaignKahveScreen), findsOneWidget);
      expect(
        _inCoffeeCampaign(find.byType(CampaignProgressCard)),
        findsOneWidget,
      );
      expect(_inProgress(find.text('Giriş yap / Üye ol')), findsOneWidget);
      expect(
        _inCoffeeCampaign(find.text('3 / 5', findRichText: true)),
        findsNothing,
      );
      expect(wallet.requestCount, 0);
      expect(loyalty.requestCount, 0);
      expect(tester.takeException(), isNull);
    },
  );
}

class _NoGuestWallet implements WalletRepository {
  int requestCount = 0;

  @override
  Future<Wallet> getWallet() async {
    requestCount++;
    throw StateError('Guest requested private wallet data');
  }

  @override
  Future<QrTokenData> createQrToken(String phone) async {
    requestCount++;
    throw StateError('Guest requested a payment code');
  }

  @override
  Future<TopUpResult> topUp(double amount) async {
    requestCount++;
    throw StateError('Guest attempted a wallet top-up');
  }
}

class _NoGuestLoyalty implements LoyaltyRepository {
  int requestCount = 0;

  @override
  Future<LoyaltyStatus> getStatus() async {
    requestCount++;
    throw StateError('Guest requested private loyalty data');
  }
}
