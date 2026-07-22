/// REST API adresleri. Backend hazır olduğunda baseUrl'i güncelle;
/// endpoint listesi docs/API_CONTRACT.md ile birebir aynı tutulur.
abstract final class ApiEndpoints {
  /// TODO: API hazır olduğunda gerçek adresle değiştir.
  static const String baseUrl = 'https://api.dossodossi.example.com/v1';

  // Faz ilerledikçe endpoint sabitleri buraya eklenecek:
  // static const String login = '/auth/login';
  // static const String menu = '/menu';
}
