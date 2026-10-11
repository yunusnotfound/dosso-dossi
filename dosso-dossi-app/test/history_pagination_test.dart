import 'dart:async';
import 'package:dosso_dossi/core/network/history_page.dart';
import 'package:dosso_dossi/core/network/runtime_mode.dart';
import 'package:dosso_dossi/core/network/session_scope.dart';
import 'package:dosso_dossi/features/order/application/order_providers.dart';
import 'package:dosso_dossi/features/order/data/order_repository.dart';
import 'package:dosso_dossi/features/order/data/api_order_repository.dart';
import 'package:dosso_dossi/features/gift/data/api_gift_repository.dart';
import 'package:dosso_dossi/features/rewards/data/api_loyalty_repository.dart';
import 'package:dosso_dossi/features/order/domain/order_record.dart';
import 'package:dosso_dossi/features/gift/application/gift_controller.dart';
import 'package:dosso_dossi/features/gift/data/gift_repository.dart';
import 'package:dosso_dossi/features/gift/domain/gift_record.dart';
import 'package:dosso_dossi/features/rewards/application/loyalty_providers.dart';
import 'package:dosso_dossi/features/rewards/data/loyalty_repository.dart';
import 'package:dosso_dossi/features/rewards/domain/loyalty_status.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'network_safety_test.dart' show offlineDio, jsonResponse;

OrderRecord order(int index) => OrderRecord(
  id: 'DD-$index',
  createdAt: DateTime(2026).subtract(Duration(minutes: index)),
  branchName: 'A',
  pickupLabel: 'Now',
  itemsLabel: 'Coffee',
  total: 10,
  stampsEarned: 1,
);
GiftRecord gift(int index) => GiftRecord(
  id: 'gift-$index',
  phone: '5550000000',
  label: 'Coffee',
  amount: 10,
  date: DateTime(2026).subtract(Duration(minutes: index)),
);
RewardEntry reward(int index) => RewardEntry(
  id: 'reward-$index',
  title: 'Reward $index',
  used: false,
  date: DateTime(2026).subtract(Duration(minutes: index)),
);

class OrderPages implements OrderRepository, PagedOrderRepository {
  OrderPages(this.fetch);
  final Future<HistoryPage<OrderRecord>> Function(String?) fetch;
  @override
  Future<HistoryPage<OrderRecord>> getOrdersPage({String? cursor}) =>
      fetch(cursor);
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class GiftPages implements GiftRepository, PagedGiftRepository {
  GiftPages(this.fetch);
  final Future<HistoryPage<GiftRecord>> Function(String?) fetch;
  @override
  Future<HistoryPage<GiftRecord>> getGiftsPage({String? cursor}) =>
      fetch(cursor);
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class LoyaltyPages implements LoyaltyRepository, PagedLoyaltyRepository {
  LoyaltyPages(this.fetch);
  final Future<LoyaltyStatus> Function(String?) fetch;
  @override
  Future<LoyaltyStatus> getHistoryPage({String? cursor}) => fetch(cursor);
  @override
  Future<LoyaltyStatus> getStatus() => fetch(null);
}

void main() {
  test(
    'history repositories use the paginated API contract and decode cursors',
    () async {
      var requests = 0;
      final dio = offlineDio((options) {
        requests++;
        expect(options.queryParameters['cursor'], 'opaque-cursor');
        expect(options.queryParameters['limit'], 20);
        if (options.path == '/orders') {
          expect(options.queryParameters['paginated'], true);
          return jsonResponse(200, {
            'items': [
              {
                'id': 'DD-1',
                'createdAt': '2026-10-11T12:00:00Z',
                'total': 100,
                'stampsEarned': 1,
                'items': [],
              },
            ],
            'nextCursor': 'orders-next',
          });
        }
        if (options.path == '/gifts') {
          expect(options.queryParameters['paginated'], true);
          return jsonResponse(200, {
            'items': [
              {
                'id': 'gift-1',
                'recipientPhone': '5550000000',
                'label': 'Gift',
                'amount': 100,
                'date': '2026-10-11T12:00:00Z',
              },
            ],
            'nextCursor': 'gifts-next',
          });
        }
        return jsonResponse(200, {
          'stamps': 3,
          'target': 5,
          'freeDrinks': 1,
          'history': [
            {
              'id': 'reward-1',
              'title': 'Reward',
              'date': '2026-10-11T12:00:00Z',
              'used': false,
            },
          ],
          'nextCursor': 'rewards-next',
        });
      });
      addTearDown(dio.close);
      final orders = await ApiOrderRepository(
        dio,
      ).getOrdersPage(cursor: 'opaque-cursor');
      final gifts = await ApiGiftRepository(
        dio,
      ).getGiftsPage(cursor: 'opaque-cursor');
      final loyalty = await ApiLoyaltyRepository(
        dio,
      ).getHistoryPage(cursor: 'opaque-cursor');
      expect(orders.items.single.id, 'DD-1');
      expect(orders.nextCursor, 'orders-next');
      expect(gifts.items.single.id, 'gift-1');
      expect(gifts.nextCursor, 'gifts-next');
      expect(loyalty.history.single.id, 'reward-1');
      expect(loyalty.nextCursor, 'rewards-next');
      expect(requests, 3);
    },
  );

  test(
    'a non-overlapping new head restarts its cursor rather than skipping a gap',
    () async {
      var replaced = false;
      final repo = OrderPages(
        (cursor) async => cursor != null
            ? HistoryPage(items: [order(1)], nextCursor: 'tail')
            : HistoryPage(
                items: [order(replaced ? -100 : 0)],
                nextCursor: replaced ? 'gap' : 'older',
              ),
      );
      final c = ProviderContainer(
        overrides: [
          apiModeProvider.overrideWithValue(false),
          orderRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(c.dispose);
      final controller = c.read(ordersProvider.notifier);
      await controller.refresh();
      await controller.loadMore();
      replaced = true;
      await controller.refresh();
      expect(c.read(ordersProvider).map((o) => o.id), ['DD--100']);
      expect(c.read(ordersPaginationProvider).nextCursor, 'gap');
    },
  );

  test(
    'orders reach older than 50, deduplicate, retain pages on head refresh and retry failed pages',
    () async {
      var fail = true;
      var newHead = false;
      final repo = OrderPages((cursor) async {
        final offset = int.parse(cursor ?? '0');
        if (offset == 20 && fail) throw StateError('offline');
        return HistoryPage(
          items: [
            if (offset == 0 && newHead) order(-1),
            if (offset == 20) order(19),
            for (var i = offset; i < offset + 20; i++) order(i),
          ],
          nextCursor: offset < 40 ? '${offset + 20}' : null,
        );
      });
      final c = ProviderContainer(
        overrides: [
          apiModeProvider.overrideWithValue(false),
          orderRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(c.dispose);
      final controller = c.read(ordersProvider.notifier);
      await controller.refresh();
      await controller.loadMore();
      expect(c.read(ordersProvider).length, 20);
      expect(c.read(ordersPaginationProvider).error, isNotNull);
      expect(c.read(ordersPaginationProvider).nextCursor, '20');
      fail = false;
      await controller.loadMore();
      expect(c.read(ordersProvider).length, 40);
      newHead = true;
      await controller.refresh();
      expect(c.read(ordersProvider).length, 41);
      expect(c.read(ordersPaginationProvider).nextCursor, '40');
      await controller.loadMore();
      expect(c.read(ordersProvider).length, 61);
      expect(c.read(ordersPaginationProvider).hasMore, isFalse);
    },
  );

  test(
    'a head refresh supersedes an older page without locking pagination',
    () async {
      final pending = Completer<HistoryPage<OrderRecord>>();
      final repo = OrderPages(
        (cursor) async => cursor == null
            ? HistoryPage(items: [order(0)], nextCursor: 'next')
            : pending.future,
      );
      final c = ProviderContainer(
        overrides: [
          apiModeProvider.overrideWithValue(false),
          orderRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(c.dispose);
      final controller = c.read(ordersProvider.notifier);
      await controller.refresh();
      final request = controller.loadMore();
      expect(c.read(ordersPaginationProvider).isLoading, isTrue);
      await controller.refresh();
      pending.complete(HistoryPage(items: [order(1)]));
      await request;
      expect(c.read(ordersProvider).map((o) => o.id), ['DD-0']);
      expect(c.read(ordersPaginationProvider).isLoading, isFalse);
      expect(c.read(ordersPaginationProvider).hasMore, isTrue);
    },
  );

  test(
    'gift pages survive a head refresh and late pages cannot enter a new account',
    () async {
      Completer<HistoryPage<GiftRecord>>? pending;
      final repo = GiftPages(
        (cursor) async => cursor == null
            ? HistoryPage(items: [gift(0)], nextCursor: 'one')
            : pending?.future ??
                  HistoryPage(items: [gift(0), gift(1)], nextCursor: 'two'),
      );
      final c = ProviderContainer(
        overrides: [
          apiModeProvider.overrideWithValue(false),
          giftRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(c.dispose);
      final controller = c.read(giftControllerProvider.notifier);
      await controller.refresh();
      await controller.loadMore();
      await controller.refresh();
      expect(c.read(giftControllerProvider).length, 2);
      expect(c.read(giftsPaginationProvider).nextCursor, 'two');
      pending = Completer();
      final request = controller.loadMore();
      c.read(sessionScopeProvider).advance();
      c.invalidate(giftControllerProvider);
      expect(c.read(giftControllerProvider), isEmpty);
      pending.complete(HistoryPage(items: [gift(99)]));
      await request;
      expect(c.read(giftControllerProvider), isEmpty);
      expect(c.read(giftsPaginationProvider).hasMore, isFalse);
    },
  );

  test(
    'loyalty paging preserves current summary, deduplicates and keeps loaded history on refresh',
    () async {
      final repo = LoyaltyPages(
        (cursor) async => LoyaltyStatus(
          stamps: cursor == null ? 3 : 1,
          freeDrinks: cursor == null ? 5 : 0,
          history: cursor == null ? [reward(0)] : [reward(0), reward(1)],
          nextCursor: cursor == null ? 'next' : null,
        ),
      );
      final c = ProviderContainer(
        overrides: [loyaltyRepositoryProvider.overrideWithValue(repo)],
      );
      addTearDown(c.dispose);
      await c.read(loyaltyStatusProvider.future);
      await c.read(loyaltyStatusProvider.notifier).loadMore();
      expect(c.read(loyaltyStatusProvider).requireValue.history.length, 2);
      expect(c.read(loyaltyStatusProvider).requireValue.stamps, 3);
      expect(c.read(loyaltyStatusProvider).requireValue.freeDrinks, 5);
      await c.refresh(loyaltyStatusProvider.future);
      expect(c.read(loyaltyStatusProvider).requireValue.history.length, 2);
      expect(c.read(loyaltyPaginationProvider).hasMore, isFalse);
    },
  );

  test('loyalty pending page cannot restore another account history', () async {
    final pending = Completer<LoyaltyStatus>();
    final repo = LoyaltyPages(
      (cursor) async => cursor == null
          ? LoyaltyStatus(stamps: 3, history: [reward(0)], nextCursor: 'next')
          : pending.future,
    );
    final c = ProviderContainer(
      overrides: [loyaltyRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(c.dispose);
    await c.read(loyaltyStatusProvider.future);
    final controller = c.read(loyaltyStatusProvider.notifier);
    final request = controller.loadMore();
    c.read(sessionScopeProvider).advance();
    controller.clearForSession();
    pending.complete(LoyaltyStatus(stamps: 1, history: [reward(1)]));
    await request;
    expect(c.read(loyaltyStatusProvider).isLoading, isTrue);
    expect(c.read(loyaltyStatusProvider).value?.history, isEmpty);
    expect(c.read(loyaltyStatusProvider).value?.freeDrinks, 0);
    expect(c.read(loyaltyPaginationProvider).hasMore, isFalse);
  });
}
