import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/application/guest_mode.dart';
import '../../features/branches/application/branch_providers.dart';
import '../../features/campaigns/application/campaign_providers.dart';
import '../../features/campaigns/application/campaign_story_providers.dart';
import '../../features/campaigns/application/public_config.dart';
import '../../features/order/application/cart_controller.dart';
import '../../features/order/application/menu_providers.dart';
import '../../features/order/application/order_providers.dart';
import '../../features/rewards/application/loyalty_providers.dart';
import '../../features/wallet/application/wallet_providers.dart';
import '../constants/app_config.dart';
import '../network/api_client.dart';
import '../network/api_endpoints.dart';
import 'revision_sync.dart';

/// Mounted once above every route, including product detail and the cart.
/// Background apps and mock previews do not poll the server.
final appDataSyncProvider = Provider.autoDispose<void>((ref) {
  if (AppConfig.useMocks) return;
  final dio = ref.watch(apiClientProvider);
  bool signedIn() =>
      !ref.read(guestModeProvider) &&
      ref.read(authControllerProvider).value != null;

  final sync = RevisionSync(
    fetchRevisions: () async {
      final response = await dio.get<Map<String, dynamic>>(
        ApiEndpoints.syncRevisions,
      );
      return response.data!.map((key, value) => MapEntry(key, value as String));
    },
    refreshers: {
      'menu': () async {
        ref.invalidate(menuCategoriesProvider);
        ref.invalidate(menuProductsProvider);
        ref.invalidate(giftMenuProductsProvider);
        ref.invalidate(menuOptionsProvider);
        await Future.wait([
          ref.read(menuCategoriesProvider.future),
          ref.read(menuProductsProvider.future),
          ref.read(menuOptionsProvider.future),
        ]);
      },
      'branches': () async {
        ref.invalidate(branchesProvider);
        await ref.read(branchesProvider.future);
      },
      'campaigns': () async {
        ref.invalidate(campaignsProvider);
        ref.invalidate(campaignStoriesProvider);
        ref.invalidate(publicConfigProvider);
        await Future.wait([
          ref.read(campaignsProvider.future),
          ref.read(campaignStoriesProvider.future),
          ref.read(publicConfigProvider.future),
        ]);
        if (ref.mounted && signedIn()) {
          await ref.read(cartProvider.notifier).refreshPromo();
        }
      },
      'loyalty': () async {
        if (!signedIn()) return;
        ref.invalidate(loyaltyStatusProvider);
        await ref.read(loyaltyStatusProvider.future);
      },
      'wallet': () async {
        if (!signedIn()) return;
        ref.invalidate(walletProvider);
        await ref.read(walletProvider.future);
      },
      'orders': () async {
        if (!signedIn()) return;
        await ref.read(ordersProvider.notifier).refresh();
      },
    },
  );
  final lifecycle = AppLifecycleListener(
    onStateChange: (state) {
      if (state == AppLifecycleState.resumed) {
        sync.start();
      } else {
        sync.stop();
      }
    },
  );
  // Avoid invalidating providers while MaterialApp is still building.
  final start = Timer(Duration.zero, () {
    final state = WidgetsBinding.instance.lifecycleState;
    if (state == null || state == AppLifecycleState.resumed) sync.start();
  });
  ref.onDispose(() {
    start.cancel();
    lifecycle.dispose();
    sync.dispose();
  });
});
