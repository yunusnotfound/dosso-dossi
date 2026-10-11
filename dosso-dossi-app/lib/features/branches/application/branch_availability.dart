import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../order/domain/pickup_slots.dart';
import '../domain/branch.dart';

/// The same preparation cutoff as checkout, recalculated at minute boundaries.
/// A stale server snapshot must not leave a store open after closing time.
bool branchAcceptsOrdersAt(Branch branch, DateTime instant) =>
    availablePickupSlots(branch, turkeyWallTime(instant)).isNotEmpty;

final branchClockProvider = NotifierProvider.autoDispose<BranchClock, DateTime>(
  BranchClock.new,
);

class BranchClock extends Notifier<DateTime> {
  Timer? _timer;
  bool _listening = true;
  void _schedule() {
    _timer?.cancel();
    if (!_listening) return;
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    if (lifecycle != null && lifecycle != AppLifecycleState.resumed) return;
    final now = DateTime.now();
    final next = DateTime.fromMillisecondsSinceEpoch(
      (now.millisecondsSinceEpoch ~/ 60000 + 1) * 60000,
    );
    _timer = Timer(next.difference(now), () {
      if (!ref.mounted) return;
      state = DateTime.now();
      _schedule();
    });
  }

  @override
  DateTime build() {
    final lifecycle = AppLifecycleListener(
      onStateChange: (value) {
        if (value == AppLifecycleState.resumed) state = DateTime.now();
        _schedule();
      },
    );
    ref.onDispose(() {
      _timer?.cancel();
      lifecycle.dispose();
    });
    ref.onCancel(() {
      _listening = false;
      _timer?.cancel();
    });
    ref.onResume(() {
      _listening = true;
      _timer?.cancel();
      // A retained tab may resume during a build. Publish its fresh clock after
      // that frame rather than mutating provider state in the widget build.
      _timer = Timer(Duration.zero, () {
        if (!ref.mounted || !_listening) return;
        final now = DateTime.now();
        if (now.millisecondsSinceEpoch ~/ 60000 !=
            state.millisecondsSinceEpoch ~/ 60000) {
          state = now;
        }
        _schedule();
      });
    });
    _schedule();
    return DateTime.now();
  }
}

final branchAcceptingOrdersProvider = Provider.autoDispose.family<bool, Branch>(
  (ref, branch) =>
      branchAcceptsOrdersAt(branch, ref.watch(branchClockProvider)),
);
