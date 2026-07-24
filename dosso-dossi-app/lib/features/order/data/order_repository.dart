import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../branches/domain/branch.dart';
import '../domain/cart.dart';
import '../domain/order_record.dart';
import 'api_order_repository.dart';

/// Sipariş veri kaynağı sözleşmesi.
/// Mock modunda kullanılmaz: sipariş simülasyonu CartController'da kalır
/// (cüzdan/damga yan etkileriyle birlikte). API modunda tüm hesap sunucuda.
abstract interface class OrderRepository {
  Future<OrderRecord> placeOrder({
    required Branch branch,
    required String pickupLabel,
    required CartState cart,
  });

  Future<List<OrderRecord>> getOrders();

  /// Canlı sipariş takibi: güncel durum sunucudan okunur.
  Future<OrderRecord> getOrder(String id);
}

final orderRepositoryProvider = Provider<OrderRepository>((ref) {
  return ApiOrderRepository(ref.watch(apiClientProvider));
});
