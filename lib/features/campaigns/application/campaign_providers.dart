import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/campaign_repository.dart';
import '../domain/campaign.dart';

final campaignsProvider = FutureProvider<List<Campaign>>((ref) {
  return ref.watch(campaignRepositoryProvider).getCampaigns();
});
