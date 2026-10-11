class CampaignStory {
  const CampaignStory({
    required this.id,
    required this.title,
    this.description = '',
    this.imageUrl = '',
    this.action = 'none',
    this.actionLabel = '',
    this.updatedAt = '',
    this.startsAt,
    this.endsAt,
  });

  final String id;
  final String title;
  final String description;
  final String imageUrl;
  final String action;
  final String actionLabel;
  final String updatedAt;
  final DateTime? startsAt;
  final DateTime? endsAt;

  String get seenKey => '$id:$updatedAt';
  bool isVisibleAt(DateTime now) =>
      (startsAt == null || !startsAt!.isAfter(now)) &&
      (endsAt == null || endsAt!.isAfter(now));

  /// A transparent product cover, separate from the full-size story poster.
  String get thumbnailAsset => switch (action) {
    'kahve-ictikce' => 'assets/images/story_cover_coffee.webp',
    'yukle-kazan' => 'assets/images/onboarding_hediye_kutusu.png',
    'siparis' => 'assets/images/story_cover_drinks.webp',
    'online-magaza' => 'assets/images/story_cover_beans.webp',
    _ => 'assets/images/logo.png',
  };

  String get fallbackAsset => action == 'yukle-kazan'
      ? 'assets/images/onboarding_hediye_kutusu.png'
      : action == 'kahve-ictikce'
      ? 'assets/images/yukle_kazan_cup.png'
      : 'assets/images/logo.png';

  factory CampaignStory.fromJson(Map<String, dynamic> json) => CampaignStory(
    id: json['id'] as String,
    title: json['title'] as String,
    description: json['description'] as String? ?? '',
    imageUrl: json['imageUrl'] as String? ?? '',
    action: json['action'] as String? ?? 'none',
    actionLabel: json['actionLabel'] as String? ?? '',
    updatedAt: json['updatedAt'] as String? ?? '',
    startsAt: DateTime.tryParse(json['startsAt'] as String? ?? ''),
    endsAt: DateTime.tryParse(json['endsAt'] as String? ?? ''),
  );
}
