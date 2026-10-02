import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/local_storage.dart';
import '../../../core/network/session_scope.dart';
import '../../order/application/cart_controller.dart';
import '../../../core/storage/token_storage.dart';
import '../../favorites/application/favorites_controller.dart';
import '../../gift/application/gift_controller.dart';
import '../../order/application/order_providers.dart';
import '../../profile/application/notification_prefs.dart';
import '../../rewards/application/loyalty_providers.dart';
import '../../wallet/application/wallet_providers.dart';
import '../data/auth_repository.dart';
import '../domain/app_user.dart';
import 'guest_mode.dart';

/// Oturum durumu: null = giriş yapılmamış.
/// Cihaza kaydedilir; uygulama yeniden açıldığında oturum devam eder.
final authControllerProvider = AsyncNotifierProvider<AuthController, AppUser?>(
  AuthController.new,
);

class AuthController extends AsyncNotifier<AppUser?> {
  static const _userKey = 'auth_user';

  @override
  Future<AppUser?> build() async {
    final raw = ref.watch(sharedPreferencesProvider).getString(_userKey);
    if (raw == null) return null;
    return AppUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> sendOtp(String phone) {
    return ref.read(authRepositoryProvider).sendOtp(phone);
  }

  Future<void> verifyOtp({required String phone, required String code}) async {
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    final result = await ref
        .read(authRepositoryProvider)
        .verifyOtp(phone: phone, code: code);
    if (!ref.mounted || scope.revision != epoch) return;
    scope.advance();
    final loginEpoch = scope.revision;
    bool current() => ref.mounted && scope.revision == loginEpoch;
    if (result.token.isNotEmpty) {
      final saved = await ref
          .read(tokenStorageProvider)
          .saveTokensIfCurrent(
            access: result.token,
            refresh: result.refreshToken,
            isCurrent: current,
          );
      if (!saved || !current()) return;
    }
    await ref.read(guestModeProvider.notifier).exit();
    if (!current()) return;
    await _persist(result.user, loginEpoch);
    if (current()) _resetUserScopedState();
  }

  Future<void> completeProfile(String name) async {
    final current = state.value;
    final epoch = ref.read(sessionScopeProvider).revision;
    if (current == null) return;
    await ref.read(authRepositoryProvider).updateProfile(name: name);
    if (!ref.mounted || ref.read(sessionScopeProvider).revision != epoch) {
      return;
    }
    await _persist(current.copyWith(name: name), epoch);
  }

  /// Kişisel bilgiler ekranından ad/e-posta güncelleme.
  Future<void> updateProfile({String? name, String? email}) async {
    final current = state.value;
    final epoch = ref.read(sessionScopeProvider).revision;
    if (current == null) return;
    await ref
        .read(authRepositoryProvider)
        .updateProfile(name: name, email: email);
    if (!ref.mounted || ref.read(sessionScopeProvider).revision != epoch) {
      return;
    }
    await _persist(current.copyWith(name: name, email: email), epoch);
  }

  Future<void> logout() async {
    final tokens = ref.read(tokenStorageProvider);
    final repository = ref.read(authRepositoryProvider);
    final prefs = ref.read(sharedPreferencesProvider);
    final scope = ref.read(sessionScopeProvider);
    scope.advance();
    final logoutEpoch = scope.revision;
    state = const AsyncData(null);
    _resetUserScopedState();
    // Remove cached user immediately, before waiting for any platform/network IO.
    final removals = [
      for (final key in [
        _userKey,
        'favorite_products',
        'notif_campaigns',
        'notif_orders',
        'notif_sms',
      ])
        prefs.remove(key),
    ];
    final refresh = await tokens.readRefresh();
    if (scope.revision == logoutEpoch) await tokens.clear();
    await Future.wait(removals);
    // A new login is allowed while this best-effort revocation is in flight.
    if (refresh != null) {
      try {
        await repository.logout(refresh);
      } catch (_) {}
    }
  }

  /// Kullanıcıya özel tüm provider'ları sıfırlar. Bunlar keep-alive olduğu
  /// için hesap değişiminde çağrılmazsa önceki hesabın damga/bakiye/sipariş
  /// verisi bellekte kalır ve yeni hesapta görünür.
  void _resetUserScopedState() {
    ref.invalidate(cartProvider);
    ref.invalidate(selectedBranchProvider);
    if (ref.exists(loyaltyStatusProvider)) {
      ref.read(loyaltyStatusProvider.notifier).clearForSession();
    }
    if (ref.exists(walletProvider)) {
      ref.read(walletProvider.notifier).clearForSession();
    }
    ref.invalidate(loyaltyStatusProvider);
    ref.invalidate(walletProvider);
    ref.invalidate(ordersProvider);
    ref.invalidate(ordersLoadProvider);
    ref.invalidate(giftsLoadProvider);
    ref.invalidate(giftControllerProvider);
    ref.invalidate(notificationPrefsProvider);
    ref.invalidate(notificationSaveErrorProvider);
    ref.invalidate(favoritesProvider);
  }

  Future<void> _persist(AppUser user, int epoch) async {
    final scope = ref.read(sessionScopeProvider);
    if (!ref.mounted || scope.revision != epoch) return;
    await ref
        .read(sharedPreferencesProvider)
        .setString(_userKey, jsonEncode(user.toJson()));
    if (ref.mounted && scope.revision == epoch) state = AsyncData(user);
  }
}
