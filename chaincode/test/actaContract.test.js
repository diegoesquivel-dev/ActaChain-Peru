const test = require("node:test");
const assert = require("node:assert/strict");
const { ActaContract, sha256 } = require("../src/actaContract");

function makeContext(role = "OPERADOR_ODPE", msp = "ONPEMSP") {
  const state = new Map();
  return {
    clientIdentity: {
      getMSPID: () => msp,
      getAttributeValue: name => name === "role" ? role : null,
      getID: () => "certificate:test"
    },
    stub: {
      getTxID: () => "tx-test",
      getTxTimestamp: () => ({ seconds: 1 }),
      getState: async key => state.get(key),
      putState: async (key, value) => state.set(key, value),
      setEvent: () => {}
    }
  };
}

test("rechaza registro sin rol autorizado", async () => {
  const contract = new ActaContract();
  await assert.rejects(
    () => contract.registrarActa(makeContext("OPERADOR_ODPE", "JNEMSP"), "079168-10", "PRES", "220901", "a".repeat(64), "b".repeat(64), '{"P1":100}', "100"),
    /Acceso denegado/
  );
});

test("registra acta válida y detecta duplicado", async () => {
  const contract = new ActaContract();
  const ctx = makeContext();
  const hash = sha256("acta");
  const args = ["079168-10", "PRES", "220901", hash, hash, '{"P1":60,"BLANCOS":20,"NULOS":20}', "100"];
  await contract.registrarActa(ctx, ...args);
  await assert.rejects(() => contract.registrarActa(ctx, ...args), /ya fue registrada/);
});

test("marca observada una acta aritmética inválida", async () => {
  const contract = new ActaContract();
  const ctx = makeContext();
  const hash = sha256("acta");
  const result = await contract.registrarActa(ctx, "079168-11", "PRES", "220901", hash, hash, '{"P1":40}', "100");
  assert.equal(JSON.parse(result).estado, "OBSERVADA");
});
