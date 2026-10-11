import 'dart:async';
import 'package:dosso_dossi/core/network/api_exception.dart';
import 'package:dosso_dossi/core/network/session_scope.dart';
import 'package:dosso_dossi/features/account/application/account_providers.dart';
import 'package:dosso_dossi/features/account/data/account_repository.dart';
import 'package:dosso_dossi/features/account/domain/account_records.dart';
import 'package:dosso_dossi/features/account/presentation/account_requests_screen.dart';
import 'package:dosso_dossi/features/account/presentation/data_export_screen.dart';
import 'package:dosso_dossi/features/account/presentation/notifications_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _Repository extends MockAccountRepository {
  int calls = 0;
  int submissions = 0;
  int reads = 0;
  bool failSubmit = false;
  bool failRead = false;
  bool unread = true;
  final queries = <int>[];
  Completer<List<AccountRequest>>? pending;
  Completer<void>? pendingRead;
  @override
  Future<List<AccountRequest>> requests() {
    calls++;
    return pending?.future ?? super.requests();
  }

  @override
  Future<void> submit(String kind, String note) async {
    submissions++;
    if (failSubmit) {
      throw const ApiException(
        code: 'NETWORK_ERROR',
        message: 'Bağlantı kurulamadı',
      );
    }
    await super.submit(kind, note);
  }

  @override
  Future<InboxPage> inbox(int page) async {
    calls++;
    return InboxPage(
      entries: [
        InboxItem(
          id: 'n1',
          title: 'Hediye geldi',
          body: 'Bir kahve seni bekliyor.',
          targetPath: '',
          readAt: unread ? null : DateTime(2026),
          createdAt: DateTime(2026),
        ),
      ],
      unreadCount: unread ? 1 : 0,
      hasMore: false,
    );
  }

  @override
  Future<void> markRead(String id) async {
    reads++;
    if (pendingRead != null) await pendingRead!.future;
    if (failRead) {
      throw const ApiException(code: 'NETWORK_ERROR', message: 'Tekrar dene');
    }
    unread = false;
  }

  @override
  Future<ExportPage> export(String section, int page) async {
    calls++;
    queries.add(page);
    return ExportPage(
      section: section,
      page: page,
      entries: [
        {'record': page},
      ],
      hasMore: page == 1,
    );
  }
}

Widget _app(AccountRepository repository, Widget child, {bool access = true}) =>
    ProviderScope(
      overrides: [
        accountAccessProvider.overrideWithValue(access),
        accountRepositoryProvider.overrideWithValue(repository),
      ],
      child: MaterialApp(home: child),
    );

void main() {
  testWidgets(
    'closure confirmation cannot submit to an account changed while dialog is open',
    (tester) async {
      final old = _Repository();
      final fresh = _Repository();
      final container = ProviderContainer(
        overrides: [
          accountAccessProvider.overrideWithValue(true),
          accountRepositoryProvider.overrideWithValue(old),
        ],
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(home: AccountRequestsScreen()),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Hesap kapatma').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Eski hesabın özel notu');
      await tester.ensureVisible(find.text('Talep oluştur'));
      await tester.tap(find.text('Talep oluştur'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      container.read(sessionScopeProvider).advance();
      container.updateOverrides([
        accountAccessProvider.overrideWithValue(true),
        accountRepositoryProvider.overrideWithValue(fresh),
      ]);
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text('Talep oluştur'),
        ),
      );
      await tester.pumpAndSettle();
      expect(old.submissions, 0);
      expect(fresh.submissions, 0);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        isEmpty,
      );
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNotNull,
      );
    },
  );

  testWidgets(
    'old notification read cannot lock or show errors in a new account',
    (tester) async {
      final old = _Repository()..pendingRead = Completer<void>();
      final fresh = _Repository();
      final container = ProviderContainer(
        overrides: [
          accountAccessProvider.overrideWithValue(true),
          accountRepositoryProvider.overrideWithValue(old),
        ],
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(home: NotificationsScreen()),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Hediye geldi'));
      await tester.pump();
      container.read(sessionScopeProvider).advance();
      container.updateOverrides([
        accountAccessProvider.overrideWithValue(true),
        accountRepositoryProvider.overrideWithValue(fresh),
      ]);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Hediye geldi'));
      await tester.pumpAndSettle();
      expect(fresh.reads, 1);
      old.pendingRead!.completeError(
        const ApiException(
          code: 'NETWORK_ERROR',
          message: 'Eski hesabın hatası',
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Eski hesabın hatası'), findsNothing);
      expect(find.byIcon(Icons.notifications_none), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  test('notification links only allow known internal destinations', () {
    for (final path in [
      '/siparis-takip/DD-1042',
      '/profil/hesap-talepleri',
      '/ikramlarim',
    ]) {
      expect(safeNotificationTarget(path), path);
    }
    for (final path in [
      'https://example.com',
      '//example.com',
      '/profil/verilerim',
      '/siparis-takip/../admin',
      '/tara-ode?token=secret',
    ]) {
      expect(safeNotificationTarget(path), isNull);
    }
  });
  testWidgets('guest pages do not fetch any account data', (tester) async {
    final repo = _Repository();
    for (final page in [
      const AccountRequestsScreen(),
      const DataExportScreen(),
      const NotificationsScreen(),
    ]) {
      await tester.pumpWidget(_app(repo, page, access: false));
      await tester.pumpAndSettle();
      expect(
        find.text('Bu sayfa için hesabına giriş yapmalısın.'),
        findsOneWidget,
      );
    }
    expect(repo.calls, 0);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'failed account request preserves note and permits a safe retry',
    (tester) async {
      final repo = _Repository()..failSubmit = true;
      await tester.pumpWidget(_app(repo, const AccountRequestsScreen()));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Veri kopyamı istiyorum');
      await tester.ensureVisible(find.text('Talep oluştur'));
      await tester.tap(find.text('Talep oluştur'));
      await tester.pumpAndSettle();
      expect(find.text('Veri kopyamı istiyorum'), findsOneWidget);
      repo.failSubmit = false;
      await tester.tap(find.text('Talep oluştur'));
      await tester.pumpAndSettle();
      expect(repo.submissions, 2);
      expect(find.text('Bu türde devam eden bir talebin var.'), findsOneWidget);
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
    },
  );
  testWidgets(
    'notification read failure retains unread state until retry succeeds',
    (tester) async {
      final repo = _Repository()..failRead = true;
      await tester.pumpWidget(_app(repo, const NotificationsScreen()));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Hediye geldi'));
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.notifications_active_outlined), findsOneWidget);
      repo.failRead = false;
      await tester.tap(find.text('Hediye geldi'));
      await tester.pumpAndSettle();
      expect(repo.reads, 2);
      expect(find.byIcon(Icons.notifications_none), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('data export only advances while the server has more records', (
    tester,
  ) async {
    final repo = _Repository();
    await tester.pumpWidget(_app(repo, const DataExportScreen()));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Sonraki'));
    await tester.tap(find.text('Sonraki'));
    await tester.pumpAndSettle();
    expect(repo.queries, [1, 2]);
    expect(
      tester
          .widget<TextButton>(find.widgetWithText(TextButton, 'Sonraki'))
          .onPressed,
      isNull,
    );
  });
  test(
    'late account data cannot replace data after the repository changes',
    () async {
      final old = _Repository()..pending = Completer<List<AccountRequest>>();
      final fresh = _Repository();
      final container = ProviderContainer(
        overrides: [
          accountAccessProvider.overrideWithValue(true),
          accountRepositoryProvider.overrideWithValue(old),
        ],
      );
      addTearDown(container.dispose);
      final subscription = container.listen(accountRequestsProvider, (_, _) {});
      addTearDown(subscription.close);
      await Future<void>.delayed(Duration.zero);
      container.updateOverrides([
        accountAccessProvider.overrideWithValue(true),
        accountRepositoryProvider.overrideWithValue(fresh),
      ]);
      expect(await container.read(accountRequestsProvider.future), isEmpty);
      old.pending!.complete([
        AccountRequest(
          id: 'old',
          kind: 'CLOSURE',
          status: 'OPEN',
          note: '',
          response: '',
          createdAt: DateTime(2026),
        ),
      ]);
      await Future<void>.delayed(Duration.zero);
      expect(container.read(accountRequestsProvider).value, isEmpty);
    },
  );
}
