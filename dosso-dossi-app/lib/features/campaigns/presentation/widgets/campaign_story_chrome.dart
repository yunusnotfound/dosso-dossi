import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import 'campaign_story_header.dart';
import '../../domain/campaign_story.dart';

class CampaignStoryChrome extends StatelessWidget {
  const CampaignStoryChrome({
    super.key,
    required this.story,
    required this.index,
    required this.count,
    required this.progress,
    required this.paused,
    required this.onClose,
    required this.onPrevious,
    required this.onNext,
    required this.onPause,
    required this.artwork,
  });

  final CampaignStory story;
  final int index, count;
  final Animation<double> progress;
  final bool paused;
  final VoidCallback onClose, onPrevious, onNext, onPause;
  final Widget artwork;

  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: SystemUiOverlayStyle.light,
    child: Scaffold(
      backgroundColor: AppColors.coffeeDark,
      body: SafeArea(
        bottom: false,
        child: ColoredBox(
          color: AppColors.campaignBackground,
          child: Semantics(
            customSemanticsActions: {
              const CustomSemanticsAction(label: 'Önceki hikaye'): onPrevious,
              const CustomSemanticsAction(label: 'Sonraki hikaye'): onNext,
            },
            child: Stack(
              fit: StackFit.expand,
              children: [
                Padding(
                  padding: EdgeInsets.only(
                    top: story.imageUrl.isEmpty
                        ? CampaignStoryHeader.extent(context)
                        : 0,
                  ),
                  child: Semantics(
                    label: story.description.isEmpty ? null : story.description,
                    child: artwork,
                  ),
                ),
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  height: CampaignStoryHeader.extent(context),
                  child: CampaignStoryHeader(
                    story: story,
                    index: index,
                    count: count,
                    progress: progress,
                    paused: paused,
                    onPause: onPause,
                    onClose: onClose,
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
