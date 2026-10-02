import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../auth/application/guest_mode.dart';
import '../../auth/application/auth_controller.dart';
import '../../rewards/application/loyalty_providers.dart';

class CampaignRules {
  const CampaignRules({
    this.stampTarget = AppConfig.stampsPerReward,
    this.topupThreshold = AppConfig.topUpBonusThreshold,
    this.topupBonusDrinks = AppConfig.topUpBonusDrinks,
    this.topupFirstOnly = true,
  });
  final int stampTarget;
  final double topupThreshold;
  final int topupBonusDrinks;
  final bool topupFirstOnly;
  factory CampaignRules.fromJson(Map<String, dynamic> json) => CampaignRules(
    stampTarget: (json['stampTarget'] as num).toInt(),
    topupThreshold: (json['topupThreshold'] as num).toDouble(),
    topupBonusDrinks: (json['topupBonusDrinks'] as num).toInt(),
    topupFirstOnly: json['topupFirstOnly'] as bool,
  );
}

final publicConfigProvider = FutureProvider<CampaignRules>((ref) async {
  if (AppConfig.useMocks) return const CampaignRules();
  final result = await ref
      .watch(apiClientProvider)
      .get<Map<String, dynamic>>('/config/public');
  return CampaignRules.fromJson(result.data!);
});
final campaignRulesProvider = Provider<CampaignRules>(
  (ref) => ref.watch(publicConfigProvider).value ?? const CampaignRules(),
);
final currentStampTargetProvider = Provider<int>((ref) {
  final target = ref.watch(campaignRulesProvider).stampTarget;
  if (ref.watch(guestModeProvider) ||
      ref.watch(authControllerProvider).value == null) {
    return target;
  }
  return ref.watch(loyaltyStatusProvider).value?.target ?? target;
});
