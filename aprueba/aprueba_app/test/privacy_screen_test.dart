// "Mis datos y privacidad": qué se guarda, copiar los datos y qué pasa al eliminar la cuenta.
import 'dart:convert';

import 'package:aprueba_app/core/network/api_exception.dart';
import 'package:aprueba_app/core/theme/app_theme.dart';
import 'package:aprueba_app/data/repositories/profile_repository.dart';
import 'package:aprueba_app/features/settings/privacy_screen.dart';
import 'package:aprueba_app/providers/app_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class FakeProfile implements ProfileRepository {
  FakeProfile({this.fails = false});
  final bool fails;
  int calls = 0;

  @override
  Future<Map<String, dynamic>> exportData() async {
    calls++;
    if (fails) throw ApiException(code: 'INTERNAL', message: 'No se pudo preparar el archivo');
    return {'format': 1, 'profile': {'email': 'ana@correo.cl'}, 'answers': [{'questionId': 'q1'}]};
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

String? copied;
final visited = <String>[];

Future<FakeProfile> pumpPrivacy(WidgetTester tester, {bool fails = false, Locale locale = const Locale('en')}) async {
  tester.view.physicalSize = const Size(900, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  copied = null;
  visited.clear();
  tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
    if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String?;
    return null;
  });
  addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
  final repo = FakeProfile(fails: fails);
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, __) => const PrivacyScreen()),
    GoRoute(path: '/settings', builder: (_, __) { visited.add('/settings'); return const Scaffold(body: Text('ajustes')); }),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [profileRepositoryProvider.overrideWithValue(repo)],
    child: MaterialApp.router(
      locale: locale,
      supportedLocales: const [Locale('es'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: AppTheme.light(),
      routerConfig: router,
    ),
  ));
  await tester.pumpAndSettle();
  return repo;
}

void main() {
  testWidgets('explica qué se guarda y qué pasa al eliminar la cuenta', (tester) async {
    await pumpPrivacy(tester);
    expect(find.text('What we store'), findsOneWidget);
    expect(find.textContaining('Your profile: name, email'), findsOneWidget);
    expect(find.text('If you delete your account'), findsOneWidget);
    expect(find.textContaining('Invoices are kept without being linked to you'), findsOneWidget);
  });

  testWidgets('copiar los datos pide el export y deja el JSON en el portapapeles', (tester) async {
    final repo = await pumpPrivacy(tester);
    await tester.tap(find.text('Copy my data'));
    await tester.pumpAndSettle();
    expect(repo.calls, 1);
    final json = jsonDecode(copied!) as Map<String, dynamic>;
    expect((json['profile'] as Map)['email'], 'ana@correo.cl');
    expect(find.text('Data copied to the clipboard'), findsOneWidget);
  });

  testWidgets('si falla muestra el mensaje y el botón queda disponible', (tester) async {
    await pumpPrivacy(tester, fails: true);
    await tester.tap(find.text('Copy my data'));
    await tester.pumpAndSettle();
    expect(copied, isNull);
    expect(find.text('No se pudo preparar el archivo'), findsOneWidget);
    expect(tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed, isNotNull);
  });

  testWidgets('el acceso a eliminar la cuenta lleva a Ajustes', (tester) async {
    await pumpPrivacy(tester);
    await tester.tap(find.text('Go to delete my account'));
    await tester.pumpAndSettle();
    expect(visited, ['/settings']);
  });

  testWidgets('en español usa los textos en español', (tester) async {
    await pumpPrivacy(tester, locale: const Locale('es'));
    expect(find.text('Qué guardamos'), findsOneWidget);
    expect(find.text('Copiar mis datos'), findsOneWidget);
  });
}
