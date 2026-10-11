import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/constants/app_config.dart';
import 'core/diagnostics/app_telemetry.dart';
import 'core/diagnostics/error_handlers.dart';
import 'core/network/api_client.dart';
import 'core/storage/local_storage.dart';
import 'features/auth/application/auth_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  installErrorHandlers(appTelemetry);
  AppConfig.validateReleaseConfiguration();
  // Uygulama yalnızca dikey kullanılır: ekran döndürme kapalı.
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  final prefs = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        // API 401 döndüğünde oturumu kapat (token süresi dolmuş demektir)
        onUnauthorizedProvider.overrideWith(
          (ref) =>
              () => ref.read(authControllerProvider.notifier).logout(),
        ),
      ],
      child: const DossoDossiApp(),
    ),
  );
}
