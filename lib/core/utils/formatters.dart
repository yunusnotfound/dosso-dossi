import 'package:intl/intl.dart';

final _tl = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 2);

/// 425.5 → "425,50 ₺"
String formatTl(double value) => _tl.format(value).trim();

const _months = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const _weekdays = [
  'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar',
];

/// 2026-07-14 → "14 Temmuz, Salı"
String formatDayHeader(DateTime date) =>
    '${date.day} ${_months[date.month - 1]}, ${_weekdays[date.weekday - 1]}';

/// 2026-06-12 → "12 Haziran"
String formatDayMonth(DateTime date) =>
    '${date.day} ${_months[date.month - 1]}';

/// Saate göre selamlama.
String greetingFor(DateTime now) {
  if (now.hour < 6) return 'İyi geceler';
  if (now.hour < 12) return 'Günaydın';
  if (now.hour < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

/// "Elif Kaya" → "EK"
String initialsOf(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty || parts.first.isEmpty) return '?';
  final first = parts.first[0];
  final last = parts.length > 1 ? parts.last[0] : '';
  return (first + last).toUpperCase();
}
