import 'package:flutter/foundation.dart';

/// Configuración global de la app. Reemplaza los placeholders por tus claves
/// reales antes de publicar. Mantén las claves secretas fuera del repositorio
/// (usa --dart-define en CI/CD).
class AppConfig {
  AppConfig._();

  /// Raíz versionada del backend. Por defecto, el despliegue en Vercel
  /// (docs/despliegue-vercel.md). Para apuntar a la API local:
  ///   emulador Android: --dart-define=API_BASE_URL=http://10.0.2.2:4100/api/v1
  ///   simulador iOS:    --dart-define=API_BASE_URL=http://localhost:4100/api/v1
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://aprueba-api.vercel.app/api/v1',
  );

  /// Clave publicable de Stripe (pk_test_... o pk_live_...).
  static const String stripePublishableKey = String.fromEnvironment(
    'STRIPE_PUBLISHABLE_KEY',
    defaultValue: 'pk_test_PLACEHOLDER',
  );

  /// merchantIdentifier de Apple Pay (Apple Developer > Identifiers).
  static const String stripeMerchantId = String.fromEnvironment(
    'STRIPE_MERCHANT_ID',
    defaultValue: 'merchant.cl.aprueba.placeholder',
  );

  /// Google Sign-In serverClientId (OAuth Web client del proyecto).
  /// Necesario para obtener un idToken verificable por el backend.
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue: 'PLACEHOLDER.apps.googleusercontent.com',
  );

  /// Verificación telefónica: el SMS lo envía Firebase Auth desde el cliente y
  /// el backend valida el idToken. Mientras el proyecto de Firebase no tenga el
  /// proveedor de teléfono configurado, esta bandera envía un token de
  /// desarrollo (`dev:+56912345678`) que el backend acepta si tiene
  /// PHONE_AUTH_ALLOW_DEV_TOKEN=true. En release está apagada por defecto.
  static const bool usePhoneDevToken = bool.fromEnvironment(
    'PHONE_AUTH_DEV_TOKEN',
    defaultValue: !kReleaseMode,
  );

  /// Tiempos de los tokens (informativo; el backend manda).
  static const Duration accessTokenTtl = Duration(minutes: 15);

  static const int defaultPageLimit = 20;

  /// Cada cuánto se refresca el chat con tutores (transporte REST + polling).
  static const Duration chatPollInterval = Duration(seconds: 8);
}
