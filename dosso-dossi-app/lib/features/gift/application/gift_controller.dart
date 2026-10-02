import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/runtime_mode.dart';
import '../../../core/network/session_scope.dart';
import '../../../core/network/api_exception.dart';
import '../../wallet/application/wallet_providers.dart';
import '../data/gift_repository.dart';
import '../domain/gift_record.dart';

/// Gönderilen hediyeler + gönderme işlemi.
/// Mock modunda tutar yerel bakiyeden düşer; API modunda sunucu düşer ve
/// hediyeyi alıcının telefon numarasına bağlı uygulama hesabına tanımlar.
final giftControllerProvider =
    NotifierProvider<GiftController, List<GiftRecord>>(GiftController.new);

class GiftController extends Notifier<List<GiftRecord>> {
  @override
  List<GiftRecord> build() {
    if (ref.read(apiModeProvider)) {
      Future.microtask(_loadFromApi);
    }
    return [];
  }

  Future<void> _loadFromApi() async {
    try {
      await refresh();
    } catch (_) {}
  }

  Future<void> refresh() async {
    if (!ref.mounted) return;
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    ref.read(giftsLoadProvider.notifier).set(const AsyncLoading());
    try {
      final records = await ref.read(giftRepositoryProvider).getGifts();
      if (!ref.mounted || scope.revision != epoch) return;
      state = records;
      ref.read(giftsLoadProvider.notifier).set(const AsyncData(null));
    } catch (error, stack) {
      if (ref.mounted && scope.revision == epoch) {
        ref.read(giftsLoadProvider.notifier).set(AsyncError(error, stack));
      }
      rethrow;
    }
  }

  /// Bakiye yeterliyse hediyeyi gönderir; yetersizse false döner.
  Future<bool> send(
    GiftRecord gift, {
    String type = 'balance',
    String? productId,
  }) async {
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    if (!ref.read(apiModeProvider)) {
      final paid = await ref.read(walletProvider.notifier).pay(gift.amount);
      if (!ref.mounted || scope.revision != epoch || !paid) return false;
      state = [gift, ...state];
      return true;
    }

    try {
      final record = await ref
          .read(giftRepositoryProvider)
          .sendGift(
            recipientPhone: gift.phone,
            type: type,
            productId: productId,
            amount: type == 'balance' ? gift.amount : null,
            expectedTotal: double.parse(gift.amount.toStringAsFixed(2)),
            note: gift.note,
          );
      if (!ref.mounted || scope.revision != epoch) return false;
      state = [record, ...state];
      ref.invalidate(walletProvider);
      return true;
    } on ApiException catch (e) {
      if (e.code == 'INSUFFICIENT_BALANCE') return false;
      rethrow;
    }
  }
}

final giftsLoadProvider =
    NotifierProvider<GiftLoadController, AsyncValue<void>>(
      GiftLoadController.new,
    );

class GiftLoadController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);
  void set(AsyncValue<void> value) => state = value;
}
