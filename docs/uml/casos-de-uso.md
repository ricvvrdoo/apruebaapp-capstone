# Diagrama de casos de uso

Actores y casos de uso del sistema del estudiante (sitio web y app móvil, a través de
la API). Mermaid no tiene notación nativa de casos de uso: los actores se dibujan como
nodos rectangulares y los casos de uso como óvalos dentro del límite del sistema.

![Diagrama de casos de uso](img/casos-de-uso.png)

```mermaid
flowchart LR
    V["👤 Visitante"]
    E["👤 Estudiante"]
    P["👤 Estudiante con plan de pago"]
    FA["⚙️ Firebase Auth<br/>(SMS)"]
    PG["⚙️ Pasarela de pagos<br/>(fuera del MVP)"]

    P -. "es un" .-> E

    subgraph S["Sistema Aprueba"]
        direction TB
        subgraph CU1["Cuenta"]
            UC1(["Registrarse con teléfono verificado"])
            UC2(["Iniciar sesión"])
            UC3(["Iniciar sesión con Google o Apple (demo)"])
            UC4(["Recuperar contraseña"])
            UC5(["Configurar perfil y preferencias"])
            UC6(["Eliminar cuenta"])
        end
        subgraph CU2["Práctica"]
            UC7(["Practicar pregunta PAES"])
            UC8(["Ver explicación y habilidad"])
            UC9(["Solicitar recorrección"])
            UC10(["Desbloquear cuota (+5)"])
            UC11(["Ver progreso"])
            UC23(["Controlar cuota diaria"])
        end
        subgraph CU3["Gamificación"]
            UC12(["Canjear medallas"])
            UC13(["Regalar medallas"])
            UC14(["Canjear beneficios"])
        end
        subgraph CU4["Social"]
            UC15(["Crear grupo e invitar"])
            UC16(["Unirse a un grupo"])
            UC17(["Publicar y comentar en la comunidad"])
        end
        subgraph CU5["Tutores"]
            UC18(["Buscar tutor y ver perfil"])
            UC19(["Contactar tutor y chatear"])
            UC20(["Analizar falencias"])
        end
        subgraph CU6["Planes"]
            UC21(["Ver planes"])
            UC22(["Contratar plan"])
        end
    end

    V --> UC1 & UC2 & UC3 & UC4 & UC21
    E --> UC5 & UC6 & UC7 & UC8 & UC9 & UC10 & UC11
    E --> UC12 & UC13 & UC14 & UC15 & UC16 & UC17 & UC18 & UC22
    P --> UC19 & UC20
    UC1 -.-> FA
    UC22 -.-> PG
    UC7 -. "«include»" .-> UC23
    UC10 -. "«extend»" .-> UC23
```

## Notas

- **Estudiante con plan de pago** hereda todos los casos del estudiante y agrega los
  marcados como premium (`403 PLAN_REQUIRED` en el plan gratuito).
- **Practicar pregunta** incluye el control de la cuota diaria: 10 preguntas base,
  +5 por colegio y +5 por dirección, con un máximo de 20; los planes de pago no tienen
  límite.
- **Iniciar sesión con Google o Apple** y **Contratar plan** solo funcionan en modo de
  demostración (`DEMO_MODE`) mientras la empresa no defina los proveedores reales.
- La consola de administración y el generador de preguntas están fuera del alcance.
