# Documentación de ActaChain Perú

Versión del prototipo: 1.0  
Última actualización: 24 de noviembre de 2026

## 1. Propósito del sistema

ActaChain Perú es una demostración de una plataforma para registrar, consultar y verificar actas electorales peruanas. El sistema cubre el momento posterior al escrutinio en mesa: conserva los datos del acta, genera una representación PDF, registra movimientos y permite comprobar si el archivo generado ha sido alterado.

El prototipo no realiza votación electrónica, no recibe votos desde un dispositivo del ciudadano y no sustituye el cómputo oficial. El voto continúa realizándose en papel. La blockchain propuesta serviría como capa de integridad y trazabilidad entre la ONPE, el JNE, el RENIEC y la Defensoría del Pueblo.

## 2. Qué problema intenta resolver

El proceso electoral tradicional usa actas físicas y cadenas de custodia manuales. Esto puede producir demoras, errores materiales, controversias y falta de una verificación independiente.

ActaChain busca aportar:

- Una identificación única para cada acta.
- Un registro de los votos por organización o candidato.
- Un historial de estados y movimientos.
- Una huella SHA-256 para detectar cambios en el documento.
- Una consulta pública de los datos registrados.
- Un mecanismo de comparación entre el documento original y una copia posterior.
- La separación entre datos de votación y documentos fuera de la cadena.

## 3. Qué hace actualmente el prototipo

### Inicio

Presenta el nombre del sistema, una descripción del servicio y accesos a las tres operaciones principales:

- Buscar un acta.
- Registrar un acta.
- Revisar el seguimiento.

La apariencia sigue el estilo visual institucional utilizado por ONPE: fondo blanco, azul institucional, navegaciones superiores, tarjetas y titulares claros.

### Consultar acta

Permite buscar una mesa mediante su código. Al presionar consultar:

1. Se solicita el acta a la API.
2. Se oculta el estado vacío inicial.
3. Si existe, se muestran mesa, ubicación, estado y resultados.
4. Se puede visualizar el PDF generado.
5. Se puede subir un archivo para comparar su SHA-256.

La consulta incluye votos de todas las organizaciones o candidatos presentes, además de votos blancos y nulos. El estado observado se presenta como “En revisión”.

### Registrar acta

Permite ingresar:

- Código de acta o mesa.
- Tipo de elección.
- Departamento.
- Provincia.
- Distrito.
- Local de votación.
- Código geográfico administrativo.
- Nombre y votos de cada organización o candidato.
- Votos en blanco.
- Votos nulos.

Al registrar:

1. La API recibe los datos.
2. Valida que el código no esté duplicado.
3. Calcula el total emitido.
4. Genera un identificador de transacción de demostración.
5. Genera automáticamente un archivo PDF.
6. Calcula la huella SHA-256 del PDF.
7. Guarda el acta y su documento en almacenamiento local.

No es necesario subir el acta físicamente durante el registro. En una implementación real, el PDF debería generarse a partir de la digitalización aprobada por la mesa o del sistema oficial de cómputo. La pantalla no debe aceptar una imagen o PDF externo sin identidad y firma institucional.

### Seguimiento

Muestra:

- Cantidad de actas disponibles.
- Cantidad de movimientos registrados.
- Estado de la verificación digital.
- Tabla con código de mesa, elección y estado.
- Acceso directo a la consulta de cada acta.

La lista no representa todavía ordenadores reales ni bloques distribuidos. Sus bloques son registros demostrativos en el archivo JSON local.

### Verificación de integridad

El usuario selecciona un archivo desde su navegador. El navegador calcula SHA-256 sin enviar el documento al servidor. Después, la API compara ese hash con el hash registrado.

- Coincidencia: el documento corresponde al contenido registrado.
- Diferencia: el documento fue alterado o no corresponde al acta.

El cálculo no demuestra que el acta original fue correcta. Solo demuestra que el documento comparado coincide o no con el documento registrado.

## 4. Usuarios previstos

### Ciudadano

Puede consultar un acta y comprobar una copia. No necesita DNI ni voto electrónico para esta funcionalidad.

### Personero acreditado

Puede comparar su copia del acta con el documento registrado y presentar una discrepancia ante el JEE.

### Operador autorizado de ODPE

Ingresa o registra las actas digitalizadas. La versión actual simula este rol mediante una cabecera interna.

### Secretario o magistrado del JEE

En el diseño completo registra ejemplares, resoluciones y recuentos. El prototipo visual todavía no tiene pantallas completas para esas operaciones.

### JNE, RENIEC y Defensoría

Los cuatro organismos participan en la red diseñada:

- ONPE: registra actas y opera cómputo.
- JNE: registra resoluciones y promulgaciones.
- RENIEC: valida identidades y certificados.
- Defensoría: actúa como nodo validador y auditor.

Esta distribución es parte del diseño documentado. No está desplegada como red real en el prototipo actual.

## 5. Modelo de datos

Cada acta contiene:

| Campo | Significado |
|---|---|
| `idActa` | Identificador único de mesa y proceso |
| `tipoEleccion` | Presidencial, senadores o diputados |
| `ubigeo` | Código geográfico administrativo |
| `departamento` | Departamento |
| `provincia` | Provincia |
| `distrito` | Distrito |
| `localVotacion` | Colegio o local donde votó la mesa |
| `mesa` | Identificador de mesa |
| `candidatos` | Lista dinámica de nombres y votos |
| `votos.BLANCOS` | Votos en blanco |
| `votos.NULOS` | Votos nulos |
| `emitidos` | Total de votos registrados |
| `estado` | Estado operativo del acta |
| `hashImagen` | Huella SHA-256 del PDF o documento digital |
| `hashDatos` | Huella SHA-256 del conjunto de votos |
| `documento` | Referencia al archivo generado fuera de la cadena |
| `historial` | Transiciones y operaciones del acta |

Los datos iniciales se mantienen en `api-gateway/data/database.json`. Esta carpeta se crea automáticamente si no existe.

Los PDF se crean en `api-gateway/evidence/`. Esta carpeta también se crea automáticamente.

## 6. Ubigeo

El Ubigeo no es un código postal ni un código de colegio.

Es el código administrativo usado en el Perú para identificar departamentos, provincias y distritos. Tiene seis dígitos:

- Dos primeros: departamento.
- Los siguientes dos: provincia.
- Los últimos dos: distrito.

Ejemplo:

- `150101`: Lima, Lima, Lima.

Por seguridad de uso, el sistema muestra primero el departamento, provincia y distrito en lenguaje claro. El código Ubigeo puede quedar como dato técnico completo o como ayuda de clasificación.

## 7. Actas, documentos y blockchain

El documento PDF no debería guardarse dentro de los bloques de una blockchain. Un blockchain debe guardar datos pequeños y huellas criptográficas, no imágenes o PDFs completos.

La arquitectura correcta es:

- La imagen o PDF del acta se guarda fuera de la cadena.
- La cadena guarda el identificador del acta.
- La cadena guarda el hash SHA-256 del documento.
- La cadena guarda el conteo agregado y metadatos.
- La cadena guarda firmas e historial de estados.
- La aplicación recalcula el hash para comprobar integridad.

Esto evita que la red crezca demasiado y mantiene fuera datos personales o expedientes sensibles.

En el prototipo actual, el PDF se genera automáticamente a partir de los datos enviados al servidor. Esta generación debe considerarse un ejemplo administrativo. En producción, el PDF debería provenir del acta escaneada o del documento firmado emitido por el sistema electoral oficial.

## 8. Estados del acta

Los estados utilizados en la interfaz son:

| Estado | Significado visual |
|---|---|
| Registrada | El acta fue recibida y tiene registro inicial |
| Contabilizada | Los resultados fueron validados y contabilizados |
| En revisión | El acta requiere revisión por una inconsistencia |
| Resuelta | El JEE emitió una resolución |
| Recontada | Existió un recuento válido |
| Anulada | El acta fue anulada por resolución competente |

Un acta observada no significa que sea falsa. Significa que necesita revisión por ilegibilidad, firmas faltantes, diferencia aritmética u otro motivo definido por el JEE.

## 9. API REST actual

| Método | Ruta | Función |
|---|---|---|
| `GET` | `/health` | Comprueba que el servidor funciona |
| `GET` | `/api/actas` | Devuelve todas las actas |
| `GET` | `/api/actas/:tipo/:id` | Consulta una acta |
| `POST` | `/api/actas` | Registra una acta |
| `POST` | `/api/verify/sha256` | Compara una huella enviada |
| `GET` | `/api/blocks` | Devuelve movimientos demostrativos |
| `GET` | `/evidence/:archivo` | Sirve un PDF generado |

Ejemplo de consulta:

```text
GET /api/actas/PRES/079168-10
```

Ejemplo de registro:

```json
{
  "idActa": "079168-13",
  "tipoEleccion": "PRES",
  "ubigeo": "150101",
  "departamento": "Lima",
  "provincia": "Lima",
  "distrito": "San Borja",
  "localVotacion": "IE 0015 San Juan",
  "candidatos": [
    { "nombre": "Organización 1", "votos": 55 },
    { "nombre": "Organización 2", "votos": 35 }
  ],
  "votos": {
    "C1": 55,
    "C2": 35,
    "BLANCOS": 5,
    "NULOS": 5
  },
  "emitidos": 100,
  "hashImagen": "64 caracteres hexadecimales",
  "hashDatos": "64 caracteres hexadecimales"
}
```

Nota: el servidor actual valida los hashes con formato SHA-256 de 64 caracteres hexadecimales.

## 10. Componentes principales

### `portal-web`

Interfaz HTML, CSS y JavaScript. Contiene las pantallas de inicio, consulta, registro, seguimiento y ayuda.

Responsabilidades:

- Capturar datos.
- Permitir búsquedas.
- Mostrar gráficos simples de votos.
- Calcular SHA-256 en el navegador.
- Abrir documentos PDF.
- Consumir la API.

### `api-gateway`

Servidor Express que:

- Expone las rutas REST.
- Usa un archivo JSON como persistencia actual.
- Inicializa datos iniciales.
- Genera PDF con PDFKit.
- Calcula y compara hashes.
- Simula movimientos transaccionales.

### `chaincode`

Contiene los contratos `ActaContract` y `CustodiaContract` con las reglas R1–R10 del documento:

- Identidad y rol (R1) y competencia JEE por ubigeo (R6).
- Unicidad (R2) y formato SHA-256 (R3).
- Aritmética de votos con transición automática a `OBSERVADA` (R4).
- Máquina de estados (`contabilizarActa`, `observarActa`, `resolverActa`, `recuento` con `votosAnteriores`, `proclamar` con raíz de Merkle R9).
- Custodia de personeros (`registrarConstancia`) y pedidos de nulidad dentro del plazo de 3 días (R7).

Actualmente las pruebas unitarias ejecutan los contratos con stubs deterministas de Hyperledger Fabric; el despliegue multi-nodo requiere Docker y los binarios Fabric v3.0.

### `network` y `caliper`

- `network/configtx.yaml` y `network/network.sh`: definen el canal `ActaChainSmartBFTChannel` con `ONPEMSP`, `JNEMSP`, `RENIECMSP` y `DEFENSORIAMSP`, política de endoso `AND('ONPEMSP.peer','JNEMSP.peer')` y 4 nodos ordenadores SmartBFT (`n=4, f=1`).
- `caliper/benchmarks/actachain-benchmark.yaml` y `caliper/workloads/registrarActa.js`: escenarios de carga pico a 72 tx/s y lectura pública para validar `P95 <= 5 s`.

## 11. Cómo el sistema mejora el proceso actual

El sistema no acelera el voto ni reemplaza el escrutinio manual dentro de la mesa. La mejora aparece después:

1. Cada acta recibe una identificación y huella digital.
2. Los datos quedan disponibles sin esperar una consulta manual.
3. Los cambios generan nuevos movimientos auditable.
4. Los errores no se borran ni se sobrescriben.
5. Personeros y ciudadanos pueden verificar documentos por sí mismos.
6. ONPE y JNE pueden cotejar resoluciones sin depender de hojas físicas separadas.
7. Se reduce el tiempo de contraste cuando existe una controversia.
8. Se detecta inmediatamente una copia modificada.

El proceso sigue necesitando papel, firmas físicas, digitalización y competencia del JEE. Blockchain no corrige el acta llenada en mesa ni garantiza que el primer dato digital sea verdadero.

## 12. Diferencia entre demostración actual y blockchain real

| Capacidad | Estado actual |
|---|---|
| Consulta REST | Implementada |
| Persistencia JSON | Implementada |
| PDF generado | Implementado |
| Candidatos dinámicos | Implementado |
| SHA-256 local | Implementado |
| PDF por acta | Implementado |
| Captura manual de votos | Implementada |
| Voto ciudadano | No implementado |
| Datos reales ONPE/JNE | No implementados |
| Certificados X.509 | No implementados |
| SmartBFT | No desplegado |
| Hyperledger Fabric real | No desplegado |
| Endoso ONPE-JNE | No implementado |
| HSM y claves institucionales | No implementados |
| Auditoría externa | Pendiente |
| Pruebas Caliper | Pendientes |

## 13. Riesgos y reglas pendientes

La siguiente evolución debe incluir:

- Conectar certificados reales o certificados de prueba por organización.
- Autenticar operadores y roles.
- Implementar endoso ONPE-JNE.
- Reemplazar la persistencia JSON por Fabric.
- Validar y firmar el documento físico antes del registro.
- Registrar resoluciones y recuentos.
- Añadir control de plazos y competencia territorial.
- Añadir exportación de evidencias firmadas.
- Proteger el API con OAuth2, mTLS y límites de uso.
- Eliminar acceso de escritura sin autenticación.
- Añadir auditoría independiente y pruebas de carga.

## 14. Ejecución local

Requisitos:

- Node.js 20 o superior.
- npm.
- Docker es opcional para la interfaz actual.

Desde la raíz:

```powershell
npm install
npm test
npm start
```

Abrir:

```text
http://localhost:3000
```

Para ejecutar las pruebas:

```powershell
npm test
```

## 15. Ruta de entrega recomendada

La prioridad para continuar es:

1. Conservar el diseño visual.
2. Conectar autenticación y roles reales.
3. Sustituir el JSON por Hyperledger Fabric.
4. Vincular el PDF generado al documento firmado de la mesa.
5. Incorporar resolución de actas observadas.
6. Añadir pruebas P-01 a P-05 al flujo de Fabric.
7. Ejecutar pruebas de carga con Caliper.
8. Realizar auditoría de seguridad.

El sistema actual permite demostrar el flujo completo, pero no representa aún una red blockchain electoral operativa.
