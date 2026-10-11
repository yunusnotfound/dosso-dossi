import 'dart:async';

import 'package:dosso_dossi/core/network/api_exception.dart';
import 'package:dosso_dossi/core/network/runtime_mode.dart';
import 'package:dosso_dossi/features/branches/domain/branch.dart';
import 'package:dosso_dossi/features/order/data/order_repository.dart';
import 'package:dosso_dossi/features/order/application/order_tracking_provider.dart';
import 'package:dosso_dossi/features/order/domain/cart.dart';
import 'package:dosso_dossi/features/order/domain/order_record.dart';
import 'package:dosso_dossi/features/order/presentation/order_tracking_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _Orders implements OrderRepository {
  var calls = 0;
  @override
  Future<OrderRecord> getOrder(String id) async {
    if (++calls == 1) {
      throw const ApiException(code: 'NETWORK_ERROR', message: 'Offline');
    }
    return OrderRecord(
      id: id,
      createdAt: DateTime(2026),
      branchName: 'Merkez',
      pickupLabel: 'Şimdi',
      itemsLabel: 'Kahve',
      total: 100,
      stampsEarned: 1,
      status: 'completed',
    );
  }

  @override
  Future<List<OrderRecord>> getOrders() async => [];
  @override
  Future<OrderRecord> placeOrder({
    required Branch branch,
    required String pickupLabel,
    required CartState cart,
  }) => throw UnimplementedError();
}

class _DelayedOrders extends _Orders {
  final requests = <Completer<OrderRecord>>[];
  @override
  Future<OrderRecord> getOrder(String id) {
    final pending = Completer<OrderRecord>();
    requests.add(pending);
    return pending.future;
  }
}

OrderRecord _record(String status) => OrderRecord(
  id: 'order',
  createdAt: DateTime(2026),
  branchName: 'Merkez',
  pickupLabel: 'Şimdi',
  itemsLabel: 'Kahve',
  total: 100,
  stampsEarned: 1,
  status: status,
);

Future<void> _pump(WidgetTester tester, _Orders repository) async {
  await tester.pumpWidget(
    ProviderScope(
      // Simulate the state after Riverpod's bounded automatic retries are exhausted.
      retry: (_, _) => null,
      overrides: [
        apiModeProvider.overrideWithValue(true),
        orderRepositoryProvider.overrideWithValue(repository),
      ],
      child: const MaterialApp(home: OrderTrackingScreen(orderId: 'order')),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'retry refresh cannot be overwritten by an older in-flight poll',
    (tester) async {
      final repository = _DelayedOrders();
      final container = ProviderContainer(
        overrides: [
          apiModeProvider.overrideWithValue(true),
          orderRepositoryProvider.overrideWithValue(repository),
        ],
      );
      container.listen(orderTrackingProvider('order'), (_, _) {});
      repository.requests.first.complete(_record('received'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 10));
      expect(repository.requests, hasLength(2));
      container.invalidate(orderTrackingProvider('order'));
      container.read(orderTrackingProvider('order'));
      await tester.pump();
      expect(repository.requests, hasLength(3));
      repository.requests.last.complete(_record('completed'));
      await tester.pump();
      repository.requests[1].complete(_record('preparing'));
      await tester.pump();
      expect(
        container.read(orderTrackingProvider('order')).value?.status,
        'completed',
      );
      container.dispose();
    },
  );
  testWidgets('tracking can be explicitly retried after initial failure', (
    tester,
  ) async {
    final repository = _Orders();
    await _pump(tester, repository);
    expect(find.text('Tekrar dene'), findsOneWidget);
    await tester.tap(find.text('Tekrar dene'));
    await tester.pumpAndSettle();
    expect(find.text('Teslim edildi'), findsOneWidget);
    expect(repository.calls, 2);
  });

  testWidgets('foreground retries failed tracking without reopening screen', (
    tester,
  ) async {
    final repository = _Orders();
    await _pump(tester, repository);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(find.text('Teslim edildi'), findsOneWidget);
    expect(repository.calls, 2);
  });
}
