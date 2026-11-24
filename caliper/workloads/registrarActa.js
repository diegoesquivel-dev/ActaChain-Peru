"use strict";

const crypto = require("crypto");
const { WorkloadModuleBase } = require("@hyperledger/caliper-core");

class ActaChainWorkload extends WorkloadModuleBase {
  constructor() {
    super();
    this.txIndex = 0;
  }

  async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
    await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
    this.workerIndex = workerIndex;
  }

  async submitTransaction() {
    this.txIndex += 1;
    const mode = this.roundArguments.mode || "write";
    const tipoEleccion = this.roundArguments.tipoEleccion || "PRES";

    if (mode === "read") {
      const idActa = `079168-10`;
      const request = {
        contractId: this.roundArguments.contractId || "actachain",
        contractFunction: "ActaContract:consultarActa",
        invokerIdentity: "AUDITOR_RENIEC",
        contractArguments: [idActa, tipoEleccion],
        readOnly: true
      };
      await this.sutAdapter.sendRequests(request);
      return;
    }

    const idActa = `${String(100000 + this.workerIndex * 10000 + this.txIndex).slice(0, 6)}-10`;
    const votos = { P1: 55, P2: 35, BLANCOS: 5, NULOS: 5 };
    const votosJson = JSON.stringify(votos);
    const hashImagen = crypto.createHash("sha256").update(`img-${idActa}`).digest("hex");
    const hashDatos = crypto.createHash("sha256").update(votosJson).digest("hex");

    const request = {
      contractId: this.roundArguments.contractId || "actachain",
      contractFunction: "ActaContract:registrarActa",
      invokerIdentity: "OPERADOR_ODPE",
      contractArguments: [
        idActa,
        tipoEleccion,
        this.roundArguments.ubigeo || "220901",
        hashImagen,
        hashDatos,
        votosJson,
        "100"
      ],
      readOnly: false
    };

    await this.sutAdapter.sendRequests(request);
  }
}

function createWorkloadModule() {
  return new ActaChainWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
