import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
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
    if (!AppConfig.useMocks) {
      Future.microtask(_loadFromApi);
    }
    return [];
  }

  Future<void> _loadFromApi() async {
    try {
      await refresh();
    } catch (_) {
      // Ağ hatasında liste boş kalır; sonraki sipariş/ekran açılışı tazeler.
    }
  }

  /// Panelde değişen sipariş durumlarını listeyi boşaltmadan tazeler.
  /// Hata çağırana iletilir; canlı eşitleme sonraki denemede tekrar yükler.
  Future<void> refresh() async {
    final orders = await ref.read(orderRepositoryProvider).getOrders();
    if (ref.mounted) state = orders;
  }

  void add(OrderRecord record) => state = [record, ...state];
}
