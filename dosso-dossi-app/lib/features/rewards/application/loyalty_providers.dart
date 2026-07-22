import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/loyalty_repository.dart';
import '../domain/loyalty_status.dart';

/// Damga ve ikram durumu. Sipariş ve bakiye yükleme akışları buradan günceller.
final loyaltyStatusProvider =
    AsyncNotifierProvider<LoyaltyController, LoyaltyStatus>(
        LoyaltyController.new);

class LoyaltyController extends AsyncNotifier<LoyaltyStatus> {
  @override
  Future<LoyaltyStatus> build() {
    return ref.watch(loyaltyRepositoryProvider).getStatus();
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
    state = AsyncData(status.copyWith(
      stamps: total % status.target,
      freeDrinks: status.freeDrinks + earned,
      history: entries,
    ));
  }

  /// Kampanya/bonus kaynaklı ikram ekler ("1.000 TL yükleyene 5 kahve").
  void addFreeDrinks(int count, String reason) {
    final status = state.value;
    if (status == null || count <= 0) return;
    state = AsyncData(status.copyWith(
      freeDrinks: status.freeDrinks + count,
      history: [
        RewardEntry(title: reason, date: DateTime.now(), used: false),
        ...status.history,
      ],
    ));
  }

  /// Bir ikram hakkını kullanır; hak yoksa false döner.
  bool useFreeDrink(String drinkName) {
    final status = state.value;
    if (status == null || status.freeDrinks < 1) return false;
    state = AsyncData(status.copyWith(
      freeDrinks: status.freeDrinks - 1,
      history: [
        RewardEntry(title: drinkName, date: DateTime.now(), used: true),
        ...status.history,
      ],
    ));
    return true;
  }
}
