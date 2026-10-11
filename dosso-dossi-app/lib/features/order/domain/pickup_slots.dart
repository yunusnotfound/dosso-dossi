import '../../branches/domain/branch.dart';

/// Türkiye shop wall time, represented with UTC fields to avoid device DST.
/// This value is for display/calculation only; it is not an actual UTC instant.
DateTime turkeyWallTime(DateTime instant) =>
    instant.toUtc().add(const Duration(hours: 3));

class PickupSlot {
  const PickupSlot(this.label, {this.scheduledAt});

  final String label;
  final DateTime? scheduledAt;
}

/// UI suggestions mirror the server's current opening and date-less HH:mm
/// contract. The server remains authoritative when accepting an order.
List<PickupSlot> availablePickupSlots(Branch branch, DateTime shopNow) {
  final now = _wallFields(shopNow);
  final window = _openingWindow(branch, now);
  if (window == null) return const [];
  final earliest = now.add(Duration(minutes: branch.prepMinutes));
  if (!window.contains(earliest)) return const [];
  final next = DateTime.utc(
    earliest.year,
    earliest.month,
    earliest.day,
    earliest.hour,
    (earliest.minute ~/ 15) * 15 + 15,
  );
  return [
    PickupSlot('En kısa (~${branch.prepMinutes} dk)'),
    for (var i = 0; i < 2; i++)
      if (next.add(Duration(minutes: i * 15)) case final time)
        if (window.contains(time) &&
            _resolveLabel(time, now, window, branch.prepMinutes) == time)
          PickupSlot(_format(time), scheduledAt: time),
  ];
}

/// Rechecks a frozen choice at payment time without silently changing it.
bool pickupSlotAvailable(Branch branch, PickupSlot slot, DateTime shopNow) {
  final now = _wallFields(shopNow);
  final window = _openingWindow(branch, now);
  if (window == null) return false;
  final earliest = now.add(Duration(minutes: branch.prepMinutes));
  final pickup = slot.scheduledAt;
  if (pickup == null) return window.contains(earliest);
  return !pickup.isBefore(earliest) &&
      window.contains(pickup) &&
      _resolveLabel(pickup, now, window, branch.prepMinutes) == pickup;
}

DateTime _wallFields(DateTime value) => DateTime.utc(
  value.year,
  value.month,
  value.day,
  value.hour,
  value.minute,
  value.second,
  value.millisecond,
  value.microsecond,
);

String _format(DateTime time) =>
    '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';

class _OpeningWindow {
  const _OpeningWindow(this.closesAt);

  final DateTime? closesAt;

  bool contains(DateTime pickup) =>
      closesAt == null || pickup.isBefore(closesAt!);
}

_OpeningWindow? _openingWindow(Branch branch, DateTime now) {
  if (!branch.isOpen) return null;
  final hours = branch.hours.trim();
  if (RegExp(
    r'^24\s*saat(?:\s+açık)?$',
    caseSensitive: false,
  ).hasMatch(hours)) {
    return const _OpeningWindow(null);
  }
  final match = RegExp(
    r'^(\d{2}:\d{2})\s*[-–—]\s*(\d{2}:\d{2})$',
  ).firstMatch(hours);
  if (match == null) return null;
  final opens = _minuteOfDay(match[1]!);
  final closes = _minuteOfDay(match[2]!, allowMidnightEnd: true);
  if (opens == null || closes == null || opens == closes) return null;
  if (opens == 0 && closes == 1440) return const _OpeningWindow(null);
  final minute = now.hour * 60 + now.minute;
  final overnight = closes < opens;
  final isOpen = overnight
      ? minute >= opens || minute < closes
      : minute >= opens && minute < closes;
  if (!isOpen) return null;
  return _OpeningWindow(
    DateTime.utc(
      now.year,
      now.month,
      now.day + (overnight && minute >= opens ? 1 : 0),
      closes ~/ 60,
      closes % 60,
    ),
  );
}

int? _minuteOfDay(String value, {bool allowMidnightEnd = false}) {
  final parts = value.split(':');
  final hour = int.parse(parts[0]);
  final minute = int.parse(parts[1]);
  if (allowMidnightEnd && hour == 24 && minute == 0) return 1440;
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

DateTime _resolveLabel(
  DateTime slot,
  DateTime now,
  _OpeningWindow window,
  int prepMinutes,
) {
  final today = DateTime.utc(
    now.year,
    now.month,
    now.day,
    slot.hour,
    slot.minute,
  );
  if (!today.isBefore(now)) return today;
  final tomorrow = today.add(const Duration(days: 1));
  if (window.closesAt != null
      ? tomorrow.isBefore(window.closesAt!)
      : tomorrow.difference(now) <= Duration(minutes: prepMinutes + 60)) {
    return tomorrow;
  }
  return today;
}
