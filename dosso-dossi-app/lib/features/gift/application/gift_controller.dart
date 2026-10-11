import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/runtime_mode.dart';
import '../../../core/network/session_scope.dart';
import '../../../core/network/history_page.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/diagnostics/app_telemetry.dart';
import '../../wallet/application/wallet_providers.dart';
import '../../rewards/application/loyalty_providers.dart';
import '../data/gift_repository.dart';
import '../domain/gift_record.dart';

/// Gönderilen hediyeler + gönderme işlemi.
/// Mock modunda tutar yerel bakiyeden düşer; API modunda sunucu düşer ve
/// hediyeyi alıcının telefon numarasına bağlı uygulama hesabına tanımlar.
final giftControllerProvider =
    NotifierProvider<GiftController, List<GiftRecord>>(GiftController.new);

class GiftController extends Notifier<List<GiftRecord>> {
  int _refreshSequence = 0;
  final _unseenLocalGifts = <String, GiftRecord>{};
  HistoryPagination _pagination = const HistoryPagination();
  HistoryPagination get pagination => _pagination;
  bool _loadedOlder = false;

  @override
  List<GiftRecord> build() {
    _refreshSequence++;
    _unseenLocalGifts.clear();
    _pagination = const HistoryPagination();
    _loadedOlder = false;
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
    final sequence = ++_refreshSequence;
    if (_pagination.isLoading) {
      _pagination = HistoryPagination(nextCursor: _pagination.nextCursor);
      state = [...state];
    }
    ref.read(giftsLoadProvider.notifier).set(const AsyncLoading());
    try {
      final repository = ref.read(giftRepositoryProvider);
      if (repository is GiftClaimRepository) {
        final claimed = await (repository as GiftClaimRepository)
            .claimReceivedGifts();
        if (!ref.mounted ||
            scope.revision != epoch ||
            sequence != _refreshSequence) {
          return;
        }
        if (claimed > 0) {
          ref.invalidate(walletProvider);
          ref.invalidate(loyaltyStatusProvider);
        }
      }
      final page = repository is PagedGiftRepository
          ? await (repository as PagedGiftRepository).getGiftsPage()
          : HistoryPage(items: await repository.getGifts());
      final records = page.items;
      if (!ref.mounted ||
          scope.revision != epoch ||
          sequence != _refreshSequence) {
        return;
      }
      _loadedOlder =
          _loadedOlder &&
          records.isNotEmpty &&
          !_unseenLocalGifts.containsKey(records.last.identity) &&
          state.any((gift) => gift.identity == records.last.identity);
      for (final record in records) {
        _unseenLocalGifts.remove(record.identity);
      }
      _pagination = HistoryPagination(
        nextCursor: _loadedOlder ? _pagination.nextCursor : page.nextCursor,
      );
      state = {
        if (_loadedOlder)
          for (final gift in state) gift.identity: gift,
        ..._unseenLocalGifts,
        for (final gift in records) gift.identity: gift,
      }.values.toList()..sort((a, b) => b.date.compareTo(a.date));
      ref.read(giftsLoadProvider.notifier).set(const AsyncData(null));
    } catch (error, stack) {
      if (ref.mounted &&
          scope.revision == epoch &&
          sequence == _refreshSequence) {
        ref
            .read(telemetryProvider)
            .report(TelemetryOperation.giftHistory, error);
        ref.read(giftsLoadProvider.notifier).set(AsyncError(error, stack));
      }
      rethrow;
    }
  }

  Future<void> loadMore() async {
    final cursor = _pagination.nextCursor;
    final repository = ref.read(giftRepositoryProvider);
    if (cursor == null ||
        _pagination.isLoading ||
        ref.read(giftsLoadProvider).isLoading ||
        repository is! PagedGiftRepository) {
      return;
    }
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    final sequence = _refreshSequence;
    bool current() =>
        ref.mounted && scope.revision == epoch && sequence == _refreshSequence;
    _pagination = HistoryPagination(nextCursor: cursor, isLoading: true);
    state = [...state];
    try {
      final page = await (repository as PagedGiftRepository).getGiftsPage(
        cursor: cursor,
      );
      if (!current()) return;
      _loadedOlder = true;
      _pagination = HistoryPagination(nextCursor: page.nextCursor);
      state = {
        for (final gift in page.items) gift.identity: gift,
        for (final gift in state) gift.identity: gift,
      }.values.toList()..sort((a, b) => b.date.compareTo(a.date));
    } catch (error) {
      if (!current()) return;
      _pagination = HistoryPagination(nextCursor: cursor, error: error);
      state = [...state];
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
      _add(gift);
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
      _add(record);
      ref.invalidate(walletProvider);
      return true;
    } on ApiException catch (e) {
      if (e.code == 'INSUFFICIENT_BALANCE') return false;
      rethrow;
    }
  }

  void _add(GiftRecord record) {
    _unseenLocalGifts[record.identity] = record;
    state = [
      record,
      ...state.where((gift) => gift.identity != record.identity),
    ];
  }
}

final giftsPaginationProvider = Provider<HistoryPagination>((ref) {
  ref.watch(giftControllerProvider);
  return ref.read(giftControllerProvider.notifier).pagination;
});

final giftsLoadProvider =
    NotifierProvider<GiftLoadController, AsyncValue<void>>(
      GiftLoadController.new,
    );

class GiftLoadController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);
  void set(AsyncValue<void> value) => state = value;
}
