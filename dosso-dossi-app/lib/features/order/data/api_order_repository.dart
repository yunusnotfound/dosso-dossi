import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../../branches/domain/branch.dart';
import '../domain/cart.dart';
import '../domain/order_record.dart';
import 'order_repository.dart';

class ApiOrderRepository implements OrderRepository {
  ApiOrderRepository(this._dio);

  final Dio _dio;

  @override
  Future<OrderRecord> placeOrder({
    required Branch branch,
    required String pickupLabel,
    required CartState cart,
  }) {
    return apiCall(() async {
      final res = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.orders,
        data: {
          'branchId': branch.id,
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
      return _orderFromJson(res.data!);
    });
  }

  @override
  Future<List<OrderRecord>> getOrders() {
    return apiCall(() async {
      final res = await _dio.get<List<dynamic>>(ApiEndpoints.orders);
      return [
        for (final item in res.data!) _orderFromJson(item as Map<String, dynamic>),
      ];
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
    );
  }
}
