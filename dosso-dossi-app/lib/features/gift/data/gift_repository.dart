import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/gift_record.dart';
import 'api_gift_repository.dart';

/// Hediye veri kaynağı sözleşmesi.
/// Mock modunda kullanılmaz: hediye simülasyonu GiftController'da kalır.
abstract interface class GiftRepository {
  Future<GiftRecord> sendGift({
    required String recipientPhone,
    required String type, // 'drink' | 'balance'
    String? productId,
    double? amount,
    String note = '',
  });

  Future<List<GiftRecord>> getGifts();
}

final giftRepositoryProvider = Provider<GiftRepository>((ref) {
  return ApiGiftRepository(ref.watch(apiClientProvider));
});
