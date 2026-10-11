import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/history_page.dart';
import '../../../core/network/session_scope.dart';

import '../data/loyalty_repository.dart';
import '../domain/loyalty_status.dart';

/// Damga ve ikram durumu. Sipariş ve bakiye yükleme akışları buradan günceller.
final loyaltyStatusProvider =
    AsyncNotifierProvider<LoyaltyController, LoyaltyStatus>(
      LoyaltyController.new,
    );

class LoyaltyController extends AsyncNotifier<LoyaltyStatus> {
  int _generation = 0;
  bool _loadedOlder = false;
  HistoryPagination _pagination = const HistoryPagination();
  HistoryPagination get pagination => _pagination;

  void clearForSession() {
    _generation++;
    _loadedOlder = false;
    _pagination = const HistoryPagination();
    // Riverpod carries the previous value into AsyncLoading. Replace personal
    // data first so an account transition cannot retain the prior history.
    state = const AsyncData(LoyaltyStatus(stamps: 0));
    state = const AsyncLoading();
  }

  @override
  Future<LoyaltyStatus> build() async {
    final generation = ++_generation;
    final previous = state.value;
    _pagination = HistoryPagination(nextCursor: _pagination.nextCursor);
    final latest = await ref.watch(loyaltyRepositoryProvider).getStatus();
    if (!ref.mounted || generation != _generation) return latest;
    _loadedOlder =
        _loadedOlder &&
        latest.history.isNotEmpty &&
        previous?.history.any(
              (entry) => entry.identity == latest.history.last.identity,
            ) ==
            true;
    final cursor = _loadedOlder ? _pagination.nextCursor : latest.nextCursor;
    _pagination = HistoryPagination(nextCursor: cursor);
    return latest.copyWith(
      history: _loadedOlder && previous != null
          ? _mergeHistory(previous.history, latest.history)
          : latest.history,
      nextCursor: cursor,
      clearNextCursor: cursor == null,
    );
  }

  List<RewardEntry> _mergeHistory(
    List<RewardEntry> older,
    List<RewardEntry> current,
  ) => {
    for (final entry in older) entry.identity: entry,
    for (final entry in current) entry.identity: entry,
  }.values.toList()..sort((a, b) => b.date.compareTo(a.date));

  Future<void> loadMore() async {
    final cursor = _pagination.nextCursor;
    final repository = ref.read(loyaltyRepositoryProvider);
    if (cursor == null ||
        _pagination.isLoading ||
        state.isLoading ||
        state.value == null ||
        repository is! PagedLoyaltyRepository) {
      return;
    }
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    final generation = _generation;
    bool current() =>
        ref.mounted && scope.revision == epoch && generation == _generation;
    _pagination = HistoryPagination(nextCursor: cursor, isLoading: true);
    state = AsyncData(state.requireValue.copyWith());
    try {
      final page = await (repository as PagedLoyaltyRepository).getHistoryPage(
        cursor: cursor,
      );
      if (!current()) return;
      _loadedOlder = true;
      _pagination = HistoryPagination(nextCursor: page.nextCursor);
      state = AsyncData(
        state.requireValue.copyWith(
          history: _mergeHistory(page.history, state.requireValue.history),
          nextCursor: page.nextCursor,
          clearNextCursor: page.nextCursor == null,
        ),
      );
    } catch (error) {
      if (!current()) return;
      _pagination = HistoryPagination(nextCursor: cursor, error: error);
      state = AsyncData(state.requireValue.copyWith());
    }
  }

  /// Damga ekler; hedef dolunca damgalar ikram hakkına dönüşür ve sayaç
  /// kalan damgayla devam eder ("5 kahve alana 1 kahve" kampanyası).
  void addStamps(int count) {
    final status = state.value;
    if (status == null || count <= 0) return;

    final total = status.stamps + count;
    final earned = total ~/ status.target;
    final entries = [
      for (var i = 0; i < earned; i++)
        RewardEntry(
          title: 'Damga tamamlandı — 1 ikram kazanıldı',
          date: DateTime.now(),
          used: false,
        ),
      ...status.history,
    ];
    state = AsyncData(
      status.copyWith(
        stamps: total % status.target,
        freeDrinks: status.freeDrinks + earned,
        history: entries,
      ),
    );
  }

  /// Kampanya/bonus kaynaklı ikram ekler ("1.000 TL yükleyene 5 kahve").
  void addFreeDrinks(int count, String reason) {
    final status = state.value;
    if (status == null || count <= 0) return;
    state = AsyncData(
      status.copyWith(
        freeDrinks: status.freeDrinks + count,
        history: [
          RewardEntry(title: reason, date: DateTime.now(), used: false),
          ...status.history,
        ],
      ),
    );
  }

  /// Bir ikram hakkını kullanır; hak yoksa false döner.
  bool useFreeDrink(String drinkName) {
    final status = state.value;
    if (status == null || status.freeDrinks < 1) return false;
    state = AsyncData(
      status.copyWith(
        freeDrinks: status.freeDrinks - 1,
        history: [
          RewardEntry(title: drinkName, date: DateTime.now(), used: true),
          ...status.history,
        ],
      ),
    );
    return true;
  }
}

final loyaltyPaginationProvider = Provider<HistoryPagination>((ref) {
  ref.watch(loyaltyStatusProvider);
  return ref.read(loyaltyStatusProvider.notifier).pagination;
});
