#!/usr/bin/env bash
set -euo pipefail

# Script de gestión de la red permisionada Hyperledger Fabric v3.0 (SmartBFT) - ActaChain Perú
# Uso documentado en Capítulo 9:
#   ./network.sh up createChannel -c canal-elecciones-2026 -bft
#   ./network.sh deployCC -ccn actachain -ccp ../chaincode -ccl javascript -ccep "AND('ONPEMSP.peer','JNEMSP.peer')"
#   ./network.sh down

MODE="${1:-help}"
shift || true

CHANNEL_NAME="canal-elecciones-2026"
USE_BFT="true"
CC_NAME="actachain"
CC_SRC_PATH="../chaincode"
CC_SRC_LANGUAGE="javascript"
CC_END_POLICY="AND('ONPEMSP.peer','JNEMSP.peer')"
CREATE_CHANNEL="false"

if [[ "$MODE" == "up" && "${1:-}" == "createChannel" ]]; then
  CREATE_CHANNEL="true"
  shift
fi

while [[ $# -ge 1 ]]; do
  case "$1" in
    -c) CHANNEL_NAME="$2"; shift 2 ;;
    -bft) USE_BFT="true"; shift ;;
    -ccn) CC_NAME="$2"; shift 2 ;;
    -ccp) CC_SRC_PATH="$2"; shift 2 ;;
    -ccl) CC_SRC_LANGUAGE="$2"; shift 2 ;;
    -ccep) CC_END_POLICY="$2"; shift 2 ;;
    *) shift ;;
  esac
done

check_prereqs() {
  local missing=0
  for bin in docker peer orderer configtxgen cryptogen; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      echo "[AVISO] Binario requerido no encontrado en PATH: $bin"
      missing=1
    fi
  done
  return $missing
}

case "$MODE" in
  up)
    echo "Iniciando red permisionada ActaChain Perú | Canal: ${CHANNEL_NAME} | SmartBFT: ${USE_BFT}"
    echo "Topología: ONPEMSP (1 orderer, 2 peers), JNEMSP (1 orderer, 2 peers), RENIECMSP (1 orderer, 1 peer), DEFENSORIAMSP (1 orderer, 1 peer)"
    if check_prereqs; then
      if [[ -x "./test-network.sh" ]]; then
        if [[ "$CREATE_CHANNEL" == "true" ]]; then
          ./test-network.sh up createChannel -c "${CHANNEL_NAME}" -bft
        else
          ./test-network.sh up -bft
        fi
      else
        echo "Generando bloque génesis/canal con network/configtx.yaml..."
        configtxgen -profile ActaChainSmartBFTChannel -outputBlock "./channel-artifacts/${CHANNEL_NAME}.block" -channelID "${CHANNEL_NAME}"
      fi
    else
      echo "Para despliegue real de contenedores SmartBFT, instale Docker Engine y binarios de Hyperledger Fabric v3.0."
      echo "Referencia de perfil SmartBFT lista en: network/configtx.yaml"
    fi
    ;;
  deployCC)
    echo "Desplegando chaincode '${CC_NAME}' (${CC_SRC_LANGUAGE}) desde ${CC_SRC_PATH}"
    echo "Política de endoso (R8): ${CC_END_POLICY}"
    if check_prereqs && [[ -x "./test-network.sh" ]]; then
      ./test-network.sh deployCC -ccn "${CC_NAME}" -ccp "${CC_SRC_PATH}" -ccl "${CC_SRC_LANGUAGE}" -ccep "${CC_END_POLICY}"
    else
      echo "En modo simulación local, ejecute las pruebas del chaincode con: npm test --workspace=chaincode"
    fi
    ;;
  down)
    echo "Deteniendo red permisionada ActaChain Perú..."
    if [[ -x "./test-network.sh" ]]; then
      ./test-network.sh down
    fi
    ;;
  *)
    echo "Uso: $0 {up [createChannel]|deployCC|down} [-c canal] [-bft] [-ccn nombre] [-ccp ruta] [-ccl lenguaje] [-ccep politica]"
    ;;
esac
