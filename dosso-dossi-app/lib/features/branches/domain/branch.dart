class Branch {
  const Branch({
    required this.id,
    required this.name,
    required this.address,
    required this.city,
    this.distanceMeters,
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

  /// Cihaz konumu alınmadıysa mesafe bilinmez.
  final int? distanceMeters;
  final bool isOpen;
  final String phone;

  /// "07:00–23:00"
  final String hours;

  /// Tahmini hazırlık süresi (dk)
  final int prepMinutes;

  /// API tarafından sağlanan şube koordinatları.
  final double lat;
  final double lng;

  Branch withDistance(int? meters) => Branch(
    id: id,
    name: name,
    address: address,
    city: city,
    isOpen: isOpen,
    hours: hours,
    phone: phone,
    prepMinutes: prepMinutes,
    lat: lat,
    lng: lng,
    distanceMeters: meters,
  );

  String get distanceLabel {
    final meters = distanceMeters;
    if (meters == null) return '';
    return meters >= 1000
        ? '${(meters / 1000).toStringAsFixed(1)} km'
        : '$meters m';
  }
}
