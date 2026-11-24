"use strict";

const { Contract } = require("fabric-contract-api");

function isSha256Hex(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function getTxTimestampIso(ctx) {
  return ctx.stub.getTxTimestamp
    ? new Date(ctx.stub.getTxTimestamp().seconds * 1000).toISOString()
    : new Date().toISOString();
}

class CustodiaContract extends Contract {
  async registrarConstancia(ctx, idActa, tipoEleccion, hashCopia, votosJson, organizacion, ambito = "NACIONAL") {
    const identity = ctx.clientIdentity;
    if (identity.getMSPID() !== "JNEMSP" || identity.getAttributeValue("role") !== "PERSONERO") {
      throw new Error("Acceso denegado: se requiere credencial de personero");
    }
    if (!isSha256Hex(hashCopia)) throw new Error("Hash de copia inválido");

    const proc = await ctx.stub.getState(`PROCLAMACION:${tipoEleccion}:${ambito}`);
    if (proc && proc.length) {
      throw new Error("Plazo vencido (R7): el ámbito ya fue proclamado");
    }

    const key = `CONSTANCIA:${tipoEleccion}:${idActa}:${organizacion}`;
    const constancia = {
      idActa,
      tipoEleccion,
      hashCopia: hashCopia.toLowerCase(),
      votos: typeof votosJson === "string" ? JSON.parse(votosJson) : votosJson,
      organizacion,
      firmante: identity.getID(),
      fecha: getTxTimestampIso(ctx),
      txId: ctx.stub.getTxID()
    };
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(constancia)));
    return JSON.stringify(constancia);
  }

  async registrarNulidad(ctx, idActa, tipoEleccion, hashEscrito, motivo, diasDesdeJornada = 1) {
    const identity = ctx.clientIdentity;
    const role = identity.getAttributeValue("role");
    if (identity.getMSPID() !== "JNEMSP" || (role !== "JEE_SECRETARIO" && role !== "PERSONERO")) {
      throw new Error("Acceso denegado: se requiere JNEMSP / JEE_SECRETARIO o PERSONERO");
    }
    if (Number(diasDesdeJornada) > 3) {
      throw new Error("Plazo vencido (R7): el pedido de nulidad excede los 3 días de ley (Ley N.° 26859, art. 363)");
    }
    if (!isSha256Hex(hashEscrito)) throw new Error("Hash de escrito de nulidad inválido");

    const txId = ctx.stub.getTxID();
    const key = `NULIDAD:${tipoEleccion}:${idActa}:${txId}`;
    const nulidad = {
      idNulidad: txId,
      idActa,
      tipoEleccion,
      hashEscrito: hashEscrito.toLowerCase(),
      motivo,
      estado: "PRESENTADA",
      firmante: identity.getID(),
      fecha: getTxTimestampIso(ctx)
    };
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(nulidad)));
    return JSON.stringify(nulidad);
  }

  async resolverNulidad(ctx, idActa, tipoEleccion, idNulidad, decision, hashResolucion) {
    const identity = ctx.clientIdentity;
    const role = identity.getAttributeValue("role");
    if (identity.getMSPID() !== "JNEMSP" || (role !== "JEE_MAGISTRADO" && role !== "JNE_PLENO")) {
      throw new Error("Acceso denegado: se requiere JNEMSP / JEE_MAGISTRADO o JNE_PLENO");
    }
    if (!isSha256Hex(hashResolucion)) throw new Error("Hash de resolución inválido");

    const key = `NULIDAD:${tipoEleccion}:${idActa}:${idNulidad}`;
    const data = await ctx.stub.getState(key);
    if (!data || !data.length) throw new Error("Pedido de nulidad no encontrado");
    const nulidad = JSON.parse(data.toString());

    nulidad.estado = "RESUELTA";
    nulidad.decision = decision;
    nulidad.hashResolucion = hashResolucion.toLowerCase();
    nulidad.fechaResolucion = getTxTimestampIso(ctx);
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(nulidad)));
    return JSON.stringify(nulidad);
  }
}

module.exports = { CustodiaContract };
