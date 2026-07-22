import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dosso_dossi/features/rewards/application/loyalty_providers.dart';

/// CEO kampanya kuralları: 5 kahve → 1 ikram, 1.000 ₺ yükleme → 5 ikram.
void main() {
  test('Damga hedefi dolunca ikrama dönüşür, sayaç kalanla devam eder',
      () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await container.read(loyaltyStatusProvider.future);

    // Başlangıç (mock): 3 damga, 1 ikram
    container.read(loyaltyStatusProvider.notifier).addStamps(3);

    final status = container.read(loyaltyStatusProvider).value!;
    expect(status.stamps, 1); // 3 + 3 = 6 → 1 ikram + 1 damga
    expect(status.freeDrinks, 2); // 1 (başlangıç) + 1 (yeni kazanılan)
    expect(status.history.first.used, false);
  });

  test('Yükleme bonusu ikram ekler, kullanım hakkı düşer', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await container.read(loyaltyStatusProvider.future);
    final controller = container.read(loyaltyStatusProvider.notifier);

    controller.addFreeDrinks(5, 'Yükleme kampanyası');
    expect(container.read(loyaltyStatusProvider).value!.freeDrinks, 6);

    final used = controller.useFreeDrink('Fındıklı Latte');
    expect(used, true);
    final status = container.read(loyaltyStatusProvider).value!;
    expect(status.freeDrinks, 5);
    expect(status.history.first.title, 'Fındıklı Latte');
    expect(status.history.first.used, true);
  });
}
