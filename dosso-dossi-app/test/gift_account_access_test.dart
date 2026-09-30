import 'dart:convert';

import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/core/theme/app_theme.dart';
import 'package:dosso_dossi/features/gift/application/gift_controller.dart';
import 'package:dosso_dossi/features/gift/domain/gift_record.dart';
import 'package:dosso_dossi/features/gift/presentation/gift_screen.dart';
import 'package:dosso_dossi/features/order/application/menu_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _TrackedGiftController extends GiftController {
  int loads = 0;
  int sends = 0;

  @override
  List<GiftRecord> build() {
    loads++;
    return [];
  }

  @override
  Future<bool> send(
    GiftRecord gift, {
    String type = 'balance',
    String? productId,
  }) async {
    sends++;
    state = [gift, ...state];
    return true;
  }
}

Future<void> _pumpGift(
  WidgetTester tester,
  _TrackedGiftController gifts, {
  required bool signedIn,
  bool guest = false,
}) async {
  SharedPreferences.setMockInitialValues({
    'auth_guest': guest,
    if (signedIn)
      'auth_user': jsonEncode({'phone': '5551112233', 'name': 'Elif'}),
  });
  final prefs = await SharedPreferences.getInstance();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        giftControllerProvider.overrideWith(() => gifts),
        menuProductsProvider.overrideWith((ref) async => []),
      ],
      child: MaterialApp(theme: AppTheme.light, home: const GiftScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  for (final guest in [true, false]) {
    testWidgets('signed-out gift route blocks access (guest=$guest)', (
      tester,
    ) async {
      final gifts = _TrackedGiftController();
      await _pumpGift(tester, gifts, signedIn: false, guest: guest);

      expect(find.text('Giriş yap / Üye ol'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
      expect(gifts.loads, 0);
      expect(gifts.sends, 0);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('member can send a gift with account-only usage instructions', (
    tester,
  ) async {
    final gifts = _TrackedGiftController();
    await _pumpGift(tester, gifts, signedIn: true);
    await tester.tap(find.text('Bakiye Gönder'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '5552223344');
    await tester.pumpAndSettle();
    final sendButton = find.widgetWithText(
      FilledButton,
      'Hediye Gönder · ₺100,00',
    );
    await tester.ensureVisible(sendButton);
    await tester.pumpAndSettle();
    await tester.tap(sendButton);
    await tester.pumpAndSettle();

    expect(gifts.sends, 1);
    expect(find.text('Hediye gönderildi!'), findsOneWidget);
    expect(
      find.textContaining('gönderdiğin telefon numarasıyla giriş'),
      findsOneWidget,
    );
    expect(
      find.textContaining('Dosso Dossi Kart hesabına eklenir'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
