// La API agrega campos a las respuestas que usa Inicio (la web los lee; la app no). Estas pruebas
// usan respuestas reales (usuario camila@correo.cl del seed) para comprobar que los modelos de la
// app siguen leyendo lo que ya leian e ignoran lo nuevo sin fallar.
import 'package:aprueba_app/data/models/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('User.fromJson lee el perfil aunque /me agregue streakStatus y timezone', () {
    final u = User.fromJson({
      'id': 'usr_camila',
      'name': 'Camila Rojas',
      'email': 'camila@correo.cl',
      'plan': 'all',
      'streak': 7,
      'streakStatus': 'done_today',
      'quota': {'used': 0, 'max': 999999},
      'medals': {'bronze': 31, 'silver': 6, 'gold': 2, 'diamond': 0, 'platinum': 1},
      'timezone': 'America/Santiago',
      'school': null,
      'age': null,
      'region': null,
      'authProvider': 'password',
      'phone': '+56987654321',
      'phoneVerified': true,
      'country': 'CL',
      'language': 'es',
      'gradeId': 'cl-paes',
      'onboarded': true,
    });
    expect(u.name, 'Camila Rojas');
    expect(u.streak, 7);
    expect(u.isPaid, isTrue);
    expect(u.medals.bronze, 31);
  });

  test('ProgressItem lee percent aunque /me/progress agregue hasData, answered y recent', () {
    final items = [
      {'testId': 'lectora', 'label': 'Comp. Lectora', 'percent': 80, 'hasData': true, 'answered': 20, 'recent': 20},
      {'testId': 'cien', 'label': 'Ciencias', 'percent': 0, 'hasData': false, 'answered': 0, 'recent': 0},
    ].map(ProgressItem.fromJson).toList();
    expect(items[0].testId, 'lectora');
    expect(items[0].label, 'Comp. Lectora');
    expect(items[0].percent, 80);
    expect(items[1].percent, 0); // sin datos: sigue siendo un entero
  });

  test('MedalWalletState lee have, needed y next e ignora exchangeable y missing', () {
    final w = MedalWalletState.fromJson({
      'wallet': {'bronze': 31, 'silver': 6, 'gold': 2, 'diamond': 0, 'platinum': 1},
      'progress': {
        'bronze': {'have': 5, 'needed': 5, 'next': 'silver', 'exchangeable': 6, 'missing': 0},
      },
    });
    expect(w.wallet.bronze, 31);
    expect(w.progress.keys, ['bronze']);
    expect(w.progress['bronze']!.have, 5);
    expect(w.progress['bronze']!.needed, 5);
    expect(w.progress['bronze']!.next, 'silver');
  });

  test('MedalWalletState acepta que el nivel destacado no sea el bronce', () {
    final w = MedalWalletState.fromJson({
      'wallet': {'bronze': 3, 'silver': 6, 'gold': 0, 'diamond': 0, 'platinum': 0},
      'progress': {
        'silver': {'have': 5, 'needed': 5, 'next': 'gold', 'exchangeable': 1, 'missing': 0},
      },
    });
    expect(w.progress.keys, ['silver']);
    expect(w.progress['silver']!.next, 'gold');
  });
}
