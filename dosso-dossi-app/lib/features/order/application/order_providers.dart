import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/runtime_mode.dart';
import '../../../core/network/session_scope.dart';
import '../../../core/network/history_page.dart';
import '../../../core/diagnostics/app_telemetry.dart';
import '../../branches/application/branch_providers.dart';
import '../../branches/domain/branch.dart';
import '../data/order_repository.dart';
import '../domain/order_record.dart';

/// Sipariş için seçilen şube (null = mevcut listedeki ilk şube kullanılır).
final selectedBranchProvider =
    NotifierProvider<SelectedBranchController, Branch?>(
      SelectedBranchController.new,
    );

class SelectedBranchController extends Notifier<Branch?> {
  @override
  Branch? build() => null;

  void select(Branch branch) => state = branch;
}

/// Ekranların kullanacağı etkin şube: seçilen yoksa listedeki ilk şube.
/// Aynı AsyncValue'dan türetilir; arka plandaki sekme yeniden açıldığında
/// ayrı bir Future önbelleği eski şube bilgisini tutmaz.
final activeBranchProvider = Provider<AsyncValue<Branch>>((ref) {
  final selected = ref.watch(selectedBranchProvider);
  return ref.watch(branchesProvider).whenData((branches) {
    if (selected != null) {
      for (final branch in branches) {
        if (branch.id == selected.id) return branch;
      }
    }
    if (branches.isEmpty) {
      throw StateError('Şu anda sipariş alınabilen şube yok.');
    }
    return branches.first;
  });
});

/// Tamamlanan siparişler (geçmiş siparişler ekranı Faz 7'de bunu okuyacak).
final ordersProvider = NotifierProvider<OrdersController, List<OrderRecord>>(
  OrdersController.new,
);

class OrdersController extends Notifier<List<OrderRecord>> {
  int _refreshSequence = 0;
  final _unseenLocalOrders = <String, OrderRecord>{};
  HistoryPagination _pagination = const HistoryPagination();
  HistoryPagination get pagination => _pagination;
  bool _loadedOlder = false;

  @override
  List<OrderRecord> build() {
    _refreshSequence++;
    _unseenLocalOrders.clear();
    _pagination = const HistoryPagination();
    _loadedOlder = false;
    // API modunda geçmiş siparişler sunucudan yüklenir (mock'ta oturum içi).
    if (ref.read(apiModeProvider)) {
      Future.microtask(_loadFromApi);
    }
    return [];
  }

  Future<void> _loadFromApi() async {
    try {
      await refresh();
    } catch (_) {}
  }

  Future<void> refresh() async {
    if (!ref.mounted) return;
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    final sequence = ++_refreshSequence;
    if (_pagination.isLoading) {
      _pagination = HistoryPagination(nextCursor: _pagination.nextCursor);
      state = [...state];
    }
    ref.read(ordersLoadProvider.notifier).set(const AsyncLoading());
    try {
      final repository = ref.read(orderRepositoryProvider);
      final page = repository is PagedOrderRepository
          ? await (repository as PagedOrderRepository).getOrdersPage()
          : HistoryPage(items: await repository.getOrders());
      final records = page.items;
      if (!ref.mounted ||
          scope.revision != epoch ||
          sequence != _refreshSequence) {
        return;
      }
      // Preserve an already loaded tail only when the new head overlaps it.
      // If many new records arrived, restart pagination rather than skip a gap.
      _loadedOlder =
          _loadedOlder &&
          records.isNotEmpty &&
          !_unseenLocalOrders.containsKey(records.last.id) &&
          state.any((order) => order.id == records.last.id);
      for (final record in records) {
        _unseenLocalOrders.remove(record.id);
      }
      _pagination = HistoryPagination(
        nextCursor: _loadedOlder ? _pagination.nextCursor : page.nextCursor,
      );
      state = {
        if (_loadedOlder)
          for (final order in state) order.id: order,
        ..._unseenLocalOrders,
        for (final order in records) order.id: order,
      }.values.toList()..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      ref.read(ordersLoadProvider.notifier).set(const AsyncData(null));
    } catch (error, stack) {
      if (!ref.mounted ||
          scope.revision != epoch ||
          sequence != _refreshSequence) {
        return;
      }
      ref.read(ordersLoadProvider.notifier).set(AsyncError(error, stack));
      ref
          .read(telemetryProvider)
          .report(TelemetryOperation.orderHistory, error);
      rethrow;
    }
  }

  Future<void> loadMore() async {
    final cursor = _pagination.nextCursor;
    final repository = ref.read(orderRepositoryProvider);
    if (cursor == null ||
        _pagination.isLoading ||
        ref.read(ordersLoadProvider).isLoading ||
        repository is! PagedOrderRepository) {
      return;
    }
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    final sequence = _refreshSequence;
    bool current() =>
        ref.mounted && scope.revision == epoch && sequence == _refreshSequence;
    _pagination = HistoryPagination(nextCursor: cursor, isLoading: true);
    state = [...state];
    try {
      final page = await (repository as PagedOrderRepository).getOrdersPage(
        cursor: cursor,
      );
      if (!current()) return;
      _loadedOlder = true;
      _pagination = HistoryPagination(nextCursor: page.nextCursor);
      state = {
        for (final order in page.items) order.id: order,
        for (final order in state) order.id: order,
      }.values.toList()..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    } catch (error) {
      if (!current()) return;
      _pagination = HistoryPagination(nextCursor: cursor, error: error);
      state = [...state];
    }
  }

  void add(OrderRecord record) {
    _unseenLocalOrders[record.id] = record;
    state = [record, ...state.where((order) => order.id != record.id)];
  }
}

final ordersPaginationProvider = Provider<HistoryPagination>((ref) {
  ref.watch(ordersProvider);
  return ref.read(ordersProvider.notifier).pagination;
});

/// A receipt is resolved by its route ID, independently of history ordering.
final orderReceiptProvider = FutureProvider.autoDispose
    .family<OrderRecord, String>((ref, id) async {
      for (final record in ref.read(ordersProvider)) {
        if (record.id == id) return record;
      }
      return ref.read(orderRepositoryProvider).getOrder(id);
    });

final ordersLoadProvider =
    NotifierProvider<OrdersLoadController, AsyncValue<void>>(
      OrdersLoadController.new,
    );

class OrdersLoadController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);
  void set(AsyncValue<void> value) => state = value;
}
