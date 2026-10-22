// containsSemantics esta marcado como obsoleto desde Flutter 3.40, pero su reemplazo
// (isSemantics) no existe en el piso que declara el proyecto (3.33).
// ignore_for_file: deprecated_member_use

import 'package:aprueba_app/core/theme/app_theme.dart';
import 'package:aprueba_app/core/widgets/common_widgets.dart';
import 'package:aprueba_app/core/widgets/medal_coin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

Widget host(Widget child, {Locale locale = const Locale('en')}) => MaterialApp(
      locale: locale,
      supportedLocales: const [Locale('es'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: AppTheme.light(),
      home: Scaffold(body: Center(child: child)),
    );

void main() {
  testWidgets('la medalla tiene una etiqueta legible, no solo un emoji', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(host(const MedalCoin('bronze')));
    expect(tester.getSemantics(find.byType(MedalCoin)), containsSemantics(label: 'Bronze', isImage: true));
    handle.dispose();
  });

  testWidgets('la etiqueta de la medalla sigue el idioma', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(host(const MedalCoin('gold'), locale: const Locale('es')));
    expect(tester.getSemantics(find.byType(MedalCoin)), containsSemantics(label: 'Oro'));
    handle.dispose();
  });

  testWidgets('SelectChip se anuncia como boton seleccionado y se puede activar', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(host(SelectChip(label: 'Algebra', selected: true, onTap: () {})));
    expect(
      tester.getSemantics(find.byType(SelectChip)),
      containsSemantics(isButton: true, isSelected: true, hasSelectedState: true, hasTapAction: true, label: 'Algebra'),
    );
    handle.dispose();
  });

  testWidgets('SelectChip sin seleccionar no se anuncia como seleccionado', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(host(SelectChip(label: 'Algebra', selected: false, onTap: () {})));
    expect(
      tester.getSemantics(find.byType(SelectChip)),
      containsSemantics(isButton: true, isSelected: false, hasSelectedState: true),
    );
    handle.dispose();
  });
}
