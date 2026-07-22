import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_endpoints.dart';

/// Gerçek REST API hazır olduğunda kullanılacak HTTP istemcisi.
/// Şu an tüm repository'ler mock veriyle çalışır; API'ye geçiş
/// her feature'ın repository provider'ında tek satır değişikliğidir.
final apiClientProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: ApiEndpoints.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
    ),
  );
});
