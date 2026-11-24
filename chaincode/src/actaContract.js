"use strict";

const crypto = require("crypto");
const { Contract } = require("fabric-contract-api");

class ActaContract extends Contract {
  async registrarActa(ctx, idActa, tipoEleccion, ubigeo, hashImagen, hashDatos, votosJson, emitidos) {
    const identity = ctx.clientIdentity;
    const mspId = identity.getMSPID();
    const role = identity.getAttributeValue("role");

    if (mspId !== "ONPEMSP" || role !== "OPERADOR_ODPE") {
      throw new Error("Acceso denegado: se requiere ONPEMSP / OPERADOR_ODPE");
    }
    if (!/^[a-f0-9]{64}$/i.test(hashImagen) || !/^[a-f0-9]{64}$/i.test(hashDatos)) {
      throw new Error("Hash inválido: se requiere SHA-256 hexadecimal");
    }

    const key = `ACTA:${tipoEleccion}:${idActa}`;
    const existing = await ctx.stub.getState(key);
    if (existing && existing.length) throw new Error("El acta ya fue registrada");

    const votos = typeof votosJson === "string" ? JSON.parse(votosJson) : votosJson;
    const emitidosNumber = Number(emitidos);
    const sumVotes = Object.values(votos).reduce((sum, value) => sum + Number(value), 0);
    const jee = "JEE-" + ubigeo.slice(0, 2);
    const state = sumVotes === emitidosNumber ? "REGISTRADA" : "OBSERVADA";

    const acta = {
      idActa,
      tipoEleccion,
      ubigeo,
      jee,
      hashImagen: hashImagen.toLowerCase(),
      hashDatos: hashDatos.toLowerCase(),
      votos,
      emitidos: emitidosNumber,
      estado: state,
      motivoObservacion: state === "OBSERVADA" ? "ERROR_ARITMETICO" : null,
      firmante: identity.getID(),
      msp: mspId,
      fechaRegistro: ctx.stub.getTxTimestamp
        ? new Date(ctx.stub.getTxTimestamp().seconds * 1000).toISOString()
        : new Date().toISOString(),
      historial: []
    };

    acta.historial.push({ evento: "ACTA_REGISTRADA", estado: state, txId: ctx.stub.getTxID() });
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(acta)));
    ctx.stub.setEvent("ActaEvent", Buffer.from(JSON.stringify({ idActa, tipoEleccion, estado: state })));
    return JSON.stringify(acta);
  }

  async consultarActa(ctx, idActa, tipoEleccion) {
    const data = await ctx.stub.getState(`ACTA:${tipoEleccion}:${idActa}`);
    if (!data || !data.length) throw new Error("Acta no encontrada");
    return data.toString();
  }

  async recuento(ctx, idActa, tipoEleccion, votosJson, emitidos, hashActaRecuento) {
    const identity = ctx.clientIdentity;
    if (identity.getMSPID() !== "JNEMSP" || identity.getAttributeValue("role") !== "JEE_MAGISTRADO") {
      throw new Error("Acceso denegado: se requiere JNEMSP / JEE_MAGISTRADO");
    }
    if (!/^[a-f0-9]{64}$/i.test(hashActaRecuento)) throw new Error("Hash de recuento inválido");

    const key = `ACTA:${tipoEleccion}:${idActa}`;
    const data = await ctx.stub.getState(key);
    if (!data || !data.length) throw new Error("Acta no encontrada");
    const acta = JSON.parse(data.toString());
    if (acta.estado !== "OBSERVADA") throw new Error("Solo se recuenta un acta OBSERVADA");

    const votos = typeof votosJson === "string" ? JSON.parse(votosJson) : votosJson;
    if (Object.values(votos).reduce((sum, value) => sum + Number(value), 0) !== Number(emitidos)) {
      throw new Error("El recuento no cumple la regla aritmética");
    }

    acta.votosAnteriores = acta.votos;
    acta.votos = votos;
    acta.emitidos = Number(emitidos);
    acta.hashRecuento = hashActaRecuento.toLowerCase();
    acta.estado = "CONTABILIZADA";
    acta.historial.push({ evento: "RECUENTO_REGISTRADO", estado: acta.estado, txId: ctx.stub.getTxID() });
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(acta)));
    return JSON.stringify(acta);
  }
}

module.exports = { ActaContract, sha256: value => crypto.createHash("sha256").update(value).digest("hex") };
