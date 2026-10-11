import 'dart:convert';

import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/campaign_progress_card.dart';
import 'package:dosso_dossi/features/home/presentation/widgets/approved_campaign_poster.dart';
import 'package:dosso_dossi/features/home/presentation/widgets/campaign_carousel.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  for (final guest in [true, false]) {
    testWidgets(
      'approved home posters fill cards without progress or extra CTA, guest=$guest',
      (tester) async {
        tester.view.physicalSize = const Size(320, 568);
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
        await tester.pumpWidget(
          ProviderScope(
            overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
            child: MaterialApp(
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: const TextScaler.linear(2)),
                child: child!,
              ),
              home: const Scaffold(
                body: Padding(
                  padding: EdgeInsets.all(20),
                  child: CampaignCarousel(),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.byType(CampaignProgressCard), findsNothing);
        expect(find.text('KAHVE İLERLEMEN'), findsNothing);
        expect(find.text('Kampanyayı keşfet'), findsNothing);
        for (final asset in [
          ApprovedCampaignAssets.coffee,
          ApprovedCampaignAssets.topup,
        ]) {
          final poster = find.byWidgetPredicate(
            (widget) =>
                widget is ApprovedCampaignPoster && widget.asset == asset,
          );
          expect(poster, findsOneWidget);
          final image = find
              .descendant(of: poster, matching: find.byType(Image))
              .first;
          final imageRect = tester.getRect(image);
          expect(tester.widget<Image>(image).fit, BoxFit.contain);
          expect(imageRect.width / imageRect.height, closeTo(941 / 1672, .001));
          expect(imageRect, tester.getRect(poster));
          expect(
            find.descendant(of: poster, matching: find.byType(Text)),
            findsNothing,
          );
        }
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
}
