import 'dart:async';
import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/auth/data/auth_repository.dart';
import 'package:dosso_dossi/features/auth/presentation/phone_login_screen.dart';
import 'package:dosso_dossi/features/branches/application/branch_availability.dart';
import 'package:dosso_dossi/features/branches/domain/branch.dart';
import 'package:dosso_dossi/features/home/presentation/widgets/wallet_card.dart';
import 'package:dosso_dossi/features/wallet/application/wallet_providers.dart';
import 'package:dosso_dossi/features/wallet/domain/wallet.dart';
import 'package:dosso_dossi/routing/app_router.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PendingOtp implements AuthRepository {
  final pending = Completer<void>();
  String? sentTo;
  @override
  Future<void> sendOtp(String phone) {
    sentTo = phone;
    return pending.future;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class FixedWallet extends WalletController {
  @override
  Future<Wallet> build() async => const Wallet(balance: 100, cardLast4: '0000');
}

Branch branch({
  String hours = '07:00–23:00',
  bool isOpen = true,
  int prep = 7,
}) => Branch(
  id: 'A',
  name: 'A',
  address: 'A',
  city: 'A',
  hours: hours,
  isOpen: isOpen,
  prepMinutes: prep,
);

void main() {
  test(
    'account reset removes previous wallet values from loading state',
    () async {
      final c = ProviderContainer(
        overrides: [walletProvider.overrideWith(FixedWallet.new)],
      );
      addTearDown(c.dispose);
      await c.read(walletProvider.future);
      c.read(walletProvider.notifier).clearForSession();
      expect(c.read(walletProvider).isLoading, isTrue);
      expect(c.read(walletProvider).value?.balance, 0);
      expect(c.read(walletProvider).value?.cardLast4, isEmpty);
    },
  );

  test('branch availability matches Turkish hours and preparation cutoff', () {
    expect(
      branchAcceptsOrdersAt(branch(), DateTime.utc(2026, 10, 11, 3, 59)),
      isFalse,
    );
    expect(
      branchAcceptsOrdersAt(branch(), DateTime.utc(2026, 10, 11, 4)),
      isTrue,
    );
    expect(
      branchAcceptsOrdersAt(branch(), DateTime.utc(2026, 10, 11, 19, 52, 59)),
      isTrue,
    );
    expect(
      branchAcceptsOrdersAt(branch(), DateTime.utc(2026, 10, 11, 19, 53)),
      isFalse,
    );
    expect(
      branchAcceptsOrdersAt(
        branch(isOpen: false),
        DateTime.utc(2026, 10, 11, 10),
      ),
      isFalse,
    );
    expect(
      branchAcceptsOrdersAt(
        branch(hours: '22:00–02:00'),
        DateTime.utc(2026, 10, 11, 22),
      ),
      isTrue,
    );
    expect(
      branchAcceptsOrdersAt(
        branch(hours: '22:00–02:00'),
        DateTime.utc(2026, 10, 11, 23),
      ),
      isFalse,
    );
    expect(
      branchAcceptsOrdersAt(
        branch(hours: '24 saat'),
        DateTime.utc(2026, 10, 11, 23),
      ),
      isTrue,
    );
    expect(
      branchAcceptsOrdersAt(
        branch(hours: 'invalid'),
        DateTime.utc(2026, 10, 11, 10),
      ),
      isFalse,
    );
  });

  testWidgets(
    'pending OTP locks the field and navigates with the sent phone snapshot',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final auth = PendingOtp();
      final router = GoRouter(
        initialLocation: Routes.login,
        routes: [
          GoRoute(
            path: Routes.login,
            builder: (_, _) => const PhoneLoginScreen(),
          ),
          GoRoute(
            path: Routes.otp,
            builder: (_, state) =>
                Scaffold(body: Text('OTP ${state.uri.queryParameters['tel']}')),
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sharedPreferencesProvider.overrideWithValue(prefs),
            authRepositoryProvider.overrideWithValue(auth),
          ],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '5551112233');
      await tester.pump();
      await tester.tap(find.text('Kod Gönder'));
      await tester.pump();
      expect(auth.sentTo, '5551112233');
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.enabled, isFalse);
      // Even programmatic controller changes cannot alter the in-flight identity.
      field.controller!.text = '5559998877';
      auth.pending.complete();
      await tester.pumpAndSettle();
      expect(find.text('OTP 5551112233'), findsOneWidget);
    },
  );

  testWidgets('home load button opens top-up while QR button opens payment', (
    tester,
  ) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: WalletCard()),
        ),
        GoRoute(
          path: Routes.scanPay,
          builder: (_, state) => Scaffold(
            body: Text(
              state.uri.queryParameters['tab'] == 'yukle' ? 'TOPUP' : 'PAY',
            ),
          ),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [walletProvider.overrideWith(FixedWallet.new)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yükle'));
    await tester.pumpAndSettle();
    expect(find.text('TOPUP'), findsOneWidget);
    router.go('/');
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Tara ve Öde'));
    await tester.pumpAndSettle();
    expect(find.text('PAY'), findsOneWidget);
  });
}
