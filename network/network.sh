#!/usr/bin/env bash
set -euo pipefail

CHANNEL_NAME="${1:-canal-elecciones-2026}"
ACTION="${2:-up}"

if [[ "$ACTION" == "up" ]]; then
  echo "Desarrollo de red local: ${CHANNEL_NAME}"
  echo "Instale Docker Engine y los binarios Fabric v3.0, luego ejecute el script oficial test-network:"
  echo "./test-network.sh up createChannel -c ${CHANNEL_NAME} -bft"
fi
