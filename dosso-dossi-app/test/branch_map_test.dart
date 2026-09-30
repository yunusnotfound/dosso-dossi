import 'package:dosso_dossi/core/constants/app_config.dart';
import 'package:dosso_dossi/features/branches/application/branch_providers.dart';
import 'package:dosso_dossi/features/branches/domain/branch.dart';
import 'package:dosso_dossi/features/branches/presentation/branch_list_screen.dart';
import 'package:dosso_dossi/features/branches/presentation/branch_map_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'missing map token offers a working branch list instead of empty tiles',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            branchesProvider.overrideWith(
              (ref) async => const [
                Branch(
                  id: 'vatan',
                  name: 'Vatan Caddesi',
                  address: 'Fatih / İstanbul',
                  city: 'İstanbul',
                  distanceMeters: 100,
                  isOpen: true,
                  hours: '08:00–24:00',
                  lat: 41.016863,
                  lng: 28.940617,
                ),
              ],
            ),
          ],
          child: const MaterialApp(home: BranchMapScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(FlutterMap), findsNothing);
      expect(find.text('Harita şu anda kullanılamıyor.'), findsOneWidget);
      await tester.tap(find.text('Şubeleri listele'));
      await tester.pumpAndSettle();

      expect(find.byType(BranchListBody), findsOneWidget);
      expect(find.text('Vatan Caddesi'), findsOneWidget);
      expect(find.text('Fatih / İstanbul'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('Harita'));
      await tester.pumpAndSettle();
      expect(find.text('Şubeleri listele'), findsOneWidget);
      expect(find.byType(FlutterMap), findsNothing);
      expect(tester.takeException(), isNull);
    },
    skip: AppConfig.mapboxToken.trim().isNotEmpty,
  );
}
