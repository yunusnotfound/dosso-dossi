import 'dart:async';

import 'package:dosso_dossi/core/sync/revision_sync.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('refreshes changed domains, pauses and catches up on resume', (
    tester,
  ) async {
    var menuRevision = 'one';
    var requests = 0;
    var menus = 0;
    var branches = 0;
    final sync = RevisionSync(
      fetchRevisions: () async {
        requests++;
        return {'menu': menuRevision, 'branches': 'one'};
      },
      refreshers: {
        'menu': () async {
          menus++;
        },
        'branches': () async {
          branches++;
        },
      },
    );
    sync.start();
    await tester.pump();
    expect([menus, branches], [1, 1]);
    await tester.pump(const Duration(seconds: 3));
    expect(requests, 2);
    expect([menus, branches], [1, 1]);
    menuRevision = 'two';
    await tester.pump(const Duration(seconds: 3));
    expect([menus, branches], [2, 1]);
    sync.stop();
    await tester.pump(const Duration(seconds: 30));
    expect(requests, 3);
    sync.start();
    await tester.pump();
    expect([menus, branches], [3, 2]);
    sync.dispose();
    await tester.pump(const Duration(seconds: 30));
    expect(requests, 4);
  });

  testWidgets('retries failed content refresh without losing its revision', (
    tester,
  ) async {
    var attempts = 0;
    var successes = 0;
    var stable = 0;
    final sync = RevisionSync(
      fetchRevisions: () async => {'menu': 'changed', 'branches': 'same'},
      refreshers: {
        'menu': () async {
          attempts++;
          if (attempts == 1) throw StateError('offline');
          successes++;
        },
        'branches': () async {
          stable++;
        },
      },
    );
    sync.start();
    await tester.pump();
    expect(successes, 0);
    await tester.pump(const Duration(seconds: 3));
    expect([attempts, successes, stable], [2, 1, 1]);
    await tester.pump(const Duration(seconds: 3));
    expect(attempts, 2);
    sync.dispose();
  });

  testWidgets('manifest outages retry at the interval without a busy loop', (
    tester,
  ) async {
    var requests = 0;
    var applied = 0;
    final sync = RevisionSync(
      fetchRevisions: () async {
        requests++;
        if (requests <= 2) throw StateError('offline');
        return {'menu': 'one'};
      },
      refreshers: {
        'menu': () async {
          applied++;
        },
      },
    );
    sync.start();
    await tester.pump();
    expect(requests, 1);
    await tester.pump(const Duration(seconds: 2));
    expect(requests, 1);
    await tester.pump(const Duration(seconds: 1));
    expect(requests, 2);
    await tester.pump(const Duration(seconds: 3));
    expect(applied, 1);
    sync.dispose();
  });

  testWidgets('never overlaps requests or applies results after disposal', (
    tester,
  ) async {
    final response = Completer<Map<String, String>>();
    var requests = 0;
    var applied = 0;
    final sync = RevisionSync(
      fetchRevisions: () {
        requests++;
        return response.future;
      },
      refreshers: {
        'menu': () async {
          applied++;
        },
      },
    );
    sync.start();
    sync.start();
    await sync.checkNow();
    await tester.pump(const Duration(seconds: 15));
    expect(requests, 1);
    sync.dispose();
    response.complete({'menu': 'one'});
    await tester.pump();
    expect(applied, 0);
  });
}
