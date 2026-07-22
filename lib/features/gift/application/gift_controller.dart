import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../wallet/application/wallet_providers.dart';
import '../domain/gift_record.dart';

/// Gönderilen hediyeler + gönderme işlemi.
/// Tutar Dosso Kart bakiyesinden düşer; alıcıya SMS ile hediye kodu
/// gitmesi simüle edilir (gerçek API'de sunucu gönderecek).
final giftControllerProvider =
    NotifierProvider<GiftController, List<GiftRecord>>(GiftController.new);

class GiftController extends Notifier<List<GiftRecord>> {
  @override
  List<GiftRecord> build() => [];

  /// Bakiye yeterliyse hediyeyi gönderir; yetersizse false döner.
  Future<bool> send(GiftRecord gift) async {
    final paid = await ref.read(walletProvider.notifier).pay(gift.amount);
    if (!paid) return false;
    state = [gift, ...state];
    return true;
  }
}
