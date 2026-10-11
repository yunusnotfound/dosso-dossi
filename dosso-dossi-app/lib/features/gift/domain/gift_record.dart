/// Gönderilmiş hediye kaydı.
class GiftRecord {
  const GiftRecord({
    this.id = '',
    required this.phone,
    required this.label,
    required this.amount,
    required this.date,
    this.note = '',
  });

  /// Server identity. Empty only for locally simulated legacy records.
  final String id;

  String get identity => id.isNotEmpty
      ? id
      : '$phone|${date.toIso8601String()}|$amount|$label|$note';

  /// Alıcının telefonu (5XXXXXXXXX)
  final String phone;

  /// "Fındıklı Latte" veya "100 ₺ bakiye"
  final String label;

  final double amount;
  final DateTime date;
  final String note;
}
