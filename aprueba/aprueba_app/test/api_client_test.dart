import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:aprueba_app/core/network/api_client.dart';
import 'package:aprueba_app/core/network/api_exception.dart';
import 'package:aprueba_app/core/network/endpoints.dart';
import 'package:aprueba_app/core/storage/secure_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Almacén en memoria con los mismos métodos que SecureStorage.
class FakeStorage implements SecureStorage {
  FakeStorage({this.access = 'viejo', this.refresh = 'refresh-1'});
  String? access;
  String? refresh;

  @override
  Future<String?> get accessToken async => access;
  @override
  Future<String?> get refreshToken async => refresh;
  @override
  Future<void> saveTokens({required String access, required String refresh}) async {
    this.access = access;
    this.refresh = refresh;
  }

  @override
  Future<void> saveAccessToken(String access) async => this.access = access;
  @override
  Future<String?> deviceId() async => 'dev_test';
  @override
  Future<void> clear() async {
    access = null;
    refresh = null;
  }
}

typedef Handler = Future<ResponseBody> Function(RequestOptions options);

/// Servidor falso: responde según el token que trae la petición.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler);
  final Handler handler;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream,
          Future<void>? cancelFuture) =>
      handler(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody json(int status, Map<String, dynamic> body) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );

Map<String, dynamic> ok(Object data) => {'data': data, 'error': null};
Map<String, dynamic> err(String code) => {
      'data': null,
      'error': {'code': code, 'message': code, 'details': [], 'field': null},
    };

void main() {
  late FakeStorage storage;
  late int refreshCalls;
  late int expired;
  // Respuesta de las rutas protegidas cuando el token ya es el renovado.
  late ResponseBody Function() withNewToken;
  // Cómo responde el endpoint de renovación.
  late Future<ResponseBody> Function(RequestOptions) onRefresh;

  ApiClient build() {
    final dio = Dio()
      ..httpClientAdapter = FakeAdapter((options) async {
        if (options.path == Endpoints.refresh) {
          refreshCalls++;
          await Future<void>.delayed(const Duration(milliseconds: 20)); // deja que otras peticiones se solapen
          return onRefresh(options);
        }
        final auth = options.headers['Authorization'];
        if (auth == 'Bearer nuevo') return withNewToken();
        return json(401, err('AUTH_INVALID'));
      });
    return ApiClient(storage, dio: dio, onSessionExpired: () => expired++);
  }

  setUp(() {
    storage = FakeStorage();
    refreshCalls = 0;
    expired = 0;
    withNewToken = () => json(200, ok({'v': 1}));
    onRefresh = (_) async => json(200, ok({'accessToken': 'nuevo', 'refreshToken': 'refresh-2'}));
  });

  test('un 401 renueva el token una vez y reintenta la petición', () async {
    final res = await build().get<dynamic>('/protegida');
    expect(res.data, {'v': 1});
    expect(refreshCalls, 1);
    expect(storage.access, 'nuevo');
    expect(storage.refresh, 'refresh-2');
    expect(expired, 0);
  });

  test('varios 401 a la vez comparten una sola renovación', () async {
    final api = build();
    final results = await Future.wait([
      api.get<dynamic>('/a'),
      api.get<dynamic>('/b'),
      api.get<dynamic>('/c'),
    ]);
    expect(results.map((r) => r.data), everyElement({'v': 1}));
    expect(refreshCalls, 1);
    expect(expired, 0);
  });

  test('si el reintento falla por otro motivo, se devuelve ese error y no se cierra la sesión', () async {
    withNewToken = () => json(422, err('VALIDATION_ERROR'));
    await expectLater(
      build().get<dynamic>('/protegida'),
      throwsA(isA<ApiException>()
          .having((e) => e.code, 'code', 'VALIDATION_ERROR')
          .having((e) => e.statusCode, 'status', 422)),
    );
    expect(expired, 0);
    expect(storage.refresh, 'refresh-2'); // la sesión sigue guardada
  });

  test('si el servidor rechaza el refresh token, se cierra la sesión una vez', () async {
    onRefresh = (_) async => json(401, err('REFRESH_TOKEN_INVALID'));
    await expectLater(
      build().get<dynamic>('/protegida'),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)),
    );
    expect(expired, 1);
  });

  test('si la renovación falla por red, no se cierra la sesión', () async {
    onRefresh = (options) async => throw DioException(
          requestOptions: options,
          type: DioExceptionType.connectionError,
        );
    await expectLater(
      build().get<dynamic>('/protegida'),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)),
    );
    expect(expired, 0);
    expect(storage.refresh, 'refresh-1');
  });

  test('un 401 en una petición sin sesión (login) no dispara renovación ni cierre', () async {
    await expectLater(
      build().post<dynamic>('/auth/login', body: {'email': 'a@b.cl'}, skipAuth: true),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)),
    );
    expect(refreshCalls, 0);
    expect(expired, 0);
  });

  test('si tras renovar sigue el 401, cierra la sesión sin entrar en bucle', () async {
    withNewToken = () => json(401, err('AUTH_INVALID'));
    await expectLater(
      build().get<dynamic>('/protegida'),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)),
    );
    expect(refreshCalls, 1);
    expect(expired, 1);
  });
}
