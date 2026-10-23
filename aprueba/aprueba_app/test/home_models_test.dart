// Modelos de datos que usa Inicio: racha, progreso por prueba (con su meta) y canje de medallas.
import 'package:aprueba_app/data/models/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('User', () {
    test('lee streakStatus y timezone de /me', () {
      final u = User.fromJson({
        'id': 'u1', 'name': 'Ana', 'plan': 'free', 'streak': 4, 'streakStatus': 'at_risk',
        'timezone': 'America/Santiago', 'quota': {'used': 5, 'max': 10}, 'medals': {},
      });
      expect(u.streak, 4);
      expect(u.streakStatus, 'at_risk');
      expect(u.timezone, 'America/Santiago');
    });

    test('sin streakStatus (respuesta antigua o cache) es none', () {
      final u = User.fromJson({'id': 'u1', 'name': 'Ana', 'streak': 0});
      expect(u.streakStatus, 'none');
      expect(u.timezone, isNull);
    });

    test('toJson conserva streakStatus y timezone (se guardan en la cache offline)', () {
      final back = User.fromJson(User.fromJson({
        'id': 'u1', 'name': 'Ana', 'streak': 3, 'streakStatus': 'done_today', 'timezone': 'Europe/London',
      }).toJson());
      expect(back.streakStatus, 'done_today');
      expect(back.timezone, 'Europe/London');
    });
  });

  group('ProgressItem', () {
    test('lee hasData, answered y recent', () {
      final p = ProgressItem.fromJson({'testId': 'm1', 'label': 'Matemática M1', 'percent': 55, 'hasData': true, 'answered': 20, 'recent': 20});
      expect(p.percent, 55);
      expect(p.hasData, isTrue);
      expect(p.answered, 20);
      expect(p.recent, 20);
    });

    test('una respuesta sin hasData (cache anterior) se considera con datos', () {
      final p = ProgressItem.fromJson({'testId': 'm1', 'label': 'M1', 'percent': 55});
      expect(p.hasData, isTrue);
    });

    test('sin datos: hasData false y cuantas respuestas faltan', () {
      final p = ProgressItem.fromJson({'testId': 'cien', 'label': 'Ciencias', 'percent': 0, 'hasData': false, 'answered': 2, 'recent': 2});
      expect(p.hasData, isFalse);
      expect(p.missingForData, 3);
    });
  });

  group('ProgressSummary', () {
    test('une los items con el meta de actividad reciente', () {
      final s = ProgressSummary.fromApi([
        {'testId': 'lectora', 'label': 'Comp. Lectora', 'percent': 70, 'hasData': true, 'answered': 20, 'recent': 20},
        {'testId': 'm1', 'label': 'Matemática M1', 'percent': 55, 'hasData': true, 'answered': 20, 'recent': 20},
      ], {'lastTestId': 'lectora', 'lastAnsweredAt': '2026-10-23T14:02:11.000Z', 'answeredToday': 6, 'answeredThisWeek': 41});
      expect(s.items.length, 2);
      expect(s.lastTestId, 'lectora');
      expect(s.lastItem?.label, 'Comp. Lectora');
      expect(s.answeredToday, 6);
      expect(s.answeredThisWeek, 41);
    });

    test('sin meta (alumno nuevo o respuesta antigua): sin ultima prueba y actividad en 0', () {
      final s = ProgressSummary.fromApi([
        {'testId': 'm1', 'label': 'M1', 'percent': 0, 'hasData': false, 'answered': 0, 'recent': 0},
      ], null);
      expect(s.lastTestId, isNull);
      expect(s.lastItem, isNull);
      expect(s.answeredToday, 0);
      expect(s.answeredThisWeek, 0);
    });

    test('lastTestId que no esta entre los items: lastItem es null pero el id se conserva', () {
      final s = ProgressSummary.fromApi([], {'lastTestId': 'cien'});
      expect(s.lastTestId, 'cien');
      expect(s.lastItem, isNull);
    });

    test('toJson/fromJson para la cache offline', () {
      final s = ProgressSummary.fromApi(
        [{'testId': 'm1', 'label': 'M1', 'percent': 55, 'hasData': true, 'answered': 20, 'recent': 20}],
        {'lastTestId': 'm1', 'answeredToday': 2, 'answeredThisWeek': 9},
      );
      final back = ProgressSummary.fromJson(s.toJson());
      expect(back.items.single.percent, 55);
      expect(back.lastTestId, 'm1');
      expect(back.answeredThisWeek, 9);
    });
  });

  group('MedalWalletState', () {
    test('lee exchangeable y missing del nivel destacado', () {
      final w = MedalWalletState.fromJson({
        'wallet': {'bronze': 15},
        'progress': {'bronze': {'have': 5, 'needed': 5, 'next': 'silver', 'exchangeable': 3, 'missing': 0}},
      });
      final p = w.featured!;
      expect(w.featuredTier, 'bronze');
      expect(p.have, 5);
      expect(p.exchangeable, 3);
      expect(p.missing, 0);
      expect(p.next, 'silver');
    });

    test('respuesta antigua sin exchangeable ni missing: se deducen de have y needed', () {
      final w = MedalWalletState.fromJson({
        'wallet': {'bronze': 2},
        'progress': {'bronze': {'have': 2, 'needed': 5, 'next': 'silver'}},
      });
      expect(w.featured!.exchangeable, 0);
      expect(w.featured!.missing, 3);
    });

    test('sin progress: featured es null', () {
      final w = MedalWalletState.fromJson({'wallet': {}, 'progress': {}});
      expect(w.featured, isNull);
      expect(w.featuredTier, isNull);
    });
  });
}
