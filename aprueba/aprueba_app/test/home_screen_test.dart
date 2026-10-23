// Pantalla de Inicio: una acción principal que retoma la última prueba, racha y cuota con su
// estado, medallas con canjes, progreso con "sin datos" y errores por tarjeta.
import 'package:aprueba_app/core/theme/app_theme.dart';
import 'package:aprueba_app/data/models/models.dart';
import 'package:aprueba_app/data/repositories/practice_repository.dart';
import 'package:aprueba_app/features/home/home_screen.dart';
import 'package:aprueba_app/providers/app_providers.dart';
import 'package:aprueba_app/providers/data_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class _FakePractice implements PracticeRepository {
  final pedidas = <String?>[];

  @override
  Future<({Question question, int quotaUsed, int quotaMax})> next({String? testId}) async {
    pedidas.add(testId);
    return (
      question: Question(id: 'q1', testId: testId ?? 'lectora', statement: 'x', options: const []),
      quotaUsed: 1,
      quotaMax: 10,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

User user({String plan = 'free', int streak = 0, String status = 'none', Map<String, dynamic> medals = const {}}) =>
    User.fromJson({
      'id': 'u1', 'name': 'Ana', 'plan': plan, 'streak': streak, 'streakStatus': status,
      'quota': {'used': 4, 'max': 10}, 'medals': medals,
    });

QuotaState quota({int used = 4, int max = 10, bool unlimited = false, bool school = false, bool address = false}) =>
    QuotaState(
      used: used, max: max, unlimited: unlimited, schoolBonus: school, addressBonus: address,
      resetsAt: DateTime.now().add(const Duration(hours: 3, minutes: 30)),
    );

ProgressSummary summary({String? last = 'm1', int today = 0, int week = 0, List<ProgressItem>? items}) =>
    ProgressSummary(
      items: items ?? [ProgressItem('lectora', 'Comp. Lectora', 70, answered: 20, recent: 20), ProgressItem('m1', 'Matemática M1', 55, answered: 20, recent: 20)],
      lastTestId: last, answeredToday: today, answeredThisWeek: week,
    );

MedalWalletState wallet({int have = 2, int exchangeable = 0, int missing = 3}) => MedalWalletState(
      wallet: Medals(bronze: have),
      progress: {'bronze': (have: have, needed: 5, next: 'silver', exchangeable: exchangeable, missing: missing)},
    );

late _FakePractice _practice;
final visited = <String>[];

Future<void> pumpHome(
  WidgetTester tester, {
  User? me,
  AsyncValue<QuotaState>? q,
  AsyncValue<ProgressSummary>? progress,
  MedalWalletState? medals,
  List<Plan>? plans,
}) async {
  tester.view.physicalSize = const Size(900, 3200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  _practice = _FakePractice();
  visited.clear();
  AsyncValue<T> orError<T>(AsyncValue<T>? v, T ok) => v ?? AsyncData(ok);
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
    for (final p in ['/practice/question', '/paywall', '/medals', '/medals/exchange'])
      GoRoute(path: p, builder: (_, __) { visited.add(p); return Scaffold(body: Text('ruta $p')); }),
  ]);
  final qv = orError(q, quota());
  final pv = orError(progress, summary());
  await tester.pumpWidget(ProviderScope(
    overrides: [
      practiceRepositoryProvider.overrideWithValue(_practice),
      meProvider.overrideWith((ref) async => me ?? user()),
      quotaProvider.overrideWith((ref) async => qv.requireValue),
      progressSummaryProvider.overrideWith((ref) async {
        if (pv.hasError) throw Exception('sin red');
        return pv.requireValue;
      }),
      medalWalletProvider.overrideWith((ref) async => medals ?? wallet()),
      plansProvider.overrideWith((ref) async => plans ?? [Plan(id: 'one', name: 'Una prueba', priceMonthly: 1), Plan(id: 'all', name: 'Todas', priceMonthly: 3)]),
    ],
    child: MaterialApp.router(
      locale: const Locale('en'),
      supportedLocales: const [Locale('es'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: AppTheme.light(),
      routerConfig: router,
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('con historial el botón principal retoma la última prueba', (tester) async {
    await pumpHome(tester, progress: AsyncData(summary(last: 'm1')));
    expect(find.text('Continue with Matemática M1'), findsOneWidget);
    expect(find.textContaining('6 questions left today'), findsOneWidget);
    await tester.tap(find.text('Continue with Matemática M1'));
    await tester.pumpAndSettle();
    expect(_practice.pedidas, ['m1']);
    expect(visited, ['/practice/question']);
  });

  testWidgets('sin historial invita a empezar y no fija la prueba', (tester) async {
    await pumpHome(tester, progress: AsyncData(summary(last: null)));
    expect(find.text('Answer your first question to see your progress and start your streak.'), findsOneWidget);
    await tester.tap(find.text('Start practicing'));
    await tester.pumpAndSettle();
    expect(_practice.pedidas, [null]);
  });

  testWidgets('sin cupo avisa y el botón sigue mostrando la prueba', (tester) async {
    await pumpHome(tester, q: AsyncData(quota(used: 10)), progress: AsyncData(summary(last: 'm1')));
    expect(find.text("You reached today's limit: unlock more or come back tomorrow."), findsOneWidget);
    expect(find.text('Continue with Matemática M1'), findsOneWidget);
  });

  testWidgets('la racha en riesgo avisa cuántos días se pierden', (tester) async {
    await pumpHome(tester, me: user(streak: 4, status: 'at_risk'));
    expect(find.text('Practice today to keep your 4-day streak.'), findsOneWidget);
  });

  testWidgets('racha cumplida avisa que vuelva mañana', (tester) async {
    await pumpHome(tester, me: user(streak: 2, status: 'done_today'));
    expect(find.text('You practiced today! Come back tomorrow to keep it going.'), findsOneWidget);
  });

  testWidgets('sin racha invita a empezarla', (tester) async {
    await pumpHome(tester, me: user(status: 'none'));
    expect(find.text('Answer a question today to start your streak.'), findsOneWidget);
  });

  testWidgets('la cuota dice cuántas quedan, cuándo se reinicia y qué bonos faltan', (tester) async {
    await pumpHome(tester);
    expect(find.textContaining('6 left today'), findsOneWidget);
    expect(find.textContaining('resets in 3 h'), findsOneWidget);
    expect(find.text('Declare your school or address to earn up to +10 questions.'), findsOneWidget);
  });

  testWidgets('con los dos bonos reclamados lo dice', (tester) async {
    await pumpHome(tester, q: AsyncData(quota(school: true, address: true, max: 20)));
    expect(find.text('Bonuses claimed: school and address (+10).'), findsOneWidget);
  });

  testWidgets('el progreso muestra "sin datos" cuando hay pocas respuestas', (tester) async {
    await pumpHome(tester, progress: AsyncData(summary(items: [
      ProgressItem('m1', 'Matemática M1', 55, answered: 20, recent: 20),
      ProgressItem('cien', 'Ciencias', 0, hasData: false, answered: 2, recent: 2),
    ])));
    expect(find.text('55%'), findsOneWidget);
    expect(find.text('No data yet'), findsOneWidget);
    expect(find.text('Answer 3 more questions to see your progress.'), findsOneWidget);
  });

  testWidgets('con canjes disponibles el botón lleva a canjear', (tester) async {
    await pumpHome(tester, medals: wallet(have: 5, exchangeable: 3, missing: 0));
    expect(find.text('You can make 3 exchanges: 5 bronze medals for 1 silver each.'), findsOneWidget);
    await tester.tap(find.text('Go to exchange'));
    await tester.pumpAndSettle();
    expect(visited, ['/medals/exchange']);
  });

  testWidgets('sin canjes dice cuántas medallas faltan', (tester) async {
    await pumpHome(tester, medals: wallet(have: 2, exchangeable: 0, missing: 3));
    expect(find.text('You need 3 more bronze medals to exchange for 1 silver.'), findsOneWidget);
    expect(find.text('Go to exchange'), findsNothing);
  });

  testWidgets('el plan gratis ve el banner con el precio mínimo en dólares', (tester) async {
    await pumpHome(tester);
    expect(find.text('Practice with no daily cap from US\$1/mo.'), findsOneWidget);
  });

  testWidgets('el plan de pago ve su actividad y no la cuota ni el banner', (tester) async {
    await pumpHome(tester,
        me: user(plan: 'all'),
        q: AsyncData(quota(unlimited: true, max: 999999)),
        progress: AsyncData(summary(today: 6, week: 41)));
    expect(find.text('Your activity'), findsOneWidget);
    expect(find.text('6'), findsOneWidget);
    expect(find.text('41'), findsOneWidget);
    expect(find.textContaining('left today'), findsNothing);
    expect(find.textContaining('Practice with no daily cap'), findsNothing);
  });

  testWidgets('si falla el progreso solo esa tarjeta muestra el error y el resto sigue', (tester) async {
    await pumpHome(tester, progress: AsyncError(Exception('x'), StackTrace.empty));
    expect(find.text('Retry'), findsWidgets);
    expect(find.text('Something went wrong. Try again.'), findsWidgets);
    // El botón principal sigue disponible sin conocer la última prueba.
    expect(find.text('Keep practicing'), findsOneWidget);
    expect(find.textContaining('6 left today'), findsOneWidget);
  });
}
