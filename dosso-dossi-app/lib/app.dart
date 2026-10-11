import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_theme.dart';
import 'core/sync/app_data_sync.dart';
import 'routing/app_router.dart';

class DossoDossiApp extends ConsumerWidget {
  const DossoDossiApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(appDataSyncProvider);
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Dosso Dossi',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      // Restore dark status-bar icons after the full-screen dark story reader.
      builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.dark,
        child: child!,
      ),
      routerConfig: router,
    );
  }
}
