import 'package:flutter/material.dart';

abstract final class ApprovedCampaignAssets {
  static const coffee = 'assets/images/campaign_bes_damga_approved.webp';
  static const topup = 'assets/images/campaign_yukle_kazan_approved.webp';
}

/// The card uses the artwork's own proportions so the poster fills it completely.
class ApprovedCampaignPoster extends StatelessWidget {
  const ApprovedCampaignPoster({super.key, required this.asset});

  static const aspectRatio = 941 / 1672;
  final String asset;

  @override
  Widget build(BuildContext context) => Image.asset(
    asset,
    width: double.infinity,
    height: double.infinity,
    fit: BoxFit.contain,
    excludeFromSemantics: true,
    cacheWidth: 720,
  );
}
