import 'package:dio/dio.dart';

/// Backend'in sözleşme hata biçimi: { "error": { "code", "message" } }
/// DioException'ı yakalayıp kullanıcıya gösterilebilir hale getirir.
class ApiException implements Exception {
  const ApiException({required this.code, required this.message});

  /// docs/API_CONTRACT.md'deki hata kodu: INSUFFICIENT_BALANCE, INVALID_OTP...
  final String code;
  final String message;

  static const String networkCode = 'NETWORK_ERROR';

  bool get isNetworkError => code == networkCode;

  factory ApiException.fromDio(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      final error = data['error'];
      if (error is Map<String, dynamic>) {
        return ApiException(
          code: (error['code'] as String?) ?? 'INTERNAL',
          message: (error['message'] as String?) ?? 'Beklenmeyen bir hata oluştu',
        );
      }
    }
    return const ApiException(
      code: networkCode,
      message: 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.',
    );
  }

  @override
  String toString() => message;
}

/// API çağrısını sarar; DioException'ı ApiException'a çevirir.
Future<T> apiCall<T>(Future<T> Function() run) async {
  try {
    return await run();
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
}
