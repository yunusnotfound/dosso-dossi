import 'dart:convert';

import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/coffee_rewards_preview.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/load_rewards_preview.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  for (final guest in [true, false]) {
    testWidgets(
      'phone portrait previews fit 360x780 with progress (guest=$guest)',
      (tester) async {
        tester.view.physicalSize = const Size(360, 780);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        SharedPreferences.setMockInitialValues({
          'auth_guest': guest,
          if (!guest)
            'auth_user': jsonEncode({
              'phone': '5551112233',
              'name': 'Elif Kaya',
            }),
        });
        final prefs = await SharedPreferences.getInstance();
        for (final content in const [
          CoffeeRewardsPreview(fillHeight: true, showProgress: true),
          LoadRewardsPreview(fillHeight: true),
        ]) {
          await tester.pumpWidget(
            ProviderScope(
              overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
              child: MaterialApp(
                home: Scaffold(
                  body: SizedBox(width: 360, height: 780, child: content),
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          expect(find.byType(Image), findsWidgets);
        }
      },
    );
  }
}
