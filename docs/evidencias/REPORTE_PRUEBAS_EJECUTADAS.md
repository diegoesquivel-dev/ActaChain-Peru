# Reporte de Pruebas Funcionales Ejecutadas (P-01 a P-05)

Fecha de ejecución: 24 de noviembre de 2026  
Rama de evaluación: `Rama-Huanuco`  
Entorno: Simulación local Node.js v24.19.0 (`node --test`) sobre `chaincode` y `api-gateway`

## Resumen de ejecución automatizada

Comando ejecutado: `npm.cmd test`

| Suite | Pruebas | Aprobadas | Fallidas | Estado |
|---|---|---|---|---|
| `chaincode/test/actaContract.test.js` | 7 | 7 | 0 | APROBADO |
| `api-gateway/test/server.test.js` | 6 | 6 | 0 | APROBADO |
| **Total** | **13** | **13** | **0** | **100 % APROBADO** |

## Detalle de pruebas obligatorias (Capítulo 9, Tabla 23)

### P-01: Registro de acta digitalizada (RF01, RF02, R1, R2, R3, R4)
- **Validación en `ActaContract` y `POST /api/actas`**:
  - Acta válida (`079168-90`, rol `OPERADOR_ODPE`, `ONPEMSP`, suma de votos = `100`): confirmada con HTTP `201`, estado `REGISTRADA` y `txId` generado.
  - Segundo intento con mismo `idActa` y `tipoEleccion`: rechazado por regla R2 (`El acta ya fue registrada`).
  - Acta con descuadre aritmético (`079168-91`, suma `60` != emitidos `99`): registrada con HTTP `201`, estado `OBSERVADA`, `motivoObservacion: "ERROR_ARITMETICO"` y `jeeAsignado: "JEE-22"` (regla R4 y RF03).

### P-02: Consulta pública de acta, firmas e historial (RF08, RNF07, RNF08)
- **Validación en `GET /api/actas/PRES/079168-10` sin credenciales**:
  - HTTP `200 application/json`.
  - Devuelve votos (`P1: 60, P2: 30, BLANCOS: 5, NULOS: 5`), `hashImagen`: `6f5169269a460f5ff56f42cf91a57838f4b16e03e59b3c30c525499916fd830d`, `hashDatos` (64 hex), `firmante: "CN=OPERADOR_ODPE"`, `msp: "ONPEMSP"` e historial con bloque `#2` y `txId: "tx-demo-001"`.

### P-03: Verificación local de integridad SHA-256 (RF09, RNF06)
- **Validación con `/evidence/Acta-079168-10.pdf` y `POST /api/verify/sha256`**:
  - El hash SHA-256 calculado en cliente sobre el PDF oficial coincide carácter por carácter con `hashImagen` almacenado (`verified: true`, HTTP `200`).

### P-04: Bloqueo de acceso no autorizado y violación de permisos (R1, R6, R8)
- **Validación ABAC en chaincode y API Gateway**:
  - Invocación de `registrarActa` con identidad `RENIECMSP / AUDITOR_NODO`: rechazada con `Acceso denegado` (HTTP `403`).
  - Invocación de `recuento` sobre `079168-11` (`JEE-22`) usando credencial `JEE-15`: rechazada por competencia territorial R6 (HTTP `403`).

### P-05: Detección de adulteración y exportación de constancia firmada (RF09, RF10, R10)
- **Validación sobre copia alterada en 1 byte**:
  - `POST /api/verify/sha256` devuelve `verified: false` (HTTP `200`).
  - `GET /api/actas/PRES/079168-10/constancia-evidencia?hashArchivo=<hash_alterado>` devuelve constancia JSON con `coincide: false`, historial inmutable y `selloIntegridad` SHA-256 de 64 caracteres hexadecimales para trámite ante el JEE.

## Verificación adicional del ciclo TO-BE y rutas HTTP
- Contabilización con endoso conjunto (`REGISTRADA -> CONTABILIZADA`), recuento conservando `votosAnteriores` (R10), constancia de personero (RF05), validación de plazo de nulidad ≤ 3 días (R7), bloqueo de proclamación con actas pendientes/observadas (R9), proclamación con cálculo de `raizMerkle` SHA-256, cola Outbox (RNF04) y especificación OpenAPI 3.0.3 (`/api/openapi.json`) verificadas en ejecución automatizada con código `200 OK`.
