import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../data/order_repository.dart';
import '../domain/order_record.dart';
import 'order_providers.dart';

const _pollInterval = Duration(seconds: 10);

/// Canlı sipariş takibi. API modunda GET /orders/:id 10 sn'de bir yoklanır;
/// sipariş HAZIR/tamamlanınca yoklama durur ve geçmiş tazelenir.
/// Mock modunda durum, sipariş yaşına göre yerelde simüle edilir
/// (backend'in dev otomatik ilerletmesiyle aynı tempoda: 8 sn → 20 sn).
final orderTrackingProvider = AsyncNotifierProvider.family<
    OrderTrackingController, OrderRecord, String>(OrderTrackingController.new);

class OrderTrackingController extends AsyncNotifier<OrderRecord> {
  OrderTrackingController(this.orderId);

  final String orderId;
  Timer? _timer;

  @override
  Future<OrderRecord> build() async {
    ref.onDispose(() => _timer?.cancel());
    final record = await _fetch(orderId);
    if (!_isTerminal(record.status)) {
      _timer = Timer.periodic(_pollInterval, (_) => _poll(orderId));
    }
    return record;
  }

  Future<void> _poll(String orderId) async {
    try {
      final record = await _fetch(orderId);
      state = AsyncData(record);
      if (_isTerminal(record.status)) {
        _timer?.cancel();
        ref.invalidate(ordersProvider); // geçmiş listesi güncel durumu görsün
      }
    } catch (_) {
      // Ağ hatasında eski durum ekranda kalır; sonraki tur tekrar dener
    }
  }

  Future<OrderRecord> _fetch(String orderId) async {
    if (AppConfig.useMocks) return _mockRecord(orderId);
    return ref.read(orderRepositoryProvider).getOrder(orderId);
  }

  /// Mock: siparişin yaşına göre alındı → hazırlanıyor → hazır.
  OrderRecord _mockRecord(String orderId) {
    final record = ref
        .read(ordersProvider)
        .firstWhere((o) => o.id == orderId, orElse: () => _missing(orderId));
    final age = DateTime.now().difference(record.createdAt);
    final status = age.inSeconds >= 20
        ? 'ready'
        : age.inSeconds >= 8
            ? 'preparing'
            : 'received';
    return record.copyWith(status: status);
  }

  OrderRecord _missing(String orderId) => OrderRecord(
        id: orderId,
        createdAt: DateTime.now(),
        branchName: '',
        pickupLabel: '',
        itemsLabel: '',
        total: 0,
        stampsEarned: 0,
      );

  bool _isTerminal(String status) =>
      status == 'ready' || status == 'completed' || status == 'cancelled';
}
