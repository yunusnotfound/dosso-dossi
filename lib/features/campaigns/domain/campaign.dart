/// Kampanya kartı görsel stili.
enum CampaignStyle { orange, dark }

class Campaign {
  const Campaign({
    required this.id,
    required this.title,
    required this.badge,
    required this.description,
    this.style = CampaignStyle.orange,
  });

  final String id;
  final String title;

  /// Kart üstündeki küçük rozet: "2x", "%50" gibi
  final String badge;

  final String description;
  final CampaignStyle style;
}
