// La sesión de práctica recuerda la prueba elegida: "Continuar" retoma la última usada y
// "Siguiente" no la pierde.
import 'package:aprueba_app/data/models/models.dart';
import 'package:aprueba_app/data/repositories/practice_repository.dart';
import 'package:aprueba_app/providers/app_providers.dart';
import 'package:aprueba_app/providers/practice_session.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakePractice implements PracticeRepository {
  final pedidas = <String?>[];

  @override
  Future<({Question question, int quotaUsed, int quotaMax})> next({String? testId}) async {
    pedidas.add(testId);
    final q = Question(id: 'q${pedidas.length}', testId: testId ?? 'lectora', statement: 'x', options: const []);
    return (question: q, quotaUsed: 1, quotaMax: 10);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late _FakePractice repo;
  late ProviderContainer c;

  setUp(() {
    repo = _FakePractice();
    c = ProviderContainer(overrides: [practiceRepositoryProvider.overrideWithValue(repo)]);
    addTearDown(c.dispose);
  });

  test('start con prueba la pide al servidor y la conserva en el estado', () async {
    await c.read(practiceSessionProvider.notifier).start(testId: 'm1');
    expect(repo.pedidas, ['m1']);
    expect(c.read(practiceSessionProvider).testId, 'm1');
  });

  test('loadNext sigue en la misma prueba', () async {
    final n = c.read(practiceSessionProvider.notifier);
    await n.start(testId: 'm1');
    await n.loadNext();
    expect(repo.pedidas, ['m1', 'm1']);
    expect(c.read(practiceSessionProvider).testId, 'm1');
  });

  test('start sin prueba limpia el filtro anterior', () async {
    final n = c.read(practiceSessionProvider.notifier);
    await n.start(testId: 'm1');
    await n.start();
    expect(repo.pedidas, ['m1', null]);
    expect(c.read(practiceSessionProvider).testId, isNull);
  });
}
