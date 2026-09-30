import 'dart:async';

/// Polls a small revision manifest; downloads content only when it changes.
/// A failed refresh is not acknowledged, so the next poll retries it.
class RevisionSync {
  RevisionSync({
    required this.fetchRevisions,
    required this.refreshers,
    this.interval = const Duration(seconds: 3),
  });

  final Future<Map<String, String>> Function() fetchRevisions;
  final Map<String, Future<void> Function()> refreshers;
  final Duration interval;
  final Map<String, String> _applied = {};
  Timer? _timer;
  bool _running = false;
  bool _checking = false;
  bool _disposed = false;
  bool _forcePending = false;

  void start() {
    if (_disposed || _running) return;
    _running = true;
    // Resume also covers non-panel changes made while the app was suspended.
    _forcePending = true;
    unawaited(checkNow());
  }

  void stop() {
    _running = false;
    _timer?.cancel();
  }

  Future<void> checkNow() async {
    if (_disposed || !_running || _checking) return;
    _timer?.cancel();
    _checking = true;
    final force = _forcePending;
    _forcePending = false;
    try {
      final revisions = await fetchRevisions();
      if (!_running || _disposed) return;
      await Future.wait(
        refreshers.entries.map((entry) async {
          final revision = revisions[entry.key];
          if (revision == null || (!force && _applied[entry.key] == revision)) {
            return;
          }
          // Remove even an old identical revision before a forced refresh, so a
          // failed resume refresh remains pending until a successful retry.
          _applied.remove(entry.key);
          try {
            await entry.value();
            if (!_disposed) _applied[entry.key] = revision;
          } catch (_) {
            // Keep cached screen data; retry this domain on the next poll.
          }
        }),
      );
    } catch (_) {
      _forcePending = _forcePending || force;
    } finally {
      _checking = false;
      if (_running && !_disposed) {
        _timer = Timer(interval, checkNow);
      }
    }
  }

  void dispose() {
    stop();
    _disposed = true;
  }
}
