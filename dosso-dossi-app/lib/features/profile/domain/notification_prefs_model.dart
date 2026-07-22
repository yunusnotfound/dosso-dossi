/// Bildirim tercihleri.
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
