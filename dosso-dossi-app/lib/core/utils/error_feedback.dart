import 'package:flutter/material.dart';

import '../network/api_exception.dart';
import '../theme/app_colors.dart';

/// API/ağ hatasını kullanıcıya SnackBar ile gösterir.
/// Para ve giriş akışlarında sessiz başarısızlık kabul edilemez —
/// her await'in catch'inde bu çağrılır.
void showApiError(BuildContext context, Object error) {
  final message = error is ApiException
      ? error.message
      : 'Bir sorun oluştu. Bağlantını kontrol edip tekrar dene.';
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(backgroundColor: AppColors.danger, content: Text(message)),
  );
}
