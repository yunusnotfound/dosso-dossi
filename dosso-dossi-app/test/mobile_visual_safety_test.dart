import 'dart:async';
import 'dart:convert';
import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/campaigns/application/public_config.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/campaign_stamp_progress.dart';
import 'package:dosso_dossi/features/rewards/domain/loyalty_status.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/load_rewards_offer.dart';
import 'package:dosso_dossi/features/order/application/menu_providers.dart';
import 'package:dosso_dossi/features/order/domain/menu.dart';
import 'package:dosso_dossi/features/scan_pay/presentation/scan_pay_screen.dart';
import 'package:dosso_dossi/features/shop/presentation/shop_screen.dart';
import 'package:dosso_dossi/features/wallet/data/wallet_repository.dart';
import 'package:dosso_dossi/features/wallet/domain/wallet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

class QrWallet implements WalletRepository {
  QrWallet(this.reply);
  Future<QrTokenData> Function() reply;
  int calls = 0;
  @override
  Future<QrTokenData> createQrToken(String phone) {
    calls++;
    return reply();
  }

  @override
  Future<Wallet> getWallet() async =>
      const Wallet(balance: 100, cardLast4: '0000');
  @override
  Future<TopUpResult> topUp(double amount) => throw UnimplementedError();
}

Future<SharedPreferences> prefs() async {
  SharedPreferences.setMockInitialValues({
    'auth_user': jsonEncode({'phone': '5551112233', 'name': 'Test'}),
  });
  return SharedPreferences.getInstance();
}

void main() {
  for (final size in [const Size(375, 667), const Size(320, 568)]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets('shop remains usable with keyboard at $size / text $scale', (
        tester,
      ) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1;
        tester.view.padding = const FakeViewPadding(top: 44);
        tester.view.viewInsets = const FakeViewPadding(bottom: 336);
        addTearDown(tester.view.reset);
        final semantics = tester.ensureSemantics();
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              sharedPreferencesProvider.overrideWithValue(await prefs()),
              menuCategoriesProvider.overrideWith((ref) async => []),
              menuProductsProvider.overrideWith(
                (ref) async => [
                  const Product(
                    id: 'mug',
                    name: 'Test Mug',
                    price: 100,
                    categoryId: 'merch',
                    description: '',
                    emoji: 'M',
                    hasOptions: false,
                  ),
                ],
              ),
            ],
            child: MaterialApp(
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: TextScaler.linear(scale)),
                child: child!,
              ),
              home: const ShopScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(
          tester
              .getSemantics(find.byTooltip('Sepetim'))
              .getSemanticsData()
              .tooltip,
          'Sepetim',
        );
        expect(
          tester
              .getSemantics(find.byTooltip('Favorilerim'))
              .getSemanticsData()
              .tooltip,
          'Favorilerim',
        );
        await tester.dragUntilVisible(
          find.byTooltip('Test Mug, favorilere ekle'),
          find.byType(ListView).first,
          const Offset(0, -80),
        );
        await tester.pumpAndSettle();
        expect(
          tester
              .getSemantics(find.byTooltip('Test Mug, favorilere ekle'))
              .getSemanticsData()
              .tooltip,
          'Test Mug, favorilere ekle',
        );
        expect(
          tester
              .getSize(find.byTooltip('Test Mug, favorilere ekle'))
              .shortestSide,
          greaterThanOrEqualTo(48),
        );
        await tester.dragUntilVisible(
          find.text('Sepete ekle'),
          find.byType(ListView).first,
          const Offset(0, -80),
        );
        await tester.pumpAndSettle();
        expect(find.text('Sepete ekle').hitTestable(), findsOneWidget);
        expect(find.bySemanticsLabel('Test Mug, sepete ekle'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        semantics.dispose();
      });
    }
  }
  testWidgets('coffee progress remains readable and announced at large text', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: const TextScaler.linear(2)),
          child: child!,
        ),
        home: const Scaffold(
          body: SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: CampaignStampProgress(status: LoyaltyStatus(stamps: 3)),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('5 kahveden 3 tamamlandı'), findsOneWidget);
    expect(tester.takeException(), isNull);
    semantics.dispose();
  });
  testWidgets('QR uses server expiry and displays retry after first failure', (
    tester,
  ) async {
    final repository = QrWallet(() async => throw StateError('offline'));
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(await prefs()),
        walletRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: ScanPayScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Ödeme kodu yüklenemedi.'), findsOneWidget);
    expect(find.byType(QrImageView), findsNothing);
    repository.reply = () async => QrTokenData(
      code: 'test-qr',
      expiresAt: DateTime.now().add(const Duration(seconds: 25)),
    );
    await tester.tap(find.text('Tekrar dene'));
    await tester.pumpAndSettle();
    expect(find.byType(QrImageView), findsOneWidget);
    expect(find.textContaining('Kod 25 sn'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });
  testWidgets(
    'QR hidden tab stops refreshing and does not overlap a pending request',
    (tester) async {
      final pending = Completer<QrTokenData>();
      final repository = QrWallet(() => pending.future);
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(await prefs()),
          walletRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);
      Widget screen(bool visible) => UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: TickerMode(enabled: visible, child: const ScanPayScreen()),
        ),
      );
      await tester.pumpWidget(screen(true));
      await tester.pump();
      await tester.pump(const Duration(seconds: 4));
      expect(repository.calls, 1);
      await tester.pumpWidget(screen(false));
      pending.complete(
        QrTokenData(
          code: 'expired',
          expiresAt: DateTime.now().subtract(const Duration(seconds: 1)),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(seconds: 4));
      expect(repository.calls, 1);
      expect(find.byType(QrImageView), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'public campaign rules update amount reward and first-only copy',
    (tester) async {
      var rules = const CampaignRules(
        topupThreshold: 1500,
        topupBonusDrinks: 7,
        topupFirstOnly: false,
      );
      final container = ProviderContainer(
        overrides: [publicConfigProvider.overrideWith((ref) async => rules)],
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(home: Scaffold(body: LoadRewardsOffer())),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('1.500 ₺'), findsOneWidget);
      expect(find.text('7 kahve'), findsOneWidget);
      expect(find.text('YÜKLEMEYE ÖZEL'), findsOneWidget);
      rules = const CampaignRules(topupThreshold: 2000, topupBonusDrinks: 3);
      container.invalidate(publicConfigProvider);
      await tester.pumpAndSettle();
      expect(find.text('2.000 ₺'), findsOneWidget);
      expect(find.text('3 kahve'), findsOneWidget);
      expect(find.text('İLK YÜKLEMEYE ÖZEL'), findsOneWidget);
    },
  );
}
