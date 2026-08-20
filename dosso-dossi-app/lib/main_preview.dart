import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/network/api_client.dart';
import 'core/storage/local_storage.dart';
import 'features/auth/application/auth_controller.dart';

/// GELİŞTİRME GİRİŞİ — üretimde kullanılmaz.
/// Simülatörde giriş adımlarını atlayıp uygulamayı hazır bir oturumla açar;
/// ekran tasarımlarını hızlıca görmek için:
///   flutter run -t lib/main_preview.dart --dart-define=USE_MOCKS=true
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(
    'auth_user',
    jsonEncode({
      'phone': '5551112233',
      'name': 'Berkay Demir',
      'email': 'berkay@example.com',
    }),
  );
  runApp(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        onUnauthorizedProvider.overrideWith(
          (ref) => () => ref.read(authControllerProvider.notifier).logout(),
        ),
      ],
      child: const DossoDossiApp(),
    ),
  );
}
