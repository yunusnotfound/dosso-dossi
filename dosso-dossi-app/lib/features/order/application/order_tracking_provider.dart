import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/widgets.dart';

import '../../../core/network/runtime_mode.dart';
import '../../../core/network/session_scope.dart';
import '../../../core/diagnostics/app_telemetry.dart';
import '../data/order_repository.dart';
import '../domain/order_record.dart';
import 'order_providers.dart';

const _pollInterval = Duration(seconds: 10);

/// Canlı sipariş takibi. API modunda GET /orders/:id 10 sn'de bir yoklanır;
/// sipariş tamamlanınca/iptal edilince yoklama durur ve geçmiş tazelenir.
/// Mock modunda durum, sipariş yaşına göre yerelde simüle edilir
/// (backend'in dev otomatik ilerletmesiyle aynı tempoda: 8 sn → 20 sn).
/// autoDispose: ekran kapanınca zamanlayıcı da ölür — aksi halde açılan
/// her sipariş için sonsuza dek arka planda yoklama sürerdi.
final orderTrackingProvider = AsyncNotifierProvider.autoDispose
    .family<OrderTrackingController, OrderRecord, String>(
      OrderTrackingController.new,
    );

class OrderTrackingController extends AsyncNotifier<OrderRecord> {
  OrderTrackingController(this.orderId);

  final String orderId;
  Timer? _timer;
  int _generation = 0;
  int? _pollingGeneration;

  @override
  Future<OrderRecord> build() async {
    final generation = ++_generation;
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    ref.onDispose(() => _timer?.cancel());
    final OrderRecord record;
    try {
      record = await _fetch(orderId);
    } catch (error) {
      if (ref.mounted && scope.revision == epoch && generation == _generation) {
        ref
            .read(telemetryProvider)
            .report(TelemetryOperation.orderTracking, error);
      }
      // Keep Riverpod's bounded automatic retry. The screen additionally offers
      // an explicit retry and refreshes on foreground after retries run out.
      rethrow;
    }
    if (ref.mounted &&
        scope.revision == epoch &&
        generation == _generation &&
        !_isTerminal(record.status)) {
      _timer = Timer.periodic(_pollInterval, (_) => _poll(orderId));
    }
    return record;
  }

  Future<void> _poll(String orderId) async {
    if (!ref.mounted || _pollingGeneration == _generation) return;
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    if (lifecycle != null && lifecycle != AppLifecycleState.resumed) return;
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    final generation = _generation;
    _pollingGeneration = generation;
    try {
      final record = await _fetch(orderId);
      if (!ref.mounted ||
          scope.revision != epoch ||
          generation != _generation) {
        return;
      }
      state = AsyncData(record);
      if (_isTerminal(record.status)) {
        _timer?.cancel();
        ref.invalidate(ordersProvider); // geçmiş listesi güncel durumu görsün
      }
    } catch (error) {
      // Ağ hatasında eski durum ekranda kalır; sonraki tur tekrar dener
      if (ref.mounted && scope.revision == epoch && generation == _generation) {
        ref
            .read(telemetryProvider)
            .report(TelemetryOperation.orderTracking, error);
      }
    } finally {
      if (_pollingGeneration == generation) _pollingGeneration = null;
    }
  }

  Future<OrderRecord> _fetch(String orderId) async {
    if (!ref.read(apiModeProvider)) return _mockRecord(orderId);
    return ref.read(orderRepositoryProvider).getOrder(orderId);
  }

  /// Mock: siparişin yaşına göre alındı → hazırlanıyor → hazır.
  /// Sipariş listede yoksa sahte boş kayıt üretilmez — ekran hata
  /// durumunu göstersin diye fırlatılır.
  OrderRecord _mockRecord(String orderId) {
    final record = ref.read(ordersProvider).where((o) => o.id == orderId);
    if (record.isEmpty) {
      throw StateError('Sipariş bulunamadı: $orderId');
    }
    final found = record.first;
    final age = DateTime.now().difference(found.createdAt);
    final status = age.inSeconds >= 20
        ? 'ready'
        : age.inSeconds >= 8
        ? 'preparing'
        : 'received';
    return found.copyWith(status: status);
  }

  bool _isTerminal(String status) =>
      status == 'completed' ||
      status == 'cancelled' ||
      (!ref.read(apiModeProvider) && status == 'ready');
}
