import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../branches/application/branch_providers.dart';
import '../../branches/domain/branch.dart';
import '../data/order_repository.dart';
import '../domain/order_record.dart';

/// Sipariş için seçilen şube (null = en yakın şube kullanılır).
final selectedBranchProvider =
    NotifierProvider<SelectedBranchController, Branch?>(
        SelectedBranchController.new);

class SelectedBranchController extends Notifier<Branch?> {
  @override
  Branch? build() => null;

  void select(Branch branch) => state = branch;
}

/// Ekranların kullanacağı etkin şube: seçilen yoksa en yakın.
final activeBranchProvider = FutureProvider<Branch>((ref) async {
  final selected = ref.watch(selectedBranchProvider);
  if (selected != null) return selected;
  return ref.watch(nearestBranchProvider.future);
});

/// Tamamlanan siparişler (geçmiş siparişler ekranı Faz 7'de bunu okuyacak).
final ordersProvider =
    NotifierProvider<OrdersController, List<OrderRecord>>(OrdersController.new);

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
      state = await ref.read(orderRepositoryProvider).getOrders();
    } catch (_) {
      // Ağ hatasında liste boş kalır; sonraki sipariş/ekran açılışı tazeler.
    }
  }

  void add(OrderRecord record) => state = [record, ...state];
}
