import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/local_storage.dart';
import '../domain/campaign_story.dart';

/// Public content: the same stories are available to guests and members.
final campaignStoriesProvider = FutureProvider<List<CampaignStory>>((
  ref,
) async {
  if (AppConfig.useMocks) {
    return const [
      CampaignStory(
        id: 'story-coffee-rewards',
        title: 'Kahve Kazan',
        action: 'kahve-ictikce',
        actionLabel: 'Kampanyayı keşfet',
      ),
      CampaignStory(
        id: 'story-topup-rewards',
        title: 'Yükle Kazan',
        action: 'yukle-kazan',
        actionLabel: 'Kampanyayı keşfet',
      ),
    ];
  }
  final response = await apiCall(
    () => ref.watch(apiClientProvider).get<List<dynamic>>('/campaign-stories'),
  );
  final stories = [
    for (final row in response.data!)
      CampaignStory.fromJson(row as Map<String, dynamic>),
  ];
  // A scheduled publication is a clock change, not necessarily an admin edit.
  // Only poll this content while a visible widget is subscribed.
  return stories;
});

/// Local viewing state contains campaign identifiers only, never account data.
final seenCampaignStoriesProvider =
    NotifierProvider<SeenCampaignStories, Set<String>>(SeenCampaignStories.new);

class SeenCampaignStories extends Notifier<Set<String>> {
  static const _key = 'campaign_stories_seen_v1';
  Future<void> _writes = Future.value();

  @override
  Set<String> build() =>
      ref.watch(sharedPreferencesProvider).getStringList(_key)?.toSet() ?? {};

  void markSeen(CampaignStory story) {
    if (state.contains(story.seenKey)) return;
    final next = {...state, story.seenKey}.toList();
    // Bound device storage and retain the most recent campaign revisions.
    final bounded = next.length > 200 ? next.sublist(next.length - 200) : next;
    state = bounded.toSet();
    final prefs = ref.read(sharedPreferencesProvider);
    _writes = _writes
        .then((_) async {
          await prefs.setStringList(_key, bounded);
        })
        .catchError((_) {});
  }
}
