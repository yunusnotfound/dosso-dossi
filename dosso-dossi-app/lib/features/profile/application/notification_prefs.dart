import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/runtime_mode.dart';
import '../../../core/network/session_scope.dart';
import '../../../core/storage/local_storage.dart';
import '../data/notification_prefs_repository.dart';
import '../domain/notification_prefs_model.dart';

export '../domain/notification_prefs_model.dart';

/// Bildirim tercihleri; cihazda önbelleklenir, API modunda sunucuyla
/// senkronlanır. Gerçek push aboneliği Firebase entegrasyonunda bağlanacak.
final notificationPrefsProvider =
    NotifierProvider<NotificationPrefsController, NotificationPrefs>(
      NotificationPrefsController.new,
    );

class NotificationPrefsController extends Notifier<NotificationPrefs> {
  int _version = 0;
  Future<void> _writes = Future.value();
  NotificationPrefs? _confirmed;
  @override
  NotificationPrefs build() {
    _version++;
    _writes = Future.value();
    _confirmed = null;
    final prefs = ref.watch(sharedPreferencesProvider);
    if (ref.read(apiModeProvider)) {
      Future.microtask(_loadFromApi);
    }
    return NotificationPrefs(
      campaigns: prefs.getBool('notif_campaigns') ?? true,
      orderStatus: prefs.getBool('notif_orders') ?? true,
      sms: prefs.getBool('notif_sms') ?? false,
    );
  }

  Future<void> _loadFromApi() async {
    if (!ref.mounted) return;
    final version = _version;
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    try {
      final remote = await ref
          .read(notificationPrefsRepositoryProvider)
          .getPrefs();
      if (!ref.mounted || epoch != scope.revision || version != _version) {
        return;
      }
      _confirmed = remote;
      _cache(remote);
      state = remote;
    } catch (_) {
      /* Keep the last local choice; never overwrite a newer edit. */
    }
  }

  void update(NotificationPrefs next) {
    final version = ++_version;
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    _confirmed ??= state;
    _cache(next);
    state = next;
    if (!ref.read(apiModeProvider)) {
      _confirmed = next;
      return;
    }
    final repository = ref.read(notificationPrefsRepositoryProvider);
    _writes = _writes.then((_) async {
      if (!ref.mounted || epoch != scope.revision) return;
      try {
        await repository.savePrefs(next);
        if (!ref.mounted || epoch != scope.revision) return;
        _confirmed = next;
        if (version == _version) {
          ref.read(notificationSaveErrorProvider.notifier).set(null);
        }
      } catch (error) {
        if (!ref.mounted || epoch != scope.revision || version != _version) {
          return;
        }
        state = _confirmed!;
        _cache(state);
        ref.read(notificationSaveErrorProvider.notifier).set(error);
      }
    });
  }

  void _cache(NotificationPrefs prefs) {
    final store = ref.read(sharedPreferencesProvider);
    store.setBool('notif_campaigns', prefs.campaigns);
    store.setBool('notif_orders', prefs.orderStatus);
    store.setBool('notif_sms', prefs.sms);
  }
}

final notificationSaveErrorProvider =
    NotifierProvider<NotificationSaveErrorController, Object?>(
      NotificationSaveErrorController.new,
    );

class NotificationSaveErrorController extends Notifier<Object?> {
  @override
  Object? build() => null;
  void set(Object? value) => state = value;
}
