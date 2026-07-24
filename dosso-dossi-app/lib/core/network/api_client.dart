import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/token_storage.dart';
import 'api_endpoints.dart';

/// 401 (yenileme de başarısızsa) oturumu kapatmak için auth katmanı
/// buraya kayıt olur (auth_controller ↔ api_client döngüsünü kırar).
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
      dio: dio,
      tokenStorage: ref.watch(tokenStorageProvider),
      onUnauthorized: () => ref.read(onUnauthorizedProvider)?.call(),
    ),
  );
  return dio;
});

/// Her isteğe Bearer token ekler. 401 gelirse refresh token ile sessizce
/// yeniler ve isteği bir kez tekrarlar; yenileme de başarısızsa token'ları
/// silip oturumu kapattırır. QueuedInterceptor eşzamanlı 401'leri
/// serileştirir: ilk istek yeniler, kuyruktakiler yeni token'ı görür.
class _AuthInterceptor extends QueuedInterceptor {
  _AuthInterceptor({
    required this.dio,
    required this.tokenStorage,
    required this.onUnauthorized,
  });

  final Dio dio;
  final TokenStorage tokenStorage;
  final void Function() onUnauthorized;

  static const _retriedFlag = 'x-retried';

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await tokenStorage.readAccess();
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
    final isAuthPath = err.requestOptions.path.startsWith('/auth/');
    final alreadyRetried = err.requestOptions.extra[_retriedFlag] == true;
    if (err.response?.statusCode != 401 || isAuthPath || alreadyRetried) {
      handler.next(err);
      return;
    }

    final refreshed = await _tryRefresh();
    if (!refreshed) {
      await tokenStorage.clear();
      onUnauthorized();
      handler.next(err);
      return;
    }

    // İsteği yeni access token ile bir kez tekrarla
    try {
      final options = err.requestOptions;
      options.extra[_retriedFlag] = true;
      options.headers['Authorization'] =
          'Bearer ${await tokenStorage.readAccess()}';
      final response = await dio.fetch<dynamic>(options);
      handler.resolve(response);
    } on DioException catch (retryErr) {
      handler.next(retryErr);
    }
  }

  Future<bool> _tryRefresh() async {
    final refreshToken = await tokenStorage.readRefresh();
    if (refreshToken == null) return false;
    try {
      // Interceptor'sız çıplak istemci: özyineleme ve provider döngüsü olmaz
      final bare = Dio(BaseOptions(baseUrl: ApiEndpoints.baseUrl));
      final res = await bare.post<Map<String, dynamic>>(
        ApiEndpoints.authRefresh,
        data: {'refreshToken': refreshToken},
      );
      final data = res.data!;
      await tokenStorage.saveTokens(
        access: data['token'] as String,
        refresh: data['refreshToken'] as String,
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}
