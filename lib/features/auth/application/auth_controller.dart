import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/local_storage.dart';
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
    final user = await ref
        .read(authRepositoryProvider)
        .verifyOtp(phone: phone, code: code);
    await _persist(user);
  }

  Future<void> completeProfile(String name) async {
    final current = state.value;
    if (current == null) return;
    final user = await ref
        .read(authRepositoryProvider)
        .completeProfile(phone: current.phone, name: name);
    await _persist(user);
  }

  /// Kişisel bilgiler ekranından ad/e-posta güncelleme.
  Future<void> updateProfile({String? name, String? email}) async {
    final current = state.value;
    if (current == null) return;
    await _persist(current.copyWith(name: name, email: email));
  }

  Future<void> logout() async {
    await ref.read(sharedPreferencesProvider).remove(_userKey);
    state = const AsyncData(null);
  }

  Future<void> _persist(AppUser user) async {
    await ref
        .read(sharedPreferencesProvider)
        .setString(_userKey, jsonEncode(user.toJson()));
    state = AsyncData(user);
  }
}
