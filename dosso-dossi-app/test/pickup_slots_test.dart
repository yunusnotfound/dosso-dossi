import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/branches/application/branch_providers.dart';
import 'package:dosso_dossi/features/branches/domain/branch.dart';
import 'package:dosso_dossi/features/order/application/cart_controller.dart';
import 'package:dosso_dossi/features/order/application/menu_providers.dart';
import 'package:dosso_dossi/features/order/domain/pickup_slots.dart';
import 'package:dosso_dossi/features/order/domain/product_options.dart';
import 'package:dosso_dossi/features/order/presentation/cart_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'price_contract_test.dart' show coffee, item;

Branch _branch({
  String hours = '08:00–01:00',
  bool open = true,
  int prep = 7,
}) => Branch(
  id: 'shop',
  name: 'Şube',
  address: '',
  city: 'İstanbul',
  isOpen: open,
  hours: hours,
  prepMinutes: prep,
);

DateTime _at(int hour, int minute) => DateTime.utc(2026, 10, 7, hour, minute);

List<String> _labels(Branch branch, DateTime now) =>
    availablePickupSlots(branch, now).map((slot) => slot.label).toList();

void main() {
  test('actual instants use Türkiye wall time across UTC midnight', () {
    final instant = DateTime.parse('2026-10-06T22:30:00Z');
    expect(turkeyWallTime(instant), DateTime.utc(2026, 10, 7, 1, 30));
    expect(turkeyWallTime(instant.toLocal()), DateTime.utc(2026, 10, 7, 1, 30));
    expect(_labels(_branch(hours: '24 saat açık'), turkeyWallTime(instant)), [
      'En kısa (~7 dk)',
      '01:45',
      '02:00',
    ]);
  });

  test('overnight slots cross midnight within the current opening', () {
    final slots = availablePickupSlots(_branch(), _at(23, 50));
    expect(slots.map((slot) => slot.label), [
      'En kısa (~7 dk)',
      '00:00',
      '00:15',
    ]);
    expect(slots[1].scheduledAt, DateTime.utc(2026, 10, 8));
    expect(pickupSlotAvailable(_branch(), slots[1], _at(23, 51)), isTrue);
  });

  test('closing time is exclusive and preparation must finish before it', () {
    expect(_labels(_branch(), _at(0, 40)), ['En kısa (~7 dk)']);
    expect(_labels(_branch(), _at(0, 53)), isEmpty);
    expect(_labels(_branch(), _at(4, 0)), isEmpty);
    expect(_labels(_branch(), _at(7, 59)), isEmpty);
  });

  test('midnight closing differs from an always-open branch', () {
    expect(_labels(_branch(hours: '08:00–24:00'), _at(23, 50)), [
      'En kısa (~7 dk)',
    ]);
    for (final hours in ['24 saat açık', '24 saat', '00:00-24:00']) {
      expect(_labels(_branch(hours: hours), _at(23, 50)), [
        'En kısa (~7 dk)',
        '00:00',
        '00:15',
      ]);
    }
  });

  test('unknown hours and a closed branch never offer a checkout slot', () {
    for (final hours in ['', 'belirsiz', '25:00–01:00', '08:00–08:00']) {
      expect(_labels(_branch(hours: hours), _at(12, 0)), isEmpty);
    }
    expect(_labels(_branch(open: false), _at(12, 0)), isEmpty);
  });

  test('cached choices expire and cannot roll into a new business day', () {
    final branch = _branch(hours: '24 saat açık');
    final slots = availablePickupSlots(branch, _at(12, 0));
    expect(pickupSlotAvailable(branch, slots[1], _at(12, 8)), isTrue);
    expect(pickupSlotAvailable(branch, slots[1], _at(12, 9)), isFalse);
    expect(
      pickupSlotAvailable(branch, slots[1], DateTime.utc(2026, 10, 8, 12)),
      isFalse,
    );
    // Date-less 24h slots must be within the backend's midnight horizon.
    expect(
      pickupSlotAvailable(
        branch,
        PickupSlot('11:45', scheduledAt: DateTime.utc(2026, 10, 8, 11, 45)),
        _at(12, 0),
      ),
      isFalse,
    );
  });

  test('preparation time filters slots near closing', () {
    expect(_labels(_branch(hours: '08:00–23:00', prep: 20), _at(22, 30)), [
      'En kısa (~20 dk)',
    ]);
    expect(
      _labels(_branch(hours: '08:00–23:00', prep: 30), _at(22, 30)),
      isEmpty,
    );
  });

  testWidgets('cart blocks unavailable pickup and reacts to updated hours', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    var branch = _branch(hours: '08:00–23:00');
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        branchesProvider.overrideWith((ref) async => [branch]),
        menuProductsProvider.overrideWith((ref) async => [coffee]),
        menuOptionsProvider.overrideWith((ref) async => const MenuOptions()),
      ],
    );
    addTearDown(container.dispose);
    container.read(cartProvider.notifier).add(item);
    tester.view.physicalSize = const Size(700, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(home: CartScreen(now: () => _at(22, 55))),
      ),
    );
    await tester.pumpAndSettle();
    final pay = find.widgetWithText(
      FilledButton,
      'Dosso Dossi Kart ile Öde · ₺190,00',
    );
    expect(
      find.text('Bu şubede şu an uygun teslim saati yok.'),
      findsOneWidget,
    );
    expect(tester.widget<FilledButton>(pay).onPressed, isNull);
    expect(find.textContaining('En kısa'), findsNothing);

    branch = _branch(hours: '08:00–24:00');
    container.invalidate(branchesProvider);
    await tester.pumpAndSettle();
    expect(find.text('Bu şubede şu an uygun teslim saati yok.'), findsNothing);
    expect(find.text('23:15'), findsOneWidget);
    expect(tester.widget<FilledButton>(pay).onPressed, isNotNull);
    expect(tester.takeException(), isNull);
  });
}
