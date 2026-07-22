import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/local_storage.dart';

/// Bildirim tercihleri; cihaza kaydedilir.
/// Gerçek push aboneliği API/Firebase entegrasyonunda bağlanacak.
class NotificationPrefs {
  const NotificationPrefs({
    this.campaigns = true,
    this.orderStatus = true,
    this.sms = false,
  });

  final bool campaigns;
  final bool orderStatus;
  final bool sms;

  NotificationPrefs copyWith({bool? campaigns, bool? orderStatus, bool? sms}) =>
      NotificationPrefs(
        campaigns: campaigns ?? this.campaigns,
        orderStatus: orderStatus ?? this.orderStatus,
        sms: sms ?? this.sms,
      );
}

final notificationPrefsProvider =
    NotifierProvider<NotificationPrefsController, NotificationPrefs>(
        NotificationPrefsController.new);

class NotificationPrefsController extends Notifier<NotificationPrefs> {
  @override
  NotificationPrefs build() {
    final prefs = ref.watch(sharedPreferencesProvider);
    return NotificationPrefs(
      campaigns: prefs.getBool('notif_campaigns') ?? true,
      orderStatus: prefs.getBool('notif_orders') ?? true,
      sms: prefs.getBool('notif_sms') ?? false,
    );
  }

  void update(NotificationPrefs next) {
    final prefs = ref.read(sharedPreferencesProvider);
    prefs.setBool('notif_campaigns', next.campaigns);
    prefs.setBool('notif_orders', next.orderStatus);
    prefs.setBool('notif_sms', next.sms);
    state = next;
  }
}
