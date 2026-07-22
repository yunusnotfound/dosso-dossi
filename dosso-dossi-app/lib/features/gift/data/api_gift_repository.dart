import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../domain/gift_record.dart';
import 'gift_repository.dart';

class ApiGiftRepository implements GiftRepository {
  ApiGiftRepository(this._dio);

  final Dio _dio;

  @override
  Future<GiftRecord> sendGift({
    required String recipientPhone,
    required String type,
    String? productId,
    double? amount,
    String note = '',
  }) {
    return apiCall(() async {
      final res = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.gifts,
        data: {
          'recipientPhone': recipientPhone,
          'type': type,
          'productId': ?productId,
          'amount': ?amount,
          'note': note,
        },
      );
      return _giftFromJson(res.data!);
    });
  }

  @override
  Future<List<GiftRecord>> getGifts() {
    return apiCall(() async {
      final res = await _dio.get<List<dynamic>>(ApiEndpoints.gifts);
      return [
        for (final item in res.data!) _giftFromJson(item as Map<String, dynamic>),
      ];
    });
  }

  GiftRecord _giftFromJson(Map<String, dynamic> json) {
    return GiftRecord(
      phone: json['recipientPhone'] as String,
      label: json['label'] as String,
      amount: (json['amount'] as num).toDouble(),
      date: DateTime.parse(json['date'] as String).toLocal(),
      note: (json['note'] as String?) ?? '',
    );
  }
}
