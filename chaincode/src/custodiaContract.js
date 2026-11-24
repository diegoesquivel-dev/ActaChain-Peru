const { Contract } = require("fabric-contract-api");

class CustodiaContract extends Contract {
  async registrarConstancia(ctx, idActa, tipoEleccion, hashCopia, votosJson, organizacion) {
    const identity = ctx.clientIdentity;
    if (identity.getMSPID() !== "JNEMSP" || identity.getAttributeValue("role") !== "PERSONERO") {
      throw new Error("Acceso denegado: se requiere credencial de personero");
    }
    if (!/^[a-f0-9]{64}$/i.test(hashCopia)) throw new Error("Hash de copia inválido");
    const key = `CONSTANCIA:${tipoEleccion}:${idActa}:${organizacion}`;
    const constancia = {
      idActa,
      tipoEleccion,
      hashCopia: hashCopia.toLowerCase(),
      votos: typeof votosJson === "string" ? JSON.parse(votosJson) : votosJson,
      organizacion,
      firmante: identity.getID(),
      fecha: ctx.stub.getTxTimestamp ? new Date(ctx.stub.getTxTimestamp().seconds * 1000).toISOString() : new Date().toISOString()
    };
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(constancia)));
    return JSON.stringify(constancia);
  }
}

module.exports = { CustodiaContract };
