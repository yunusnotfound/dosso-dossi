import 'package:flutter/material.dart';

import '../network/api_exception.dart';
import '../theme/app_colors.dart';
import '../diagnostics/app_telemetry.dart';

/// API/ağ hatasını kullanıcıya SnackBar ile gösterir.
/// Para ve giriş akışlarında sessiz başarısızlık kabul edilemez —
/// her await'in catch'inde bu çağrılır.
void showApiError(BuildContext context, Object error) {
  appTelemetry.report(TelemetryOperation.userFeedback, error);
  if (!context.mounted) return;
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  final message = error is ApiException
      ? error.message
      : 'Bir sorun oluştu. Bağlantını kontrol edip tekrar dene.';
  messenger.showSnackBar(
    SnackBar(backgroundColor: AppColors.danger, content: Text(message)),
  );
}
