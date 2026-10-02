import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/runtime_mode.dart';
import '../../../core/network/session_scope.dart';
import '../../branches/application/branch_providers.dart';
import '../../branches/domain/branch.dart';
import '../data/order_repository.dart';
import '../domain/order_record.dart';

/// Sipariş için seçilen şube (null = en yakın şube kullanılır).
final selectedBranchProvider =
    NotifierProvider<SelectedBranchController, Branch?>(
      SelectedBranchController.new,
    );

class SelectedBranchController extends Notifier<Branch?> {
  @override
  Branch? build() => null;

  void select(Branch branch) => state = branch;
}

/// Ekranların kullanacağı etkin şube: seçilen yoksa en yakın.
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
  @override
  List<OrderRecord> build() {
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
    ref.read(ordersLoadProvider.notifier).set(const AsyncLoading());
    try {
      final records = await ref.read(orderRepositoryProvider).getOrders();
      if (!ref.mounted || scope.revision != epoch) return;
      state = records;
      ref.read(ordersLoadProvider.notifier).set(const AsyncData(null));
    } catch (error, stack) {
      if (ref.mounted && scope.revision == epoch) {
        ref.read(ordersLoadProvider.notifier).set(AsyncError(error, stack));
      }
      rethrow;
    }
  }

  void add(OrderRecord record) => state = [record, ...state];
}

final ordersLoadProvider =
    NotifierProvider<OrdersLoadController, AsyncValue<void>>(
      OrdersLoadController.new,
    );

class OrdersLoadController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);
  void set(AsyncValue<void> value) => state = value;
}
