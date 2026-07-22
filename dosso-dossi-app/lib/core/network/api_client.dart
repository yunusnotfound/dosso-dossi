import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/token_storage.dart';
import 'api_endpoints.dart';

/// 401 geldiğinde oturumu kapatmak için auth katmanı buraya kayıt olur
/// (auth_controller ↔ api_client döngüsünü kırmak için callback deseni).
final onUnauthorizedProvider = Provider<void Function()?>((ref) => null);

final apiClientProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: ApiEndpoints.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
    ),
  );
  dio.interceptors.add(
    _AuthInterceptor(
      tokenStorage: ref.watch(tokenStorageProvider),
      onUnauthorized: () => ref.read(onUnauthorizedProvider)?.call(),
    ),
  );
  return dio;
});

/// Her isteğe Bearer token ekler; 401'de token'ı silip oturumu kapattırır.
class _AuthInterceptor extends QueuedInterceptor {
  _AuthInterceptor({required this.tokenStorage, required this.onUnauthorized});

  final TokenStorage tokenStorage;
  final void Function() onUnauthorized;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await tokenStorage.read();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401) {
      await tokenStorage.clear();
      onUnauthorized();
    }
    handler.next(err);
  }
}
