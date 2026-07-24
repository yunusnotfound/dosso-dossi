import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../domain/app_user.dart';
import 'auth_repository.dart';

class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository(this._dio);

  final Dio _dio;

  @override
  Future<void> sendOtp(String phone) {
    return apiCall(() async {
      await _dio.post<void>(ApiEndpoints.otpSend, data: {'phone': phone});
    });
  }

  @override
  Future<AuthResult> verifyOtp({required String phone, required String code}) {
    return apiCall(() async {
      final res = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.otpVerify,
        data: {'phone': phone, 'code': code},
      );
      final data = res.data!;
      return AuthResult(
        token: data['token'] as String,
        refreshToken: (data['refreshToken'] as String?) ?? '',
        user: AppUser.fromJson(data['user'] as Map<String, dynamic>),
      );
    });
  }

  @override
  Future<void> logout(String refreshToken) {
    return apiCall(() async {
      await _dio.post<void>(ApiEndpoints.authLogout, data: {
        if (refreshToken.isNotEmpty) 'refreshToken': refreshToken,
      });
    });
  }

  @override
  Future<void> updateProfile({String? name, String? email}) {
    return apiCall(() async {
      await _dio.patch<void>(ApiEndpoints.me, data: {
        'name': ?name,
        'email': ?email,
      });
    });
  }
}
