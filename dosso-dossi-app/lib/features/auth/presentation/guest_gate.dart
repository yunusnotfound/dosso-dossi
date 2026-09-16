import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../routing/app_router.dart';
import '../application/guest_mode.dart';

/// Hesap gerektiren bir işlemi konuk kullanıcı için durdurur.
///
/// Konuksa giriş istemini açar ve `true` döner (çağıran işlemi yapmamalı);
/// üyeyse `false` döner. [action] istemde gösterilir: "Sipariş vermek için…".
bool blockedForGuest(
  BuildContext context,
  WidgetRef ref, {
  required String action,
}) {
  if (!ref.read(guestModeProvider)) return false;
  showGuestSignInSheet(context, ref, action: action);
  return true;
}

/// Konuk kullanıcıya giriş çağrısı yapan alt sayfa.
Future<void> showGuestSignInSheet(
  BuildContext context,
  WidgetRef ref, {
  required String action,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.background,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.page),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 56,
                height: 56,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AppColors.surfaceTint,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.lock_outline,
                  color: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Bunun için hesap gerekiyor',
              textAlign: TextAlign.center,
              style: AppTypography.title,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '$action için giriş yapman gerekiyor. '
              'Konuk olarak menüyü ve mağazaları gezmeye devam edebilirsin.',
              textAlign: TextAlign.center,
              style: AppTypography.bodySecondary,
            ),
            const SizedBox(height: AppSpacing.xl),
            FilledButton(
              onPressed: () async {
                Navigator.of(sheetContext).pop();
                await ref.read(guestModeProvider.notifier).exit();
                if (context.mounted) context.go(Routes.login);
              },
              child: const Text('Giriş yap / Üye ol'),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextButton(
              onPressed: () => Navigator.of(sheetContext).pop(),
              child: Text(
                'Konuk olarak devam et',
                style: AppTypography.body.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

/// Hesap gerektiren bir sekmenin konuk hâli: kilit, kısa açıklama ve
/// giriş çağrısı. Sekmenin kendi başlığı korunur, gövdesi bununla değişir.
class GuestLockedView extends ConsumerWidget {
  const GuestLockedView({
    super.key,
    required this.title,
    required this.message,
    required this.action,
  });

  final String title;
  final String message;

  /// Giriş isteminde geçen işlem adı: "Sipariş vermek", "QR ile ödemek"…
  final String action;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.page),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: AppColors.surfaceTint,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.lock_outline,
                size: 32,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(title, textAlign: TextAlign.center, style: AppTypography.title),
            const SizedBox(height: AppSpacing.sm),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTypography.bodySecondary,
            ),
            const SizedBox(height: AppSpacing.xl),
            FilledButton(
              onPressed: () =>
                  showGuestSignInSheet(context, ref, action: action),
              child: const Text('Giriş yap / Üye ol'),
            ),
          ],
        ),
      ),
    );
  }
}
