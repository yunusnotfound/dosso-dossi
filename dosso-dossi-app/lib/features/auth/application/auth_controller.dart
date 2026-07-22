import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/local_storage.dart';
import '../../../core/storage/token_storage.dart';
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
      await ref.read(tokenStorageProvider).save(result.token);
    }
    await _persist(result.user);
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
    await ref.read(sharedPreferencesProvider).remove(_userKey);
    await ref.read(tokenStorageProvider).clear();
    state = const AsyncData(null);
  }

  Future<void> _persist(AppUser user) async {
    await ref
        .read(sharedPreferencesProvider)
        .setString(_userKey, jsonEncode(user.toJson()));
    state = AsyncData(user);
  }
}
