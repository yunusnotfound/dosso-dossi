import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/network/session_scope.dart';
import '../../rewards/application/loyalty_providers.dart';
import '../../wallet/application/wallet_providers.dart';
import '../../wallet/data/wallet_repository.dart';

final topUpFlowCoordinatorProvider = Provider<TopUpFlowCoordinator>(
  TopUpFlowCoordinator.new,
);

/// Coordinates confirmation and account updates without owning presentation.
class TopUpFlowCoordinator {
  TopUpFlowCoordinator(this._ref);

  final Ref _ref;

  /// Returns null when canceled, busy, or no longer in the originating session.
  Future<TopUpResult?> confirmAndTopUp({
    required double amount,
    required Future<bool?> Function() confirm,
    required bool Function() isActive,
  }) async {
    if (_ref.read(topUpFlowProvider)) return null;
    final flow = _ref.read(topUpFlowProvider.notifier);
    final scope = _ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    bool isCurrent() => _ref.mounted && isActive() && scope.revision == epoch;

    flow.set(true);
    try {
      final confirmed = await confirm();
      if (confirmed != true || !isCurrent()) return null;

      final result = await _ref.read(walletProvider.notifier).topUp(amount);
      if (!isCurrent()) return null;

      // A pending payment grants no bonus; API payments already apply it server-side.
      if (!result.isPending && result.bonusDrinks > 0 && AppConfig.useMocks) {
        _ref
            .read(loyaltyStatusProvider.notifier)
            .addFreeDrinks(
              result.bonusDrinks,
              'Yükleme kampanyası — ${result.bonusDrinks} ikram kazanıldı',
            );
      }
      return result;
    } catch (_) {
      // A late failure from an old account must not appear in the next session.
      if (!isCurrent()) return null;
      rethrow;
    } finally {
      if (_ref.mounted) flow.set(false);
    }
  }
}
