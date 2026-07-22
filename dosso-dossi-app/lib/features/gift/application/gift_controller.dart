import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/network/api_exception.dart';
import '../../wallet/application/wallet_providers.dart';
import '../data/gift_repository.dart';
import '../domain/gift_record.dart';

/// Gönderilen hediyeler + gönderme işlemi.
/// Mock modunda tutar yerel bakiyeden düşer; API modunda sunucu düşer ve
/// alıcıya SMS ile hediye kodu gönderir.
final giftControllerProvider =
    NotifierProvider<GiftController, List<GiftRecord>>(GiftController.new);

class GiftController extends Notifier<List<GiftRecord>> {
  @override
  List<GiftRecord> build() {
    if (!AppConfig.useMocks) {
      Future.microtask(_loadFromApi);
    }
    return [];
  }

  Future<void> _loadFromApi() async {
    try {
      state = await ref.read(giftRepositoryProvider).getGifts();
    } catch (_) {
      // Ağ hatasında liste boş kalır; sonraki gönderim tazeler.
    }
  }

  /// Bakiye yeterliyse hediyeyi gönderir; yetersizse false döner.
  Future<bool> send(
    GiftRecord gift, {
    String type = 'balance',
    String? productId,
  }) async {
    if (AppConfig.useMocks) {
      final paid = await ref.read(walletProvider.notifier).pay(gift.amount);
      if (!paid) return false;
      state = [gift, ...state];
      return true;
    }

    try {
      final record = await ref.read(giftRepositoryProvider).sendGift(
            recipientPhone: gift.phone,
            type: type,
            productId: productId,
            amount: type == 'balance' ? gift.amount : null,
            note: gift.note,
          );
      state = [record, ...state];
      ref.invalidate(walletProvider);
      return true;
    } on ApiException catch (e) {
      if (e.code == 'INSUFFICIENT_BALANCE') return false;
      rethrow;
    }
  }
}
