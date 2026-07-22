import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_config.dart';
import '../../../core/storage/local_storage.dart';
import '../data/notification_prefs_repository.dart';
import '../domain/notification_prefs_model.dart';

export '../domain/notification_prefs_model.dart';

/// Bildirim tercihleri; cihazda önbelleklenir, API modunda sunucuyla
/// senkronlanır. Gerçek push aboneliği Firebase entegrasyonunda bağlanacak.
final notificationPrefsProvider =
    NotifierProvider<NotificationPrefsController, NotificationPrefs>(
        NotificationPrefsController.new);

class NotificationPrefsController extends Notifier<NotificationPrefs> {
  @override
  NotificationPrefs build() {
    final prefs = ref.watch(sharedPreferencesProvider);
    if (!AppConfig.useMocks) {
      Future.microtask(_loadFromApi);
    }
    return NotificationPrefs(
      campaigns: prefs.getBool('notif_campaigns') ?? true,
      orderStatus: prefs.getBool('notif_orders') ?? true,
      sms: prefs.getBool('notif_sms') ?? false,
    );
  }

  Future<void> _loadFromApi() async {
    try {
      final remote =
          await ref.read(notificationPrefsRepositoryProvider).getPrefs();
      _cache(remote);
      state = remote;
    } catch (_) {
      // Ağ hatasında yerel önbellek geçerli kalır.
    }
  }

  void update(NotificationPrefs next) {
    _cache(next);
    state = next;
    if (!AppConfig.useMocks) {
      // Sunucuya arka planda yazılır; hata olursa yerel değer korunur.
      ref
          .read(notificationPrefsRepositoryProvider)
          .savePrefs(next)
          .catchError((_) {});
    }
  }

  void _cache(NotificationPrefs prefs) {
    final store = ref.read(sharedPreferencesProvider);
    store.setBool('notif_campaigns', prefs.campaigns);
    store.setBool('notif_orders', prefs.orderStatus);
    store.setBool('notif_sms', prefs.sms);
  }
}
