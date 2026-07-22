import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../domain/notification_prefs_model.dart';

/// Bildirim tercihleri veri kaynağı (yalnızca API modunda kullanılır;
/// mock modunda tercihler SharedPreferences'ta tutulur).
abstract interface class NotificationPrefsRepository {
  Future<NotificationPrefs> getPrefs();
  Future<void> savePrefs(NotificationPrefs prefs);
}

final notificationPrefsRepositoryProvider =
    Provider<NotificationPrefsRepository>((ref) {
  return ApiNotificationPrefsRepository(ref.watch(apiClientProvider));
});

class ApiNotificationPrefsRepository implements NotificationPrefsRepository {
  ApiNotificationPrefsRepository(this._dio);

  final Dio _dio;

  @override
  Future<NotificationPrefs> getPrefs() {
    return apiCall(() async {
      final res = await _dio
          .get<Map<String, dynamic>>(ApiEndpoints.notificationPrefs);
      final data = res.data!;
      return NotificationPrefs(
        campaigns: data['campaigns'] as bool,
        orderStatus: data['orderStatus'] as bool,
        sms: data['sms'] as bool,
      );
    });
  }

  @override
  Future<void> savePrefs(NotificationPrefs prefs) {
    return apiCall(() async {
      await _dio.put<void>(ApiEndpoints.notificationPrefs, data: {
        'campaigns': prefs.campaigns,
        'orderStatus': prefs.orderStatus,
        'sms': prefs.sms,
      });
    });
  }
}
