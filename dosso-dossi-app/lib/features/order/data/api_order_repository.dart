import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/financial_receipt.dart';
import '../../../core/network/history_page.dart';
import '../../../core/diagnostics/app_telemetry.dart';
import '../../branches/domain/branch.dart';
import '../domain/cart.dart';
import '../domain/order_record.dart';
import 'order_repository.dart';

class ApiOrderRepository implements OrderRepository, PagedOrderRepository {
  ApiOrderRepository(this._dio);

  final Dio _dio;

  @override
  Future<OrderRecord> placeOrder({
    required Branch branch,
    required String pickupLabel,
    required CartState cart,
  }) {
    return postFinancialReceipt(
      dio: _dio,
      path: ApiEndpoints.orders,
      operation: TelemetryOperation.orderReceipt,
      decode: _orderFromJson,
      unconfirmed: const ApiException(
        code: 'ORDER_RESPONSE_UNCONFIRMED',
        message:
            'Sipariş sonucu doğrulanamadı. Aynı siparişin sonucunu tekrar kontrol et.',
      ),
      data: {
        'branchId': branch.id,
        'expectedTotal': double.parse(cart.total.toStringAsFixed(2)),
        'pickupSlot': pickupLabel,
        'items': [
          for (final item in cart.items)
            {
              'productId': item.product.id,
              'quantity': item.quantity,
              'size': '',
              'milk': item.product.hasOptions ? item.milk.name : '',
              'shot': item.product.hasOptions ? item.shot.name : '',
            },
        ],
        if (cart.promoCode != null) 'promoCode': cart.promoCode,
        'useFreeDrink': cart.useFreeDrink,
        'payment': {'method': 'dosso_card'},
      },
    );
  }

  @override
  Future<List<OrderRecord>> getOrders() {
    return apiCall(() async {
      final res = await _dio.get<List<dynamic>>(ApiEndpoints.orders);
      return [
        for (final item in res.data!)
          _orderFromJson(item as Map<String, dynamic>),
      ];
    });
  }

  @override
  Future<HistoryPage<OrderRecord>> getOrdersPage({String? cursor}) =>
      apiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>(
          ApiEndpoints.orders,
          queryParameters: {'paginated': true, 'limit': 20, 'cursor': ?cursor},
        );
        final data = response.data!;
        return HistoryPage(
          items: [
            for (final item in data['items'] as List)
              _orderFromJson(item as Map<String, dynamic>),
          ],
          nextCursor: data['nextCursor'] as String?,
        );
      });

  @override
  Future<OrderRecord> getOrder(String id) {
    return apiCall(() async {
      final res = await _dio.get<Map<String, dynamic>>(ApiEndpoints.order(id));
      return _orderFromJson(res.data!);
    });
  }

  OrderRecord _orderFromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List<dynamic>?) ?? const [];
    return OrderRecord(
      id: json['id'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      branchName: (json['branchName'] as String?) ?? '',
      pickupLabel: (json['pickupSlot'] as String?) ?? '',
      itemsLabel: items
          .map((i) {
            final item = i as Map<String, dynamic>;
            final qty = (item['quantity'] as num).toInt();
            final name = item['productName'] as String;
            return qty > 1 ? '${qty}x $name' : name;
          })
          .join(', '),
      total: (json['total'] as num).toDouble(),
      stampsEarned: (json['stampsEarned'] as num).toInt(),
      status: (json['status'] as String?) ?? 'received',
    );
  }
}
