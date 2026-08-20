import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dosso_dossi/core/theme/app_theme.dart';
import 'package:dosso_dossi/routing/main_shell.dart';

/// Alt menüde dokunma dalgası/gölgesi istenmiyor. Bu test, ileride biri
/// sekmeleri InkWell/InkResponse'a çevirirse (ör. "tıklanabilir görünsün"
/// diye) kırılır ve kararı hatırlatır.
void main() {
  testWidgets('alt menüde ink (dokunma dalgası) üreten widget yok',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          bottomNavigationBar: PillNavBar(currentIndex: 0, onSelected: (_) {}),
        ),
      ),
    );

    expect(find.byType(InkWell), findsNothing);
    expect(find.byType(InkResponse), findsNothing);

    // Sekmeye basıldığında da hiçbir ink özelliği doğmamalı.
    await tester.tap(find.text('Sipariş'));
    await tester.pump(); // basılı an
    await tester.pump(const Duration(milliseconds: 80));

    expect(find.byType(InkWell), findsNothing);
    expect(find.byType(InkResponse), findsNothing);

    final material = tester.widget<Material>(
      find.descendant(
        of: find.byType(PillNavBar),
        matching: find.byType(Material),
      ),
    );
    // Yükseltilmiş Material kendi gölgesini çizer; hap zemini düz olmalı.
    expect(material.elevation, 0);
  });

  testWidgets('sekme dokunuşu seçimi bildirir', (tester) async {
    var tapped = -1;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          bottomNavigationBar: PillNavBar(currentIndex: 0, onSelected: (i) => tapped = i),
        ),
      ),
    );

    // Etiketle ikon arasındaki boşluğa basmak da sekmeyi seçmeli
    // (HitTestBehavior.opaque olmadan burası ölü alan olurdu).
    await tester.tap(find.text('Online Mağaza'));
    await tester.pump();
    expect(tapped, 3);
  });
}
