import 'package:flutter/material.dart';

import '../../../../core/theme/story_theme.dart';
import '../../domain/campaign_story.dart';

/// Product silhouettes stay clear and complete inside both story avatar sizes.
class CampaignStoryThumbnail extends StatelessWidget {
  const CampaignStoryThumbnail({super.key, required this.story});

  final CampaignStory story;

  @override
  Widget build(BuildContext context) {
    final scale = switch (story.action) {
      'yukle-kazan' => StoryTheme.giftCoverScale,
      'online-magaza' => StoryTheme.packageCoverScale,
      _ => StoryTheme.coverScale,
    };
    return FractionallySizedBox(
      widthFactor: scale,
      heightFactor: scale,
      child: Image.asset(
        story.thumbnailAsset,
        fit: BoxFit.contain,
        cacheWidth: 256,
        excludeFromSemantics: true,
      ),
    );
  }
}
