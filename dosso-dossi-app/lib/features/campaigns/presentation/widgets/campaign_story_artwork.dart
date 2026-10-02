import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/campaign_story.dart';
import 'coffee_rewards_preview.dart';
import 'load_rewards_preview.dart';

/// Current campaign components are reused; their rules come from public config.
class CampaignStoryArtwork extends StatefulWidget {
  const CampaignStoryArtwork({
    super.key,
    required this.story,
    required this.onReady,
  });
  final CampaignStory story;
  final ValueChanged<bool> onReady;

  @override
  State<CampaignStoryArtwork> createState() => _CampaignStoryArtworkState();
}

class _CampaignStoryArtworkState extends State<CampaignStoryArtwork> {
  bool _ready = false;
  int _attempt = 0;

  void _notify(bool ready) {
    if (_ready == ready) return;
    _ready = ready;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _ready == ready) widget.onReady(ready);
    });
  }

  Future<void> _retry() async {
    _notify(false);
    await CachedNetworkImage.evictFromCache(
      ApiEndpoints.mediaUrl(widget.story.imageUrl),
    );
    if (mounted) setState(() => _attempt++);
  }

  @override
  Widget build(BuildContext context) {
    final story = widget.story;
    if (story.imageUrl.isEmpty) {
      return SizedBox.expand(
        child: switch (story.action) {
          'kahve-ictikce' => const CoffeeRewardsPreview(fillHeight: true),
          'yukle-kazan' => const LoadRewardsPreview(fillHeight: true),
          _ => Padding(
            padding: const EdgeInsets.all(40),
            child: Image.asset(story.fallbackAsset, fit: BoxFit.contain),
          ),
        },
      );
    }
    return Semantics(
      image: true,
      label: story.title,
      child: CachedNetworkImage(
        key: ValueKey(_attempt),
        imageUrl: ApiEndpoints.mediaUrl(story.imageUrl),
        memCacheWidth: 1400,
        fadeInDuration: Duration.zero,
        imageBuilder: (_, provider) {
          _notify(true);
          return Image(image: provider, fit: BoxFit.cover);
        },
        placeholder: (_, _) => const Center(
          child: CircularProgressIndicator(
            color: AppColors.primary,
            semanticsLabel: 'Hikaye yükleniyor',
          ),
        ),
        errorWidget: (_, _, _) {
          _notify(false);
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.broken_image_outlined,
                  color: AppColors.textSecondary,
                  size: 40,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Görsel yüklenemedi',
                  style: TextStyle(color: AppColors.coffeeDark),
                ),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: _retry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Tekrar dene'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
