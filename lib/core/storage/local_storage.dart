import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Cihazda kalıcı veri (oturum vb.) için SharedPreferences erişimi.
/// main() içinde gerçek örnekle override edilir.
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('main() içinde override edilmeli');
});
