import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/campaigns/application/campaign_story_providers.dart';
import 'package:dosso_dossi/features/campaigns/domain/campaign_story.dart';
import 'package:dosso_dossi/features/campaigns/presentation/campaign_story_viewer.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/campaign_story_artwork.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/coffee_rewards_preview.dart';
import 'package:dosso_dossi/features/campaigns/presentation/widgets/load_rewards_preview.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const stories = [
  CampaignStory(
    id: 'coffee',
    title: 'Kahve Kazan',
    action: 'kahve-ictikce',
    actionLabel: 'Kahve kampanyasını aç',
    updatedAt: 'v1',
  ),
  CampaignStory(
    id: 'topup',
    title: 'Yükle Kazan',
    action: 'yukle-kazan',
    actionLabel: 'Yükleme kampanyasını aç',
    updatedAt: 'v1',
  ),
];

Future<({ProviderContainer container, SharedPreferences prefs})> openViewer(
  WidgetTester tester, {
  List<CampaignStory> items = stories,
  bool accessible = false,
  bool small = false,
  double textScale = 1,
  Future<List<CampaignStory>> Function(Ref)? fetch,
}) async {
  SharedPreferences.setMockInitialValues({'auth_guest': true});
  final prefs = await SharedPreferences.getInstance();
  final container = ProviderContainer(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      campaignStoriesProvider.overrideWith(fetch ?? (_) async => items),
    ],
  );
  addTearDown(container.dispose);
  if (small) {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            accessibleNavigation: accessible,
            textScaler: TextScaler.linear(textScale),
          ),
          child: child!,
        ),
        home: _Launcher(items),
      ),
    ),
  );
  await tester.tap(find.text('Aç'));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  return (container: container, prefs: prefs);
}

class _Launcher extends StatefulWidget {
  const _Launcher(this.items);
  final List<CampaignStory> items;
  @override
  State<_Launcher> createState() => _LauncherState();
}

class _LauncherState extends State<_Launcher> {
  String result = '';
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Column(
      children: [
        TextButton(
          onPressed: () async {
            final value = await Navigator.of(context).push<String>(
              MaterialPageRoute(
                builder: (_) =>
                    CampaignStoryViewer(stories: widget.items, initialIndex: 0),
              ),
            );
            if (mounted) setState(() => result = value ?? 'kapandı');
          },
          child: const Text('Aç'),
        ),
        Text(result),
      ],
    ),
  );
}

Future<void> closeViewer(WidgetTester tester) async {
  await tester.tap(find.byTooltip('Hikayeyi kapat'));
  await tester.pumpAndSettle();
}

Future<void> tapStoryHalf(WidgetTester tester, {required bool next}) async {
  final area = tester.getRect(find.byType(CampaignStoryArtwork));
  await tester.tapAt(
    Offset(next ? area.right - 20 : area.left + 20, area.center.dy),
  );
}

void main() {
  testWidgets(
    'only opened campaigns are seen and close returns without a campaign action',
    (tester) async {
      final state = await openViewer(tester);
      expect(state.container.read(seenCampaignStoriesProvider), {'coffee:v1'});
      expect(find.byType(CoffeeRewardsPreview), findsOneWidget);
      expect(find.byType(LoadRewardsPreview), findsNothing);
      await tapStoryHalf(tester, next: true);
      await tester.pump();
      await tester.pump();
      expect(state.container.read(seenCampaignStoriesProvider), {
        'coffee:v1',
        'topup:v1',
      });
      expect(find.byType(LoadRewardsPreview), findsOneWidget);
      expect(find.byType(FilledButton), findsNothing);
      expect(find.text('Yükleme kampanyasını aç'), findsNothing);
      await closeViewer(tester);
      expect(find.text('kapandı'), findsOneWidget);
    },
  );

  testWidgets(
    'pause and background preserve remaining time, final story closes',
    (tester) async {
      await openViewer(tester);
      await tester.tap(find.byTooltip('Hikayeyi duraklat'));
      await tester.pump(const Duration(seconds: 12));
      expect(find.text('Kahve Kazan'), findsOneWidget);
      await tester.tap(find.byTooltip('Hikayeyi oynat'));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump(const Duration(seconds: 12));
      expect(find.text('Kahve Kazan'), findsOneWidget);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 8100));
      await tester.pump();
      expect(find.text('Yükle Kazan'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 8100));
      await tester.pumpAndSettle();
      expect(find.text('kapandı'), findsOneWidget);
    },
  );

  testWidgets('holding pauses; swiping and previous controls navigate', (
    tester,
  ) async {
    await openViewer(tester);
    final artwork = find.byType(CampaignStoryArtwork);
    final gesture = await tester.startGesture(tester.getCenter(artwork));
    await tester.pump(const Duration(seconds: 10));
    expect(find.text('Kahve Kazan'), findsOneWidget);
    await gesture.moveBy(const Offset(-160, 0));
    await gesture.up();
    await tester.pump();
    expect(find.text('Yükle Kazan'), findsOneWidget);
    await tapStoryHalf(tester, next: false);
    await tester.pump();
    expect(find.text('Kahve Kazan'), findsOneWidget);
    await closeViewer(tester);
  });

  testWidgets('releasing a long hold resumes without skipping the story', (
    tester,
  ) async {
    await openViewer(tester);
    final gesture = await tester.startGesture(
      tester.getCenter(find.byType(CampaignStoryArtwork)),
    );
    await tester.pump(const Duration(seconds: 10));
    await gesture.up(timeStamp: const Duration(seconds: 10));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Kahve Kazan'), findsOneWidget);
    await closeViewer(tester);
  });

  testWidgets('accessibility disables automatic advancement on small screen', (
    tester,
  ) async {
    await openViewer(tester, accessible: true, small: true);
    await tester.pump(const Duration(seconds: 20));
    expect(find.text('Kahve Kazan'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tapStoryHalf(tester, next: true);
    await tester.pump();
    expect(find.text('Yükle Kazan'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await closeViewer(tester);
  });

  testWidgets('a withdrawn story closes without remaining visible', (
    tester,
  ) async {
    var current = stories;
    final state = await openViewer(tester, fetch: (_) async => current);
    current = [stories.last];
    state.container.invalidate(campaignStoriesProvider);
    await tester.pump();
    await tester.pumpAndSettle();
    expect(find.byType(CampaignStoryViewer), findsNothing);
    expect(find.text('kapandı'), findsOneWidget);
  });

  testWidgets(
    'portrait artwork fills to the screen bottom without a CTA or bottom safe-area panel',
    (tester) async {
      tester.view.padding = const FakeViewPadding(top: 44, bottom: 34);
      await openViewer(tester, small: true, accessible: true, textScale: 2);
      await tester.pumpAndSettle();
      final poster = tester.getRect(find.byType(CampaignStoryArtwork));
      final header = tester.getRect(find.byTooltip('Hikayeyi kapat'));
      expect(find.byType(FilledButton), findsNothing);
      expect(find.text('Kahve kampanyasını aç'), findsNothing);
      expect(find.text('1 / 2'), findsNothing);
      expect(find.byTooltip('Sonraki hikaye'), findsNothing);
      expect(find.byIcon(Icons.chevron_left), findsNothing);
      expect(poster.left, 0);
      expect(poster.width, 320);
      expect(header.top, greaterThanOrEqualTo(44));
      expect(poster.top, greaterThanOrEqualTo(44));
      expect(poster.bottom, 568);
      expect(tester.takeException(), isNull);
      await tapStoryHalf(tester, next: true);
      await tester.pump();
      expect(find.byType(LoadRewardsPreview), findsOneWidget);
      expect(tester.takeException(), isNull);
      await closeViewer(tester);
    },
  );

  testWidgets('expiration still closes a manually paused story', (
    tester,
  ) async {
    final item = CampaignStory(
      id: 'expires',
      title: 'Süreli kampanya',
      action: 'kahve-ictikce',
      endsAt: DateTime.now().add(const Duration(seconds: 4)),
    );
    await openViewer(tester, items: [item]);
    await tester.tap(find.byTooltip('Hikayeyi duraklat'));
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    expect(find.text('kapandı'), findsOneWidget);
  });

  testWidgets(
    'live updates skip a withdrawn next story and close a revised current one',
    (tester) async {
      const third = CampaignStory(
        id: 'third',
        title: 'Diğer kampanya',
        updatedAt: 'v1',
      );
      final items = [...stories, third];
      var current = items;
      var offline = false;
      final state = await openViewer(
        tester,
        items: items,
        accessible: true,
        fetch: (_) async {
          if (offline) throw Exception('offline');
          return current;
        },
      );
      current = [stories.first, third];
      state.container.invalidate(campaignStoriesProvider);
      await tester.pump();
      await tester.pump();
      await tapStoryHalf(tester, next: true);
      await tester.pump();
      expect(find.text('Diğer kampanya'), findsOneWidget);
      expect(state.container.read(seenCampaignStoriesProvider), {
        'coffee:v1',
        'third:v1',
      });
      offline = true;
      state.container.invalidate(campaignStoriesProvider);
      await tester.pump();
      await tester.pump();
      expect(find.byType(CampaignStoryViewer), findsOneWidget);
      offline = false;
      current = [
        stories.first,
        const CampaignStory(id: 'third', title: 'Yeni afiş', updatedAt: 'v2'),
      ];
      state.container.invalidate(campaignStoriesProvider);
      await tester.pump();
      await tester.pumpAndSettle();
      expect(find.byType(CampaignStoryViewer), findsNothing);
      expect(
        state.container.read(seenCampaignStoriesProvider),
        isNot(contains('third:v2')),
      );
    },
  );

  testWidgets('an unread network image cannot disappear on its loading timer', (
    tester,
  ) async {
    const imageStory = CampaignStory(
      id: 'image',
      title: 'Görselli kampanya',
      imageUrl: 'http://127.0.0.1:1/missing-story.png',
    );
    final state = await openViewer(tester, items: [imageStory]);
    await tester.pump(const Duration(seconds: 20));
    expect(find.byType(CampaignStoryViewer), findsOneWidget);
    expect(state.container.read(seenCampaignStoriesProvider), isEmpty);
    expect(
      tester
          .widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator))
          .value,
      0,
    );
    await closeViewer(tester);
  });
}
