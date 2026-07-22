class Branch {
  const Branch({
    required this.id,
    required this.name,
    required this.address,
    required this.city,
    required this.distanceMeters,
    required this.isOpen,
    required this.hours,
    this.phone = '',
    this.prepMinutes = 7,
    this.lat = 0,
    this.lng = 0,
  });

  final String id;
  final String name;
  final String address;

  /// Şubeler ekranında il bazlı gruplama için: "İstanbul", "Diyarbakır"
  final String city;

  final int distanceMeters;
  final bool isOpen;
  final String phone;

  /// "07:00–23:00"
  final String hours;

  /// Tahmini hazırlık süresi (dk)
  final int prepMinutes;

  /// Konum (API'den gelir; konum servisi bağlanınca gerçek mesafe
  /// hesabında kullanılacak)
  final double lat;
  final double lng;

  String get distanceLabel => distanceMeters >= 1000
      ? '${(distanceMeters / 1000).toStringAsFixed(1)} km'
      : '$distanceMeters m';
}
