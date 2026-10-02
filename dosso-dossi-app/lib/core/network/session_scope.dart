import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Advances whenever the account changes; async work must retain its epoch.
final sessionScopeProvider = Provider<SessionScope>((ref) => SessionScope());

class SessionScope {
  int revision = 0;
  void advance() => revision++;
}
