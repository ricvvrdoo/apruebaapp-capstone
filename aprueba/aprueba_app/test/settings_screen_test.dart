// containsSemantics esta marcado como obsoleto desde Flutter 3.40, pero su reemplazo
// (isSemantics) no existe en el piso que declara el proyecto (3.33).
// ignore_for_file: deprecated_member_use

// Ajustes: "Mis datos y privacidad" se abre y se cierra en la misma vista y muestra los datos reales.
import 'package:aprueba_app/core/l10n/locale_controller.dart';
import 'package:aprueba_app/core/theme/app_theme.dart';
import 'package:aprueba_app/core/theme/theme_controller.dart';
import 'package:aprueba_app/core/widgets/common_widgets.dart';
import 'package:aprueba_app/data/models/models.dart';
import 'package:aprueba_app/features/settings/settings_screen.dart';
import 'package:aprueba_app/providers/catalog_providers.dart';
import 'package:aprueba_app/providers/data_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class FakeTheme extends ThemeController {
  @override
  ThemeMode build() => ThemeMode.light;
}

class FakeLocale extends LocaleController {
  FakeLocale(this.code);
  final String code;
  @override
  Locale build() => Locale(code);
}

final visited = <String>[];

Future<void> pumpSettings(WidgetTester tester, {String lang = 'en', Map<String, dynamic>? user}) async {
  tester.view.physicalSize = const Size(900, 2600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  visited.clear();
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, __) => const SettingsScreen()),
    GoRoute(path: '/privacy', builder: (_, __) { visited.add('/privacy'); return const Scaffold(); }),
    GoRoute(path: '/manage-plan', builder: (_, __) { visited.add('/manage-plan'); return const Scaffold(); }),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      themeControllerProvider.overrideWith(FakeTheme.new),
      localeControllerProvider.overrideWith(() => FakeLocale(lang)),
      meProvider.overrideWith((ref) async => User.fromJson(user ?? {
            'id': 'u1', 'name': 'Ana Pérez', 'email': 'ana@correo.cl', 'plan': 'free', 'phone': '+56911112222',
            'phoneVerified': true, 'country': 'CL', 'gradeId': 'cl-paes', 'school': 'Liceo Uno', 'age': 17,
            'language': 'es', 'timezone': 'America/Santiago',
          })),
      countriesProvider.overrideWith((ref) async => [const Country(code: 'CL', name: 'Chile', dialCode: '+56')]),
      gradesProvider.overrideWith((ref, code) async => [
            const GradeGroup(key: 'exam', label: 'Exámenes', items: [GradeOption(id: 'cl-paes', label: 'PAES', kind: 'exam')]),
          ]),
    ],
    child: MaterialApp.router(
      locale: Locale(lang),
      supportedLocales: const [Locale('es'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: AppTheme.light(),
      routerConfig: router,
    ),
  ));
  await tester.pumpAndSettle();
}

Future<void> toggle(WidgetTester tester, String title) async {
  await tester.tap(find.text(title));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('cerrada no muestra los datos', (tester) async {
    await pumpSettings(tester);
    expect(find.text('My data & privacy'), findsOneWidget);
    expect(find.text('Dark mode'), findsOneWidget, reason: 'Ajustes arranca abierta');
    expect(find.text('Ana Pérez'), findsNothing);
    expect(find.text('If you delete your account'), findsNothing);
  });

  testWidgets('al tocarla se abre en la misma vista con los datos reales y al volver a tocarla se cierra', (tester) async {
    await pumpSettings(tester);
    await toggle(tester, 'My data & privacy');
    expect(visited, isEmpty, reason: 'no navega a otra pantalla');
    expect(find.text('Dark mode'), findsOneWidget, reason: 'sigue en Ajustes');
    for (final fila in [
      ['Name', 'Ana Pérez'], ['Email', 'ana@correo.cl'], ['Phone', '+56911112222 (verified)'],
      ['Country', 'Chile'], ['Grade', 'PAES'], ['School', 'Liceo Uno'], ['Age', '17'],
      ['Region', 'Not provided'], ['Language', 'Español'], ['Time zone', 'America/Santiago'], ['Plan', 'Free'],
    ]) {
      final etiqueta = find.descendant(of: find.byType(ExpandableCard).last, matching: find.text(fila[0]));
      expect(etiqueta, findsOneWidget, reason: fila[0]);
      // El valor está en la misma fila que su etiqueta.
      final row = find.ancestor(of: etiqueta, matching: find.byType(Row)).first;
      expect(find.descendant(of: row, matching: find.text(fila[1])), findsOneWidget, reason: '${fila[0]}: ${fila[1]}');
    }
    expect(find.text('If you delete your account'), findsOneWidget);
    expect(find.textContaining('Invoices are kept without being linked to you'), findsOneWidget);
    expect(find.textContaining('Download'), findsNothing);

    await toggle(tester, 'My data & privacy');
    expect(find.text('Ana Pérez'), findsNothing);
    expect(find.text('If you delete your account'), findsNothing);
  });

  testWidgets('un teléfono sin verificar y un plan de pago se muestran como tales', (tester) async {
    await pumpSettings(tester, user: {'id': 'u1', 'name': 'Ana', 'email': 'a@b.cl', 'plan': 'all', 'phone': '+56900000000', 'phoneVerified': false});
    await toggle(tester, 'My data & privacy');
    expect(find.text('+56900000000 (not verified)'), findsOneWidget);
    expect(find.text('ALL'), findsWidgets);
  });

  testWidgets('el encabezado se anuncia como botón desplegable', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpSettings(tester);
    final header = find.bySemanticsLabel(RegExp('My data'));
    expect(tester.getSemantics(header), containsSemantics(isButton: true, hasExpandedState: true, isExpanded: false, hasTapAction: true));
    await toggle(tester, 'My data & privacy');
    expect(tester.getSemantics(header), containsSemantics(isButton: true, hasExpandedState: true, isExpanded: true));
    handle.dispose();
  });

  testWidgets('Ajustes se cierra y se vuelve a abrir en la misma vista', (tester) async {
    await pumpSettings(tester);
    final header = find.descendant(of: find.byType(ExpandableCard).first, matching: find.text('Settings'));
    await tester.tap(header);
    await tester.pumpAndSettle();
    expect(find.text('Dark mode'), findsNothing);
    expect(find.text('My plan'), findsNothing);
    expect(visited, isEmpty);
    await tester.tap(header);
    await tester.pumpAndSettle();
    expect(find.text('Dark mode'), findsOneWidget);
    expect(find.text('Language'), findsOneWidget);
  });

  testWidgets('Mi plan sigue llevando a su pantalla', (tester) async {
    await pumpSettings(tester);
    await tester.tap(find.text('My plan'));
    await tester.pumpAndSettle();
    expect(visited, ['/manage-plan']);
  });

  testWidgets('en español usa los textos en español', (tester) async {
    await pumpSettings(tester, lang: 'es');
    await toggle(tester, 'Mis datos y privacidad');
    expect(find.text('Correo'), findsOneWidget);
    expect(find.text('Si eliminas tu cuenta'), findsOneWidget);
  });
}
