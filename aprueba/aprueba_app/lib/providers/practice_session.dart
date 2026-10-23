import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/models.dart';
import 'app_providers.dart';
import 'data_providers.dart';

/// Estado de la sesión de práctica en curso (pregunta, selección, resultado).
class PracticeSessionState {
  const PracticeSessionState({
    this.question,
    this.selectedIndex,
    this.result,
    this.elapsedMs = 0,
    this.loading = false,
    this.error,
    this.testId,
  });

  final Question? question;
  final int? selectedIndex;
  final AnswerResult? result;
  final int elapsedMs;
  final bool loading;
  final String? error;
  /// Prueba elegida para la sesión (null = la que el servidor decida por las preferencias).
  final String? testId;

  PracticeSessionState copyWith({
    Question? question,
    int? selectedIndex,
    AnswerResult? result,
    int? elapsedMs,
    bool? loading,
    String? error,
    bool clearResult = false,
    bool clearSelection = false,
    String? testId,
    bool clearTest = false,
  }) =>
      PracticeSessionState(
        question: question ?? this.question,
        selectedIndex: clearSelection ? null : (selectedIndex ?? this.selectedIndex),
        result: clearResult ? null : (result ?? this.result),
        elapsedMs: elapsedMs ?? this.elapsedMs,
        loading: loading ?? this.loading,
        error: error,
        testId: clearTest ? null : (testId ?? this.testId),
      );

  /// Letra (A..E) de la alternativa seleccionada.
  String? get selectedLetter =>
      selectedIndex == null ? null : String.fromCharCode(65 + selectedIndex!);
}

class PracticeSession extends Notifier<PracticeSessionState> {
  @override
  PracticeSessionState build() => const PracticeSessionState();

  /// Empieza una práctica en [testId] (o en la que decida el servidor si es null).
  Future<void> start({String? testId}) {
    state = state.copyWith(testId: testId, clearTest: testId == null);
    return loadNext();
  }

  /// Siguiente pregunta, en la misma prueba que la sesión en curso.
  Future<void> loadNext() async {
    final testId = state.testId;
    state = state.copyWith(loading: true, error: null, clearResult: true, clearSelection: true);
    try {
      final res = await ref.read(practiceRepositoryProvider).next(testId: testId);
      state = PracticeSessionState(question: res.question, testId: testId);
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
      rethrow;
    }
  }

  void select(int index) => state = state.copyWith(selectedIndex: index);
  void setElapsed(int ms) => state = state.copyWith(elapsedMs: ms);

  Future<AnswerResult> submit({String? sessionId}) async {
    final q = state.question!;
    final letter = state.selectedLetter!;
    state = state.copyWith(loading: true);
    final result = await ref.read(practiceRepositoryProvider).answer(
          questionId: q.id,
          selected: letter,
          elapsedMs: state.elapsedMs,
          sessionId: sessionId,
        );
    state = state.copyWith(result: result, loading: false);
    // Refresca cuota/perfil tras responder.
    ref.invalidate(quotaProvider);
    ref.invalidate(progressSummaryProvider);
    ref.invalidate(meProvider); // la racha cambia al practicar
    return result;
  }
}

final practiceSessionProvider =
    NotifierProvider<PracticeSession, PracticeSessionState>(PracticeSession.new);
