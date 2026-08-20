import 'package:url_launcher/url_launcher.dart';

import '../domain/branch.dart';

/// Yol tarifini Google Haritalar'da açar (uygulama yüklüyse uygulamada,
/// değilse tarayıcıda).
Future<void> openDirections(Branch branch) {
  final uri = Uri.parse(
    'https://www.google.com/maps/dir/?api=1&destination=${branch.lat},${branch.lng}',
  );
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}
