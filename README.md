# ActaChain Perú

Prototipo funcional del proyecto integrador descrito en el documento adjunto.

## Estado

- Chaincode demostrativo con reglas de identidad, unicidad, SHA-256 y aritmética.
- API REST para consulta y verificacion de actas.
- Portal web con calculo SHA-256 local en el navegador.
- Pruebas unitarias del chaincode y API.
- Scripts de red documentados; el despliegue real de Hyperledger SmartBFT requiere Docker Desktop activo.
- Persistencia local de datos en `api-gateway/data/database.json`.
- Cuatro pantallas: consulta pública, registro, explorador blockchain y guía.

## Requisitos

- Node.js 20 o superior.
- Docker Desktop o Docker Engine con Compose.
- Para Fabric real: binarios peer, orderer, configtxgen y cryptogen v3.0.

## Inicio rapido

```powershell
npm.cmd install
npm.cmd test
npm.cmd start
```

Abra http://localhost:3000.

## Prueba del portal independiente

```powershell
npm.cmd run dev
```

Abra http://localhost:5173. El portal independiente necesita que la API tambien este activa en el puerto 3000.

## Pruebas funcionales

| ID | Cobertura |
|---|---|
| P-01 | Registro valido, rol autorizado, unicidad y aritmetica |
| P-02 | Consulta publica de acta e historial |
| P-03 | Calculo local de SHA-256 en el navegador |
| P-04 | Rechazo de rol no autorizado |
| P-05 | Comparacion local contra hash registrado |

## Docker

```powershell
docker compose up --build
```

## Limitacion

Este entorno usa datos simulados y una API en memoria. No representa PKI, nodos SmartBFT ni persistencia distribuida productiva. La integracion real con Fabric requiere certificados de las organizaciones y una red del consorcio.
