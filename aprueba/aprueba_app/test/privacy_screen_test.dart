// "Mis datos y privacidad": los datos del alumno y qué pasa al eliminar la cuenta.
import 'package:aprueba_app/core/theme/app_theme.dart';
import 'package:aprueba_app/data/models/models.dart';
import 'package:aprueba_app/features/settings/privacy_screen.dart';
import 'package:aprueba_app/providers/catalog_providers.dart';
import 'package:aprueba_app/providers/data_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

final visited = <String>[];

Future<void> pumpPrivacy(WidgetTester tester, {Locale locale = const Locale('en'), Map<String, dynamic>? user}) async {
  tester.view.physicalSize = const Size(900, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  visited.clear();
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, __) => const PrivacyScreen()),
    GoRoute(path: '/settings', builder: (_, __) { visited.add('/settings'); return const Scaffold(body: Text('ajustes')); }),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [
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
      locale: locale,
      supportedLocales: const [Locale('es'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: AppTheme.light(),
      routerConfig: router,
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('muestra los datos reales del alumno', (tester) async {
    await pumpPrivacy(tester);
    expect(find.text('Your data'), findsOneWidget);
    for (final fila in [
      ['Name', 'Ana Pérez'], ['Email', 'ana@correo.cl'], ['Phone', '+56911112222 (verified)'],
      ['Country', 'Chile'], ['Grade', 'PAES'], ['School', 'Liceo Uno'], ['Age', '17'],
      ['Region', 'Not provided'], ['Language', 'Español'], ['Time zone', 'America/Santiago'], ['Plan', 'Free'],
    ]) {
      final etiqueta = find.text(fila[0]);
      expect(etiqueta, findsOneWidget, reason: fila[0]);
      // El valor está en la misma fila que su etiqueta.
      final row = find.ancestor(of: etiqueta, matching: find.byType(Row)).first;
      expect(find.descendant(of: row, matching: find.text(fila[1])), findsOneWidget, reason: '${fila[0]}: ${fila[1]}');
    }
  });

  testWidgets('un teléfono sin verificar y un plan de pago se muestran como tales', (tester) async {
    await pumpPrivacy(tester, user: {'id': 'u1', 'name': 'Ana', 'email': 'a@b.cl', 'plan': 'all', 'phone': '+56900000000', 'phoneVerified': false});
    expect(find.text('+56900000000 (not verified)'), findsOneWidget);
    expect(find.text('ALL'), findsOneWidget);
  });

  testWidgets('no ofrece descargar ni copiar los datos', (tester) async {
    await pumpPrivacy(tester);
    expect(find.textContaining('Download'), findsNothing);
    expect(find.textContaining('Copy'), findsNothing);
  });

  testWidgets('explica qué pasa al eliminar la cuenta', (tester) async {
    await pumpPrivacy(tester);
    expect(find.text('If you delete your account'), findsOneWidget);
    expect(find.textContaining('Invoices are kept without being linked to you'), findsOneWidget);
  });

  testWidgets('el acceso a eliminar la cuenta lleva a Ajustes', (tester) async {
    await pumpPrivacy(tester);
    await tester.tap(find.text('Go to delete my account'));
    await tester.pumpAndSettle();
    expect(visited, ['/settings']);
  });

  testWidgets('en español usa los textos en español', (tester) async {
    await pumpPrivacy(tester, locale: const Locale('es'));
    expect(find.text('Tus datos'), findsOneWidget);
    expect(find.text('Correo'), findsOneWidget);
  });
}
