/// Oturum açmış kullanıcı.
class AppUser {
  const AppUser({
    required this.phone,
    this.name = '',
    this.email = '',
  });

  /// 10 haneli telefon (başında +90 olmadan): 5XXXXXXXXX
  final String phone;

  /// Boşsa kullanıcı henüz isim adımını tamamlamamıştır.
  final String name;

  final String email;

  AppUser copyWith({String? name, String? email}) => AppUser(
        phone: phone,
        name: name ?? this.name,
        email: email ?? this.email,
      );

  Map<String, dynamic> toJson() => {
        'phone': phone,
        'name': name,
        'email': email,
      };

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        phone: json['phone'] as String,
        name: (json['name'] as String?) ?? '',
        email: (json['email'] as String?) ?? '',
      );
}
