# ActaChain Perú

Prototipo funcional del proyecto integrador **ActaChain Perú**, orientado a la custodia, trazabilidad e integridad verificable de actas electorales peruanas tras el cierre de mesa.

## Documentación de entrega

- Documentación funcional y técnica: [DOCUMENTACION_DEL_SISTEMA.md](docs/DOCUMENTACION_DEL_SISTEMA.md)
- Reporte de pruebas ejecutadas (P-01 a P-05): [REPORTE_PRUEBAS_EJECUTADAS.md](docs/evidencias/REPORTE_PRUEBAS_EJECUTADAS.md)
- Especificación OpenAPI 3.0.3: [openapi.json](docs/openapi.json) (también servida en `/api/openapi.json`)

## Estado actual (Rama-Huanuco)

- **Chaincode (`ActaContract` y `CustodiaContract`)**: Reglas R1–R10 implementadas (`registrarActa`, `contabilizarActa`, `observarActa`, `registrarEjemplarJEE`, `resolverActa`, `recuento`, `proclamar` con cálculo de raíz de Merkle, `registrarConstancia`, `registrarNulidad` con plazo R7 y `resolverNulidad`).
- **API REST (`api-gateway`)**: Ciclo completo TO-BE, regla R4 (descuadre aritmético pasa a `OBSERVADA` sin rechazar), endoso simulado ONPE-JNE, exportación de constancia criptográfica firmada (RF10), comparación de votos, cola Outbox (RNF04), limitación de tasa, cabeceras de seguridad y OpenAPI 3.0.
- **Portal web (`portal-web`)**: Diseño institucional con 6 vistas (`Inicio`, `Consultar acta`, `Registrar acta`, `Gestión JEE / Consorcio`, `Seguimiento`, `Ayuda`), selector de tipo de elección, línea de tiempo e hashes on-chain (P-02), verificación SHA-256 local en navegador (P-03/P-05), exportación de constancia JSON (RF10), contabilización, recuento JEE, constancias de personeros y proclamación con raíz de Merkle.
- **Red SmartBFT y Caliper (`network/`, `caliper/`)**: Perfil `configtx.yaml` con 4 organizaciones (`ONPEMSP`, `JNEMSP`, `RENIECMSP`, `DEFENSORIAMSP`) y 4 ordenadores SmartBFT (`n=4, f=1`), script `network.sh` y escenarios de benchmark Caliper para carga pico de 72 tx/s.
- **Pruebas automatizadas**: 7 pruebas unitarias en `chaincode` y 6 pruebas de integración en `api-gateway` (P-01 a P-05 + ciclo TO-BE completo).

## Requisitos

- Node.js 20 o superior.
- Docker Desktop o Docker Engine con Compose (para contenedores / red real).
- Para Fabric real: binarios `peer`, `orderer`, `configtxgen` y `cryptogen` v3.0.

## Inicio rápido

```powershell
npm.cmd install
npm.cmd run demo
```

El comando restaura las actas de demostración e inicia el servidor en `http://localhost:3005`. Mantenga abierta la terminal durante la demostración y use `Ctrl+C` para detenerlo.

Para ejecutar las pruebas automatizadas antes de iniciar la demostración:

```powershell
npm.cmd test
```

Si solo desea restablecer los datos con el servidor detenido, ejecute `npm.cmd run reset:demo`.

## Prueba del portal independiente

```powershell
npm.cmd run dev
```

Abra `http://localhost:5173`. El portal independiente necesita que la API también esté activa en el puerto 3000.

## Pruebas funcionales cubiertas

| ID | Cobertura |
|---|---|
| P-01 | Registro válido (`REGISTRADA`), descuadre aritmético (`OBSERVADA` - R4), rol autorizado y unicidad |
| P-02 | Consulta pública de acta, votos, hashes SHA-256, firmante e historial completo |
| P-03 | Cálculo local de SHA-256 en navegador / cliente contra PDF oficial |
| P-04 | Rechazo ABAC por rol no autorizado (`RENIECMSP`) y competencia territorial JEE (R6) |
| P-05 | Detección de adulteración de archivo y exportación de constancia criptográfica firmada (RF10) |

## Limitación

El entorno de demostración ejecuta la API y persistencia local (`api-gateway/data/database.json`) simulando los atributos X.509 (`x-demo-role`, `x-demo-msp`, `x-demo-jee`) y el ordenamiento de bloques. El despliegue distribuido real de Hyperledger Fabric v3.0 con SmartBFT y Hyperledger Caliper requiere Docker activo y los binarios oficiales de Fabric v3.0.
