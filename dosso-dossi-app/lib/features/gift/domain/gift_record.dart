/// Gönderilmiş hediye kaydı.
class GiftRecord {
  const GiftRecord({
    required this.phone,
    required this.label,
    required this.amount,
    required this.date,
    this.note = '',
  });

  /// Alıcının telefonu (5XXXXXXXXX)
  final String phone;

  /// "Fındıklı Latte" veya "100 ₺ bakiye"
  final String label;

  final double amount;
  final DateTime date;
  final String note;
}
