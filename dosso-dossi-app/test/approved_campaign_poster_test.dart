import 'dart:convert';

import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/campaign_progress_card.dart';
import 'package:dosso_dossi/features/home/presentation/widgets/approved_campaign_poster.dart';
import 'package:dosso_dossi/features/home/presentation/widgets/campaign_carousel.dart';
import 'package:dosso_dossi/features/shop/presentation/shop_screen.dart';
import 'package:dosso_dossi/routing/app_router.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  for (final guest in [true, false]) {
    testWidgets(
      'three home posters keep their proportions and thermos opens shop, guest=$guest',
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
        final router = GoRouter(
          routes: [
            GoRoute(
              path: '/',
              builder: (_, _) => const Scaffold(
                body: Padding(
                  padding: EdgeInsets.all(20),
                  child: CampaignCarousel(),
                ),
              ),
            ),
            GoRoute(path: Routes.shop, builder: (_, _) => const ShopScreen()),
          ],
        );
        addTearDown(router.dispose);
        await tester.pumpWidget(
          ProviderScope(
            overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
            child: MaterialApp.router(
              routerConfig: router,
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: const TextScaler.linear(2)),
                child: child!,
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.byType(CampaignProgressCard), findsNothing);
        expect(find.text('KAHVE İLERLEMEN'), findsNothing);
        expect(find.text('Kampanyayı keşfet'), findsNothing);
        expect(find.byType(ApprovedCampaignPoster), findsNWidgets(3));
        for (final asset in [
          ApprovedCampaignAssets.coffee,
          ApprovedCampaignAssets.topup,
          ApprovedCampaignAssets.thermos,
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
        final thermosCard = find.byWidgetPredicate(
          (widget) =>
              widget is Semantics &&
              widget.properties.label == 'Termos koleksiyonunu keşfet',
        );
        await tester.ensureVisible(thermosCard);
        await tester.tap(thermosCard);
        await tester.pumpAndSettle();
        expect(find.byType(ShopScreen), findsOneWidget);
        expect(find.text('Termoslar'), findsOneWidget);
        await tester.dragUntilVisible(
          find.text('Termos Turuncu 500 ml'),
          find
              .descendant(
                of: find.byType(ShopScreen),
                matching: find.byType(ListView),
              )
              .first,
          const Offset(0, -150),
        );
        await tester.pumpAndSettle();
        expect(find.text('Termos Turuncu 500 ml'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
}
