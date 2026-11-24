"use strict";

const crypto = require("crypto");
const { Contract } = require("fabric-contract-api");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isSha256Hex(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function computeMerkleRoot(hashes) {
  if (!hashes || hashes.length === 0) return sha256("");
  let level = [...hashes].sort();
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(sha256(left + right));
    }
    level = next;
  }
  return level[0];
}

function getTxTimestampIso(ctx) {
  return ctx.stub.getTxTimestamp
    ? new Date(ctx.stub.getTxTimestamp().seconds * 1000).toISOString()
    : new Date().toISOString();
}

function assertJeeCompetencia(identity, actaJee) {
  const certJee = identity.getAttributeValue("jee");
  if (certJee && certJee !== actaJee) {
    throw new Error(`Competencia denegada (R6): certificado ${certJee} no corresponde a ${actaJee}`);
  }
}

class ActaContract extends Contract {
  async registrarActa(ctx, idActa, tipoEleccion, ubigeo, hashImagen, hashDatos, votosJson, emitidos, electoresHabiles = 300) {
    const identity = ctx.clientIdentity;
    const mspId = identity.getMSPID();
    const role = identity.getAttributeValue("role");

    if (mspId !== "ONPEMSP" || role !== "OPERADOR_ODPE") {
      throw new Error("Acceso denegado: se requiere ONPEMSP / OPERADOR_ODPE");
    }
    if (!isSha256Hex(hashImagen) || !isSha256Hex(hashDatos)) {
      throw new Error("Hash inválido: se requiere SHA-256 hexadecimal");
    }
    if (!idActa || !tipoEleccion || !ubigeo) {
      throw new Error("Datos obligatorios incompletos: idActa, tipoEleccion y ubigeo");
    }

    const key = `ACTA:${tipoEleccion}:${idActa}`;
    const existing = await ctx.stub.getState(key);
    if (existing && existing.length) throw new Error("El acta ya fue registrada");

    const votos = typeof votosJson === "string" ? JSON.parse(votosJson) : votosJson;
    const emitidosNumber = Number(emitidos);
    const habilesNumber = Number(electoresHabiles);
    const sumVotes = Object.values(votos).reduce((sum, value) => sum + Number(value), 0);
    const jee = "JEE-" + String(ubigeo).slice(0, 2);
    const aritmeticaValida = sumVotes === emitidosNumber && emitidosNumber <= habilesNumber;
    const state = aritmeticaValida ? "REGISTRADA" : "OBSERVADA";

    const acta = {
      idActa,
      tipoEleccion,
      ubigeo,
      jee,
      hashImagen: hashImagen.toLowerCase(),
      hashDatos: hashDatos.toLowerCase(),
      votos,
      emitidos: emitidosNumber,
      electoresHabiles: habilesNumber,
      estado: state,
      motivoObservacion: state === "OBSERVADA" ? "ERROR_ARITMETICO" : null,
      firmante: identity.getID(),
      msp: mspId,
      fechaRegistro: getTxTimestampIso(ctx),
      historial: []
    };

    acta.historial.push({
      evento: "ACTA_REGISTRADA",
      estado: state,
      txId: ctx.stub.getTxID(),
      fecha: acta.fechaRegistro
    });
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(acta)));
    ctx.stub.setEvent("ActaEvent", Buffer.from(JSON.stringify({ idActa, tipoEleccion, estado: state })));
    return JSON.stringify(acta);
  }

  async contabilizarActa(ctx, idActa, tipoEleccion) {
    const identity = ctx.clientIdentity;
    const mspId = identity.getMSPID();
    const role = identity.getAttributeValue("role");
    const allowed =
      (mspId === "ONPEMSP" && role === "SUPERVISOR_COMPUTO") ||
      (mspId === "JNEMSP" && role === "JEE_MAGISTRADO");
    if (!allowed) {
      throw new Error("Acceso denegado: se requiere SUPERVISOR_COMPUTO o JEE_MAGISTRADO con endoso ONPE AND JNE");
    }

    const key = `ACTA:${tipoEleccion}:${idActa}`;
    const data = await ctx.stub.getState(key);
    if (!data || !data.length) throw new Error("Acta no encontrada");
    const acta = JSON.parse(data.toString());
    if (acta.estado !== "REGISTRADA") {
      throw new Error("Transición inválida (R5): solo un acta REGISTRADA puede pasar a CONTABILIZADA");
    }

    const fecha = getTxTimestampIso(ctx);
    acta.estado = "CONTABILIZADA";
    acta.historial.push({
      evento: "ACTA_CONTABILIZADA",
      estado: "CONTABILIZADA",
      txId: ctx.stub.getTxID(),
      fecha
    });
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(acta)));
    ctx.stub.setEvent("ActaEvent", Buffer.from(JSON.stringify({ idActa, tipoEleccion, estado: "CONTABILIZADA" })));
    return JSON.stringify(acta);
  }

  async observarActa(ctx, idActa, tipoEleccion, motivo = "OTRO") {
    const identity = ctx.clientIdentity;
    if (identity.getMSPID() !== "ONPEMSP" || identity.getAttributeValue("role") !== "SUPERVISOR_COMPUTO") {
      throw new Error("Acceso denegado: se requiere ONPEMSP / SUPERVISOR_COMPUTO");
    }

    const key = `ACTA:${tipoEleccion}:${idActa}`;
    const data = await ctx.stub.getState(key);
    if (!data || !data.length) throw new Error("Acta no encontrada");
    const acta = JSON.parse(data.toString());
    if (acta.estado !== "REGISTRADA") {
      throw new Error("Transición inválida (R5): solo un acta REGISTRADA puede marcarse como OBSERVADA");
    }

    const fecha = getTxTimestampIso(ctx);
    acta.estado = "OBSERVADA";
    acta.motivoObservacion = motivo;
    acta.jeeAsignado = acta.jee;
    acta.historial.push({
      evento: "ACTA_OBSERVADA",
      estado: "OBSERVADA",
      motivo,
      txId: ctx.stub.getTxID(),
      fecha
    });
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(acta)));
    ctx.stub.setEvent("ActaEvent", Buffer.from(JSON.stringify({ idActa, tipoEleccion, estado: "OBSERVADA" })));
    return JSON.stringify(acta);
  }

  async registrarEjemplarJEE(ctx, idActa, tipoEleccion, hashImagenJEE, hashDatosJEE) {
    const identity = ctx.clientIdentity;
    if (identity.getMSPID() !== "JNEMSP" || identity.getAttributeValue("role") !== "JEE_SECRETARIO") {
      throw new Error("Acceso denegado: se requiere JNEMSP / JEE_SECRETARIO");
    }
    if (!isSha256Hex(hashImagenJEE) || !isSha256Hex(hashDatosJEE)) {
      throw new Error("Hash de ejemplar JEE inválido");
    }

    const key = `ACTA:${tipoEleccion}:${idActa}`;
    const data = await ctx.stub.getState(key);
    if (!data || !data.length) throw new Error("Acta no encontrada");
    const acta = JSON.parse(data.toString());
    assertJeeCompetencia(identity, acta.jee);

    const fecha = getTxTimestampIso(ctx);
    acta.hashEjemplarJEE = hashImagenJEE.toLowerCase();
    acta.hashDatosJEE = hashDatosJEE.toLowerCase();
    acta.cotejoCoincide = acta.hashEjemplarJEE === acta.hashImagen && acta.hashDatosJEE === acta.hashDatos;
    acta.historial.push({
      evento: "EJEMPLAR_JEE_REGISTRADO",
      estado: acta.estado,
      cotejoCoincide: acta.cotejoCoincide,
      txId: ctx.stub.getTxID(),
      fecha
    });
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(acta)));
    return JSON.stringify(acta);
  }

  async resolverActa(ctx, idActa, tipoEleccion, nroResolucion, hashResolucion, decision = "CONTABILIZADA") {
    const identity = ctx.clientIdentity;
    const role = identity.getAttributeValue("role");
    if (identity.getMSPID() !== "JNEMSP" || (role !== "JEE_MAGISTRADO" && role !== "JNE_PLENO")) {
      throw new Error("Acceso denegado: se requiere JNEMSP / JEE_MAGISTRADO o JNE_PLENO");
    }
    if (!isSha256Hex(hashResolucion)) throw new Error("Hash de resolución inválido");

    const key = `ACTA:${tipoEleccion}:${idActa}`;
    const data = await ctx.stub.getState(key);
    if (!data || !data.length) throw new Error("Acta no encontrada");
    const acta = JSON.parse(data.toString());
    if (role === "JEE_MAGISTRADO") assertJeeCompetencia(identity, acta.jee);
    if (acta.estado !== "OBSERVADA") {
      throw new Error("Transición inválida (R5): solo se resuelve un acta OBSERVADA");
    }

    const finalState = decision === "ANULADA" ? "ANULADA" : "CONTABILIZADA";
    const fecha = getTxTimestampIso(ctx);
    acta.refResolucion = `${nroResolucion}:${hashResolucion.toLowerCase()}`;
    acta.estado = finalState;
    acta.historial.push({
      evento: "RESOLUCION_JEE",
      estado: finalState,
      nroResolucion,
      txId: ctx.stub.getTxID(),
      fecha
    });
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(acta)));
    ctx.stub.setEvent("ActaEvent", Buffer.from(JSON.stringify({ idActa, tipoEleccion, estado: finalState })));
    return JSON.stringify(acta);
  }

  async consultarActa(ctx, idActa, tipoEleccion) {
    const data = await ctx.stub.getState(`ACTA:${tipoEleccion}:${idActa}`);
    if (!data || !data.length) throw new Error("Acta no encontrada");
    return data.toString();
  }

  async recuento(ctx, idActa, tipoEleccion, votosJson, emitidos, hashActaRecuento, electoresHabiles = 300) {
    const identity = ctx.clientIdentity;
    if (identity.getMSPID() !== "JNEMSP" || identity.getAttributeValue("role") !== "JEE_MAGISTRADO") {
      throw new Error("Acceso denegado: se requiere JNEMSP / JEE_MAGISTRADO");
    }
    if (!isSha256Hex(hashActaRecuento)) throw new Error("Hash de recuento inválido");

    const key = `ACTA:${tipoEleccion}:${idActa}`;
    const data = await ctx.stub.getState(key);
    if (!data || !data.length) throw new Error("Acta no encontrada");
    const acta = JSON.parse(data.toString());
    assertJeeCompetencia(identity, acta.jee);
    if (acta.estado !== "OBSERVADA") throw new Error("Solo se recuenta un acta OBSERVADA");

    const votos = typeof votosJson === "string" ? JSON.parse(votosJson) : votosJson;
    const emitidosNumber = Number(emitidos);
    const habilesNumber = acta.electoresHabiles || Number(electoresHabiles);
    const sumVotes = Object.values(votos).reduce((sum, value) => sum + Number(value), 0);
    if (sumVotes !== emitidosNumber || emitidosNumber > habilesNumber) {
      throw new Error("El recuento no cumple la regla aritmética");
    }

    const fecha = getTxTimestampIso(ctx);
    acta.votosAnteriores = acta.votos;
    acta.votos = votos;
    acta.emitidos = emitidosNumber;
    acta.hashRecuento = hashActaRecuento.toLowerCase();
    acta.estado = "CONTABILIZADA";
    acta.historial.push({ evento: "RECUENTO_REGISTRADO", estado: acta.estado, txId: ctx.stub.getTxID(), fecha });
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(acta)));
    ctx.stub.setEvent("ActaEvent", Buffer.from(JSON.stringify({ idActa, tipoEleccion, estado: acta.estado })));
    return JSON.stringify(acta);
  }

  async proclamar(ctx, ambito, tipoEleccion, actasIdsJson) {
    const identity = ctx.clientIdentity;
    const role = identity.getAttributeValue("role");
    if (identity.getMSPID() !== "JNEMSP" || (role !== "JEE_MAGISTRADO" && role !== "JNE_PLENO")) {
      throw new Error("Acceso denegado: se requiere JNEMSP / JEE_MAGISTRADO o JNE_PLENO");
    }

    const actasIds = typeof actasIdsJson === "string" ? JSON.parse(actasIdsJson) : actasIdsJson;
    if (!Array.isArray(actasIds) || actasIds.length === 0) {
      throw new Error("Se requiere al menos un acta para proclamar");
    }

    const hashes = [];
    const totales = {};
    for (const idActa of actasIds) {
      const data = await ctx.stub.getState(`ACTA:${tipoEleccion}:${idActa}`);
      if (!data || !data.length) throw new Error(`Acta no encontrada: ${idActa}`);
      const acta = JSON.parse(data.toString());
      if (acta.estado === "OBSERVADA" || acta.estado === "REGISTRADA") {
        throw new Error(`Proclamación bloqueada (R9): el acta ${idActa} sigue en estado ${acta.estado}`);
      }
      hashes.push(sha256(`${acta.idActa}:${acta.hashImagen}:${acta.hashDatos}:${acta.estado}`));
      if (acta.estado === "CONTABILIZADA") {
        for (const [k, v] of Object.entries(acta.votos || {})) {
          totales[k] = (totales[k] || 0) + Number(v);
        }
      }
    }

    const raizMerkle = computeMerkleRoot(hashes);
    const fecha = getTxTimestampIso(ctx);
    const proclamacion = {
      ambito,
      tipoEleccion,
      totalActas: actasIds.length,
      raizMerkle,
      totales,
      firmante: identity.getID(),
      fecha,
      txId: ctx.stub.getTxID()
    };

    await ctx.stub.putState(`PROCLAMACION:${tipoEleccion}:${ambito}`, Buffer.from(JSON.stringify(proclamacion)));
    ctx.stub.setEvent("ProclamacionEvent", Buffer.from(JSON.stringify(proclamacion)));
    return JSON.stringify(proclamacion);
  }

  async consultarProclamacion(ctx, ambito, tipoEleccion) {
    const data = await ctx.stub.getState(`PROCLAMACION:${tipoEleccion}:${ambito}`);
    if (!data || !data.length) throw new Error("Proclamación no encontrada");
    return data.toString();
  }
}

module.exports = { ActaContract, sha256, computeMerkleRoot };
