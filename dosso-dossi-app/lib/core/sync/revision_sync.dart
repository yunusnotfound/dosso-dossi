import 'dart:async';

/// Polls a small revision manifest; downloads content only when it changes.
/// A failed refresh is not acknowledged, so the next poll retries it.
class RevisionSync {
  RevisionSync({
    required this.fetchRevisions,
    required this.refreshers,
    this.interval = const Duration(seconds: 15),
    this.maxInterval = const Duration(minutes: 1),
    this.maxBackoff = const Duration(minutes: 5),
    this.onError,
  });

  final Future<Map<String, String>> Function() fetchRevisions;
  final Map<String, Future<void> Function()> refreshers;
  final Duration interval;
  final Duration maxInterval;
  final Duration maxBackoff;
  final void Function(Object error)? onError;
  final Map<String, String> _applied = {};
  Timer? _timer;
  bool _running = false;
  bool _checking = false;
  bool _disposed = false;
  bool _forcePending = false;
  int _unchangedChecks = 0;
  int _failedChecks = 0;

  Duration _boundedDelay(int exponent, Duration maximum) => Duration(
    milliseconds: (interval.inMilliseconds * (1 << exponent.clamp(0, 10)))
        .clamp(interval.inMilliseconds, maximum.inMilliseconds),
  );

  void start() {
    if (_disposed || _running) return;
    _running = true;
    // Resume also covers non-panel changes made while the app was suspended.
    _forcePending = true;
    _unchangedChecks = 0;
    _failedChecks = 0;
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
    var changed = false;
    var failed = false;
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
          changed = true;
          try {
            await entry.value();
            if (!_disposed) _applied[entry.key] = revision;
          } catch (error) {
            failed = true;
            onError?.call(error);
            // Keep cached screen data; retry this domain on the next poll.
          }
        }),
      );
    } catch (error) {
      failed = true;
      onError?.call(error);
      _forcePending = _forcePending || force;
    } finally {
      _checking = false;
      if (failed) {
        _failedChecks++;
        _unchangedChecks = 0;
      } else {
        _failedChecks = 0;
        _unchangedChecks = changed ? 0 : _unchangedChecks + 1;
      }
      if (_running && !_disposed) {
        final delay = _forcePending && !failed
            ? Duration.zero
            : failed
            ? _boundedDelay(_failedChecks, maxBackoff)
            : _boundedDelay(_unchangedChecks, maxInterval);
        _timer = Timer(delay, checkNow);
      }
    }
  }

  void dispose() {
    stop();
    _disposed = true;
  }
}
