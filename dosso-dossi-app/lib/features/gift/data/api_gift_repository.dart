import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/financial_receipt.dart';
import '../../../core/network/history_page.dart';
import '../../../core/diagnostics/app_telemetry.dart';
import '../domain/gift_record.dart';
import 'gift_repository.dart';

class ApiGiftRepository
    implements GiftRepository, GiftClaimRepository, PagedGiftRepository {
  ApiGiftRepository(this._dio);

  final Dio _dio;

  @override
  Future<int> claimReceivedGifts() => apiCall(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '${ApiEndpoints.gifts}/claim',
    );
    return (response.data!['claimed'] as num).toInt();
  });

  @override
  Future<GiftRecord> sendGift({
    required String recipientPhone,
    required String type,
    String? productId,
    double? amount,
    double? expectedTotal,
    String note = '',
  }) {
    return postFinancialReceipt(
      dio: _dio,
      path: ApiEndpoints.gifts,
      operation: TelemetryOperation.giftReceipt,
      decode: _giftFromJson,
      unconfirmed: const ApiException(
        code: 'GIFT_RESPONSE_UNCONFIRMED',
        message:
            'Hediye sonucu doğrulanamadı. Aynı hediyenin sonucunu tekrar kontrol et.',
      ),
      data: {
        'recipientPhone': recipientPhone,
        'type': type,
        'productId': ?productId,
        'amount': ?amount,
        'expectedTotal': ?expectedTotal,
        'note': note,
      },
    );
  }

  @override
  Future<List<GiftRecord>> getGifts() {
    return apiCall(() async {
      final res = await _dio.get<List<dynamic>>(ApiEndpoints.gifts);
      return [
        for (final item in res.data!)
          _giftFromJson(item as Map<String, dynamic>),
      ];
    });
  }

  @override
  Future<HistoryPage<GiftRecord>> getGiftsPage({String? cursor}) =>
      apiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>(
          ApiEndpoints.gifts,
          queryParameters: {'paginated': true, 'limit': 20, 'cursor': ?cursor},
        );
        final data = response.data!;
        return HistoryPage(
          items: [
            for (final item in data['items'] as List)
              _giftFromJson(item as Map<String, dynamic>),
          ],
          nextCursor: data['nextCursor'] as String?,
        );
      });

  GiftRecord _giftFromJson(Map<String, dynamic> json) {
    return GiftRecord(
      id: json['id'] as String,
      phone: json['recipientPhone'] as String,
      label: json['label'] as String,
      amount: (json['amount'] as num).toDouble(),
      date: DateTime.parse(json['date'] as String).toLocal(),
      note: (json['note'] as String?) ?? '',
    );
  }
}
