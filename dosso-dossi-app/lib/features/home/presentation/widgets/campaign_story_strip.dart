import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_config.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/story_theme.dart';
import '../../../campaigns/application/campaign_story_providers.dart';
import '../../../campaigns/domain/campaign_story.dart';
import '../../../campaigns/presentation/campaign_story_viewer.dart';
import '../../../campaigns/presentation/widgets/campaign_story_thumbnail.dart';

/// Public campaign stories in the home screen's “Öne Çıkanlar” section.
class CampaignStoryStrip extends ConsumerStatefulWidget {
  const CampaignStoryStrip({super.key});
  @override
  ConsumerState<CampaignStoryStrip> createState() => _CampaignStoryStripState();
}

class _CampaignStoryStripState extends ConsumerState<CampaignStoryStrip>
    with WidgetsBindingObserver {
  Timer? _scheduleRefresh;
  Timer? _expiry;
  bool _visible = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _visible = TickerMode.valuesOf(context).enabled;
    _schedule();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) => _schedule();

  void _schedule() {
    _scheduleRefresh?.cancel();
    if (AppConfig.useMocks ||
        !_visible ||
        (WidgetsBinding.instance.lifecycleState != null &&
            WidgetsBinding.instance.lifecycleState !=
                AppLifecycleState.resumed)) {
      return;
    }
    // Admin edits use the existing revision sync. This small clock refresh also
    // discovers publications whose scheduled start arrives without a new edit.
    _scheduleRefresh = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) ref.invalidate(campaignStoriesProvider);
    });
  }

  void _scheduleExpiry(List<CampaignStory> stories) {
    _expiry?.cancel();
    final now = DateTime.now();
    final ends =
        stories
            .map((s) => s.endsAt)
            .whereType<DateTime>()
            .where((date) => date.isAfter(now))
            .toList()
          ..sort();
    if (ends.isNotEmpty) {
      _expiry = Timer(ends.first.difference(now), () {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _scheduleRefresh?.cancel();
    _expiry?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _open(List<CampaignStory> stories, int index) async {
    await Navigator.of(context, rootNavigator: true).push<void>(
      MaterialPageRoute(
        builder: (_) =>
            CampaignStoryViewer(stories: stories, initialIndex: index),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(campaignStoriesProvider);
    final seen = ref.watch(seenCampaignStoriesProvider);
    final items = (data.value ?? <CampaignStory>[])
        .where((story) => story.isVisibleAt(DateTime.now()))
        .toList();
    _scheduleExpiry(items);
    if (items.isEmpty) return const SizedBox.shrink();
    final labelHeight =
        (MediaQuery.textScalerOf(context).scale(13) * 1.35).ceilToDouble() * 2 +
        2;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('ÖNE ÇIKANLAR', style: AppTypography.sectionLabel),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            height: StoryTheme.diameter + AppSpacing.sm + labelHeight,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, index) => _StoryCircle(
                story: items[index],
                seen: seen.contains(items[index].seenKey),
                onTap: () => _open(items, index),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StoryCircle extends StatelessWidget {
  const _StoryCircle({
    required this.story,
    required this.seen,
    required this.onTap,
  });
  final CampaignStory story;
  final bool seen;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: '${story.title}, kampanya hikâyesi',
    hint: seen ? 'Tekrar izle' : 'Yeni hikâyeyi izle',
    child: SizedBox(
      width: StoryTheme.itemWidth,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: ExcludeSemantics(
            child: Column(
              children: [
                Container(
                  width: StoryTheme.diameter,
                  height: StoryTheme.diameter,
                  padding: const EdgeInsets.all(StoryTheme.ringWidth),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: StoryTheme.ring,
                  ),
                  child: DecoratedBox(
                    decoration: const BoxDecoration(
                      color: AppColors.surface,
                      shape: BoxShape.circle,
                    ),
                    child: ClipOval(
                      child: CampaignStoryThumbnail(story: story),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  story.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
