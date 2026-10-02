import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/story_theme.dart';
import '../../domain/campaign_story.dart';
import 'campaign_story_thumbnail.dart';

/// Overlay chrome stays on the poster; its thumbnail identifies this campaign.
class CampaignStoryHeader extends StatelessWidget {
  const CampaignStoryHeader({
    super.key,
    required this.story,
    required this.index,
    required this.count,
    required this.progress,
    required this.paused,
    required this.onPause,
    required this.onClose,
  });

  final CampaignStory story;
  final int index, count;
  final Animation<double> progress;
  final bool paused;
  final VoidCallback onPause, onClose;

  static double extent(BuildContext context) =>
      80 + (MediaQuery.textScalerOf(context).scale(1) - 1).clamp(0, 4) * 40;

  @override
  Widget build(BuildContext context) {
    final uploaded = story.imageUrl.isNotEmpty;
    final foreground = uploaded ? Colors.white : AppColors.coffeeDark;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: uploaded
            ? const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xA6000000), Colors.transparent],
              )
            : null,
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 7, 8, 8),
        child: Column(
          children: [
            AnimatedBuilder(
              animation: progress,
              builder: (_, _) => Row(
                children: List.generate(
                  count,
                  (i) => Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: ExcludeSemantics(
                        child: LinearProgressIndicator(
                          value: i < index
                              ? 1
                              : i == index
                              ? progress.value
                              : 0,
                          color: uploaded ? Colors.white : AppColors.primary,
                          backgroundColor: uploaded
                              ? Colors.white38
                              : AppColors.surfaceSunken,
                          minHeight: 2,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 7),
            Expanded(
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    padding: const EdgeInsets.all(2),
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: StoryTheme.ring,
                    ),
                    child: ClipOval(
                      child: ColoredBox(
                        color: Colors.white,
                        child: CampaignStoryThumbnail(story: story),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Semantics(
                      liveRegion: true,
                      label: '${story.title}, ${index + 1} / $count hikaye',
                      child: ExcludeSemantics(
                        child: Text(
                          story.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: foreground,
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            height: 1.15,
                          ),
                        ),
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: onPause,
                    tooltip: paused ? 'Hikayeyi oynat' : 'Hikayeyi duraklat',
                    icon: Icon(
                      paused ? Icons.play_arrow : Icons.pause,
                      color: foreground,
                      size: 21,
                    ),
                  ),
                  IconButton(
                    onPressed: onClose,
                    tooltip: 'Hikayeyi kapat',
                    icon: Icon(Icons.close, color: foreground, size: 28),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
