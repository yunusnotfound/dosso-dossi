import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dosso_dossi/core/network/runtime_mode.dart';
import 'package:dosso_dossi/core/network/session_scope.dart';
import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/core/storage/token_storage.dart';
import 'package:dosso_dossi/features/auth/application/auth_controller.dart';
import 'package:dosso_dossi/features/auth/data/auth_repository.dart';
import 'package:dosso_dossi/features/auth/data/mock_auth_repository.dart';
import 'package:dosso_dossi/features/auth/domain/app_user.dart';
import 'package:dosso_dossi/features/order/application/cart_controller.dart';
import 'package:dosso_dossi/features/order/application/menu_providers.dart';
import 'package:dosso_dossi/features/order/application/order_providers.dart';
import 'package:dosso_dossi/features/order/application/order_tracking_provider.dart';
import 'package:dosso_dossi/features/order/data/order_repository.dart';
import 'package:dosso_dossi/features/order/domain/cart.dart';
import 'package:dosso_dossi/features/order/domain/menu.dart';
import 'package:dosso_dossi/features/order/domain/product_options.dart';
import 'package:dosso_dossi/features/order/domain/order_record.dart';
import 'package:dosso_dossi/features/branches/domain/branch.dart';
import 'package:dosso_dossi/features/profile/application/notification_prefs.dart';
import 'package:dosso_dossi/features/profile/data/notification_prefs_repository.dart';
import 'package:dosso_dossi/features/wallet/application/wallet_providers.dart';
import 'package:dosso_dossi/features/wallet/data/wallet_repository.dart';
import 'package:dosso_dossi/features/wallet/domain/wallet.dart';
import 'network_safety_test.dart' show MemoryTokens;

const branch = Branch(
  id: 'test',
  name: 'Test',
  address: 'Test',
  city: 'Test',
  distanceMeters: 0,
  isOpen: true,
  hours: '',
);
OrderRecord record([String status = 'received']) => OrderRecord(
  id: 'test',
  createdAt: DateTime(2026),
  branchName: 'Test',
  pickupLabel: 'Now',
  itemsLabel: 'Coffee',
  total: 10,
  stampsEarned: 1,
  status: status,
);

class OfflineOrders implements OrderRepository {
  Completer<OrderRecord> pending = Completer();
  int gets = 0;
  @override
  Future<OrderRecord> getOrder(String id) {
    gets++;
    return pending.future;
  }

  @override
  Future<List<OrderRecord>> getOrders() async => [];
  @override
  Future<OrderRecord> placeOrder({
    required Branch branch,
    required String pickupLabel,
    required CartState cart,
  }) => pending.future;
}

class OfflinePrefs implements NotificationPrefsRepository {
  final read = Completer<NotificationPrefs>();
  final saves = <NotificationPrefs>[];
  final writes = <Completer<void>>[];
  @override
  Future<NotificationPrefs> getPrefs() => read.future;
  @override
  Future<void> savePrefs(NotificationPrefs prefs) {
    saves.add(prefs);
    final c = Completer<void>();
    writes.add(c);
    return c.future;
  }
}

class OfflineWallet implements WalletRepository {
  int calls = 0;
  final pending = Completer<TopUpResult>();
  @override
  Future<Wallet> getWallet() async =>
      const Wallet(balance: 100, cardLast4: '0000');
  @override
  Future<TopUpResult> topUp(double amount) {
    calls++;
    return pending.future;
  }

  @override
  Future<QrTokenData> createQrToken(String phone) => throw UnimplementedError();
}

class RefreshingWallet extends OfflineWallet {
  Completer<Wallet>? refresh;
  @override
  Future<Wallet> getWallet() => refresh?.future ?? super.getWallet();
}

class ImmediateAuth extends MockAuthRepository {
  @override
  Future<AuthResult> verifyOtp({
    required String phone,
    required String code,
  }) async => AuthResult(
    token: 'login-A',
    refreshToken: 'refresh-A',
    user: AppUser(phone: phone),
  );
}

class DelayedTokens extends MemoryTokens {
  final entered = Completer<void>();
  final gate = Completer<void>();
  @override
  Future<bool> saveTokensIfCurrent({
    required String access,
    required String refresh,
    required bool Function() isCurrent,
    String? expectedRefresh,
  }) async {
    entered.complete();
    await gate.future;
    if (!isCurrent()) return false;
    return super.saveTokensIfCurrent(
      access: access,
      refresh: refresh,
      isCurrent: isCurrent,
      expectedRefresh: expectedRefresh,
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('logout clears cart, selected branch and free-drink choice', () async {
    SharedPreferences.setMockInitialValues({
      'auth_user': jsonEncode({'phone': '5550000000', 'name': 'Test'}),
    });
    final prefs = await SharedPreferences.getInstance();
    final tokens = MemoryTokens()..refresh = null;
    const p = Product(
      id: 'p',
      name: 'Coffee',
      price: 10,
      categoryId: 'coffee',
      emoji: 'C',
      description: '',
    );
    final c = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        tokenStorageProvider.overrideWithValue(tokens),
        menuProductsProvider.overrideWith((ref) async => [p]),
      ],
    );
    addTearDown(c.dispose);
    await c.read(authControllerProvider.future);
    c
        .read(cartProvider.notifier)
        .add(
          const CartItem(
            product: p,
            milk: ProductOptions.defaultMilk,
            shot: ProductOptions.defaultShot,
          ),
        );
    c.read(cartProvider.notifier).setUseFreeDrink(true);
    c.read(selectedBranchProvider.notifier).select(branch);
    await c.read(authControllerProvider.notifier).logout();
    expect(c.read(cartProvider).count, 0);
    expect(c.read(cartProvider).useFreeDrink, isFalse);
    expect(c.read(selectedBranchProvider), isNull);
  });
  testWidgets('tracking disposal before first response cannot create a timer', (
    tester,
  ) async {
    final repo = OfflineOrders();
    final c = ProviderContainer(
      overrides: [
        apiModeProvider.overrideWithValue(true),
        orderRepositoryProvider.overrideWithValue(repo),
      ],
    );
    c.listen(orderTrackingProvider('test'), (_, _) {});
    await tester.pump();
    c.dispose();
    repo.pending.complete(record());
    await tester.pump();
    await tester.pump(const Duration(seconds: 30));
    expect(repo.gets, 1);
    // The widget test binding also rejects any timer left after disposal.
  });
  testWidgets(
    'tracking follows ready to completed without overlapping requests',
    (tester) async {
      final repo = OfflineOrders();
      final c = ProviderContainer(
        overrides: [
          apiModeProvider.overrideWithValue(true),
          orderRepositoryProvider.overrideWithValue(repo),
        ],
      );
      c.listen(orderTrackingProvider('test'), (_, _) {});
      repo.pending.complete(record('ready'));
      await tester.pump();
      repo.pending = Completer();
      await tester.pump(const Duration(seconds: 30));
      expect(repo.gets, 2);
      repo.pending.complete(record('completed'));
      await tester.pump();
      expect(c.read(orderTrackingProvider('test')).value?.status, 'completed');
      await tester.pump(const Duration(seconds: 30));
      expect(repo.gets, 2);
      c.dispose();
    },
  );
  test(
    'preference writes serialize; late GET and old failure cannot undo latest edit',
    () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final repo = OfflinePrefs();
      final c = ProviderContainer(
        overrides: [
          apiModeProvider.overrideWithValue(true),
          sharedPreferencesProvider.overrideWithValue(prefs),
          notificationPrefsRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(c.dispose);
      final controller = c.read(notificationPrefsProvider.notifier);
      await Future<void>.delayed(Duration.zero);
      controller.update(
        const NotificationPrefs(
          campaigns: false,
          orderStatus: true,
          sms: false,
        ),
      );
      controller.update(
        const NotificationPrefs(
          campaigns: false,
          orderStatus: false,
          sms: true,
        ),
      );
      await Future<void>.delayed(Duration.zero);
      expect(repo.saves.length, 1);
      repo.read.complete(
        const NotificationPrefs(campaigns: true, orderStatus: true, sms: false),
      );
      repo.writes.first.completeError(StateError('offline'));
      await Future<void>.delayed(Duration.zero);
      expect(repo.saves.length, 2);
      expect(c.read(notificationPrefsProvider).sms, isTrue);
      repo.writes.last.complete();
      await Future<void>.delayed(Duration.zero);
      expect(c.read(notificationPrefsProvider).orderStatus, isFalse);
      expect(prefs.getBool('notif_sms'), isTrue);
    },
  );
  test('top-up single flight cannot credit a later account', () async {
    final repo = OfflineWallet();
    final c = ProviderContainer(
      overrides: [
        apiModeProvider.overrideWithValue(true),
        walletRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(c.dispose);
    await c.read(walletProvider.future);
    final first = c.read(walletProvider.notifier).topUp(100);
    c.invalidate(walletProvider);
    await c.read(walletProvider.future);
    final second = c.read(walletProvider.notifier).topUp(100);
    final assertions = [
      expectLater(first, throwsA(isA<Exception>())),
      expectLater(second, throwsA(isA<Exception>())),
    ];
    await Future<void>.delayed(Duration.zero);
    expect(repo.calls, 1);
    c.read(sessionScopeProvider).advance();
    repo.pending.complete(const TopUpResult(balance: 200, bonusDrinks: 0));
    await Future.wait(assertions);
    expect(c.read(walletProvider).value?.balance, 100);
  });
  test('late wallet refresh cannot undo a completed top-up', () async {
    final repo = RefreshingWallet();
    final c = ProviderContainer(
      overrides: [
        apiModeProvider.overrideWithValue(true),
        walletRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(c.dispose);
    await c.read(walletProvider.future);
    repo.refresh = Completer<Wallet>();
    c.invalidate(walletProvider);
    c.read(walletProvider);
    final topup = c.read(walletProvider.notifier).topUp(100);
    repo.pending.complete(const TopUpResult(balance: 200, bonusDrinks: 0));
    await topup;
    expect(c.read(walletProvider).value?.balance, 200);
    repo.refresh!.complete(const Wallet(balance: 100, cardLast4: '0000'));
    await Future<void>.delayed(Duration.zero);
    expect(c.read(walletProvider).value?.balance, 200);
  });
  test(
    'logout during OTP token save cannot be undone by login continuation',
    () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final tokens = DelayedTokens()..refresh = null;
      final c = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          tokenStorageProvider.overrideWithValue(tokens),
          authRepositoryProvider.overrideWithValue(ImmediateAuth()),
        ],
      );
      addTearDown(c.dispose);
      await c.read(authControllerProvider.future);
      final login = c
          .read(authControllerProvider.notifier)
          .verifyOtp(phone: '5551112233', code: '123456');
      await tokens.entered.future;
      await c.read(authControllerProvider.notifier).logout();
      tokens.gate.complete();
      await login;
      expect(c.read(authControllerProvider).value, isNull);
      expect(prefs.getString('auth_user'), isNull);
      expect(tokens.access, isNull);
    },
  );
}
