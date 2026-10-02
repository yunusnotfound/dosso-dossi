import 'dart:convert';

import 'package:dosso_dossi/app.dart';
import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/campaigns/application/campaign_story_providers.dart';
import 'package:dosso_dossi/features/campaigns/domain/campaign_story.dart';
import 'package:dosso_dossi/features/campaigns/presentation/campaign_story_viewer.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/campaign_progress_card.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/coffee_rewards_preview.dart';
import 'package:dosso_dossi/features/home/presentation/widgets/campaign_story_strip.dart';
import 'package:dosso_dossi/features/home/presentation/widgets/campaign_carousel.dart';
import 'package:dosso_dossi/routing/main_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  for (final guest in [true, false]) {
    testWidgets('cold home and campaign story navigation, guest=$guest', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(430, 932);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      SharedPreferences.setMockInitialValues({
        if (guest) 'auth_guest': true,
        if (!guest)
          'auth_user': jsonEncode({'phone': '5551112233', 'name': 'Elif Kaya'}),
      });
      final prefs = await SharedPreferences.getInstance();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
          child: const DossoDossiApp(),
        ),
      );
      await tester.pumpAndSettle();
      if (guest) {
        expect(find.text('M').hitTestable(), findsOneWidget);
        expect(find.text('?'), findsNothing);
        expect(
          find.text('Damga biriktirmeye başla').hitTestable(),
          findsNothing,
        );
        expect(
          find.textContaining('Üye ol, her kahvende').hitTestable(),
          findsNothing,
        );
        expect(find.textContaining('İyi günler').hitTestable(), findsNothing);
      }
      await tester.dragUntilVisible(
        find.byType(CampaignStoryStrip),
        find.byType(ListView).first,
        const Offset(0, -150),
      );
      await Scrollable.ensureVisible(
        tester.element(find.byType(CampaignStoryStrip)),
        alignment: 0.2,
      );
      await tester.pumpAndSettle();
      expect(
        tester.getTopLeft(find.byType(CampaignStoryStrip)).dy,
        lessThan(tester.getTopLeft(find.text('SANA ÖZEL')).dy),
      );
      expect(find.text('Kahve Kazan').hitTestable(), findsOneWidget);
      await tester.tap(find.text('Kahve Kazan'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(CampaignStoryViewer), findsOneWidget);
      expect(find.byType(CoffeeRewardsPreview), findsOneWidget);
      expect(find.byType(FilledButton), findsNothing);
      await tester.tap(find.byTooltip('Hikayeyi kapat'));
      await tester.pumpAndSettle();
      expect(find.byType(CampaignStoryViewer), findsNothing);
      expect(find.byType(CampaignStoryStrip), findsOneWidget);
      final coffeeCard = find.byWidgetPredicate(
        (widget) =>
            widget is Semantics &&
            widget.properties.label == 'Kahve İçtikçe Kahve Kazan kampanyası',
      );
      await tester.dragUntilVisible(
        coffeeCard,
        find.byType(ListView).first,
        const Offset(0, -150),
      );
      await Scrollable.ensureVisible(
        tester.element(coffeeCard),
        alignment: .25,
      );
      await tester.pumpAndSettle();
      await tester.tap(coffeeCard);
      await tester.pumpAndSettle();
      expect(find.byType(CoffeeRewardsPreview), findsOneWidget);
      expect(find.byType(CampaignProgressCard), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }

  testWidgets('home posters can scroll completely above the floating navbar', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(402, 874);
    tester.view.devicePixelRatio = 1;
    tester.view.padding = const FakeViewPadding(top: 62, bottom: 34);
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({'auth_guest': true});
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
        child: const DossoDossiApp(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.fling(
      find.byType(ListView).first,
      const Offset(0, -2000),
      2000,
    );
    await tester.pumpAndSettle();
    expect(
      tester.getBottomRight(find.byType(CampaignCarousel)).dy,
      lessThanOrEqualTo(tester.getTopLeft(find.byType(PillNavBar)).dy),
    );
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  test('seen story revisions persist without hiding updated content', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    );
    const old = CampaignStory(id: 'a', title: 'Kahve', updatedAt: 'v1');
    const revised = CampaignStory(id: 'a', title: 'Kahve', updatedAt: 'v2');
    container.read(seenCampaignStoriesProvider.notifier).markSeen(old);
    await Future<void>.delayed(Duration.zero);
    container.dispose();
    final restarted = ProviderContainer(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    );
    addTearDown(restarted.dispose);
    expect(restarted.read(seenCampaignStoriesProvider), contains(old.seenKey));
    expect(
      restarted.read(seenCampaignStoriesProvider),
      isNot(contains(revised.seenKey)),
    );
  });
}
