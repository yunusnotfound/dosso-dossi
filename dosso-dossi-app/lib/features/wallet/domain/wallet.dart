/// Dosso Kart (uygulama içi bakiye kartı).
class Wallet {
  const Wallet({required this.balance, required this.cardLast4});

  final double balance;

  /// Kart numarasının son 4 hanesi (görsel amaçlı)
  final String cardLast4;
}
