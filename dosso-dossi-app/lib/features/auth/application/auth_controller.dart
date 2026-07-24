import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/local_storage.dart';
import '../../../core/storage/token_storage.dart';
import '../../favorites/application/favorites_controller.dart';
import '../../gift/application/gift_controller.dart';
import '../../order/application/order_providers.dart';
import '../../profile/application/notification_prefs.dart';
import '../../rewards/application/loyalty_providers.dart';
import '../../wallet/application/wallet_providers.dart';
import '../data/auth_repository.dart';
import '../domain/app_user.dart';

/// Oturum durumu: null = giriş yapılmamış.
/// Cihaza kaydedilir; uygulama yeniden açıldığında oturum devam eder.
final authControllerProvider =
    AsyncNotifierProvider<AuthController, AppUser?>(AuthController.new);

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
    final result = await ref
        .read(authRepositoryProvider)
        .verifyOtp(phone: phone, code: code);
    if (result.token.isNotEmpty) {
      await ref.read(tokenStorageProvider).saveTokens(
            access: result.token,
            refresh: result.refreshToken,
          );
    }
    await _persist(result.user);
    _resetUserScopedState();
  }

  Future<void> completeProfile(String name) async {
    final current = state.value;
    if (current == null) return;
    await ref.read(authRepositoryProvider).updateProfile(name: name);
    await _persist(current.copyWith(name: name));
  }

  /// Kişisel bilgiler ekranından ad/e-posta güncelleme.
  Future<void> updateProfile({String? name, String? email}) async {
    final current = state.value;
    if (current == null) return;
    await ref
        .read(authRepositoryProvider)
        .updateProfile(name: name, email: email);
    await _persist(current.copyWith(name: name, email: email));
  }

  Future<void> logout() async {
    // Sunucudaki oturumu da kapat (best-effort; ağ hatası çıkışı engellemez)
    try {
      final refresh = await ref.read(tokenStorageProvider).readRefresh();
      if (refresh != null) {
        await ref.read(authRepositoryProvider).logout(refresh);
      }
    } catch (_) {}

    final prefs = ref.read(sharedPreferencesProvider);
    await prefs.remove(_userKey);
    // Cihazda hesaba özel senkron olmayan veriler yeni hesaba taşınmasın.
    await prefs.remove('favorite_products');
    await prefs.remove('notif_campaigns');
    await prefs.remove('notif_orders');
    await prefs.remove('notif_sms');
    await ref.read(tokenStorageProvider).clear();
    state = const AsyncData(null);
    _resetUserScopedState();
  }

  /// Kullanıcıya özel tüm provider'ları sıfırlar. Bunlar keep-alive olduğu
  /// için hesap değişiminde çağrılmazsa önceki hesabın damga/bakiye/sipariş
  /// verisi bellekte kalır ve yeni hesapta görünür.
  void _resetUserScopedState() {
    ref.invalidate(loyaltyStatusProvider);
    ref.invalidate(walletProvider);
    ref.invalidate(ordersProvider);
    ref.invalidate(giftControllerProvider);
    ref.invalidate(notificationPrefsProvider);
    ref.invalidate(favoritesProvider);
  }

  Future<void> _persist(AppUser user) async {
    await ref
        .read(sharedPreferencesProvider)
        .setString(_userKey, jsonEncode(user.toJson()));
    state = AsyncData(user);
  }
}
