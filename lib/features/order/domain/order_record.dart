/// Tamamlanmış sipariş kaydı (geçmiş siparişler ekranında kullanılır).
class OrderRecord {
  const OrderRecord({
    required this.id,
    required this.createdAt,
    required this.branchName,
    required this.pickupLabel,
    required this.itemsLabel,
    required this.total,
    required this.stampsEarned,
  });

  /// "DD-1042" biçiminde sipariş numarası
  final String id;

  final DateTime createdAt;
  final String branchName;
  final String pickupLabel;

  /// "Fındıklı Latte, San Sebastian Cheesecake"
  final String itemsLabel;

  final double total;
  final int stampsEarned;
}
