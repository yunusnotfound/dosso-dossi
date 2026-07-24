/// Sipariş kaydı (geçmiş siparişler ve canlı takip ekranında kullanılır).
class OrderRecord {
  const OrderRecord({
    required this.id,
    required this.createdAt,
    required this.branchName,
    required this.pickupLabel,
    required this.itemsLabel,
    required this.total,
    required this.stampsEarned,
    this.status = 'received',
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

  /// received | preparing | ready | completed | cancelled
  final String status;

  bool get isActive => status == 'received' || status == 'preparing';

  OrderRecord copyWith({String? status}) => OrderRecord(
        id: id,
        createdAt: createdAt,
        branchName: branchName,
        pickupLabel: pickupLabel,
        itemsLabel: itemsLabel,
        total: total,
        stampsEarned: stampsEarned,
        status: status ?? this.status,
      );
}
