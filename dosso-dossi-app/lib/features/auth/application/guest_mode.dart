import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/local_storage.dart';

/// Konuk modu: kullanıcı üye olmadan uygulamayı gezebilir.
///
/// Sipariş, ödeme, damga ve cüzdan gibi hesaba bağlı işlemler kapalıdır;
/// bunlar [guestModeProvider] true iken giriş istemi gösterir.
/// Cihaza kaydedilir, uygulama yeniden açıldığında konuk olarak devam eder.
final guestModeProvider =
    NotifierProvider<GuestModeController, bool>(GuestModeController.new);

class GuestModeController extends Notifier<bool> {
  static const _key = 'auth_guest';

  @override
  bool build() => ref.watch(sharedPreferencesProvider).getBool(_key) ?? false;

  /// Tanıtım ekranındaki "Üye olmadan devam et" adımı.
  Future<void> enter() async {
    await ref.read(sharedPreferencesProvider).setBool(_key, true);
    state = true;
  }

  /// Giriş akışına geçerken veya oturum açılınca konukluk biter.
  Future<void> exit() async {
    await ref.read(sharedPreferencesProvider).remove(_key);
    state = false;
  }
}
