const test = require("node:test");
const assert = require("node:assert/strict");
const { ActaContract, sha256 } = require("../src/actaContract");
const { CustodiaContract } = require("../src/custodiaContract");

function makeContext(role = "OPERADOR_ODPE", msp = "ONPEMSP", jee = null, sharedState = null) {
  const state = sharedState || new Map();
  return {
    clientIdentity: {
      getMSPID: () => msp,
      getAttributeValue: name => {
        if (name === "role") return role;
        if (name === "jee") return jee;
        return null;
      },
      getID: () => `certificate:${msp}:${role}`
    },
    stub: {
      getTxID: () => "tx-test-" + Math.random().toString(36).slice(2, 8),
      getTxTimestamp: () => ({ seconds: 1700000000 }),
      getState: async key => state.get(key),
      putState: async (key, value) => state.set(key, value),
      setEvent: () => {}
    },
    _state: state
  };
}

test("P-04: rechaza registro sin rol autorizado (R1)", async () => {
  const contract = new ActaContract();
  await assert.rejects(
    () => contract.registrarActa(makeContext("OPERADOR_ODPE", "JNEMSP"), "079168-10", "PRES", "220901", "a".repeat(64), "b".repeat(64), '{"P1":100}', "100"),
    /Acceso denegado/
  );
  await assert.rejects(
    () => contract.registrarActa(makeContext("AUDITOR_NODO", "RENIECMSP"), "079168-10", "PRES", "220901", "a".repeat(64), "b".repeat(64), '{"P1":100}', "100"),
    /Acceso denegado/
  );
});

test("P-01: registra acta válida y detecta duplicado (R2, R3, R4)", async () => {
  const contract = new ActaContract();
  const ctx = makeContext();
  const hash = sha256("acta");
  const args = ["079168-10", "PRES", "220901", hash, hash, '{"P1":60,"BLANCOS":20,"NULOS":20}', "100"];
  const res = JSON.parse(await contract.registrarActa(ctx, ...args));
  assert.equal(res.estado, "REGISTRADA");
  assert.equal(res.jee, "JEE-22");
  await assert.rejects(() => contract.registrarActa(ctx, ...args), /ya fue registrada/);
});

test("R4: marca observada un acta aritmética inválida o que supera electores hábiles", async () => {
  const contract = new ActaContract();
  const ctx = makeContext();
  const hash = sha256("acta");
  const result = await contract.registrarActa(ctx, "079168-11", "PRES", "220901", hash, hash, '{"P1":40}', "100");
  assert.equal(JSON.parse(result).estado, "OBSERVADA");
  assert.equal(JSON.parse(result).motivoObservacion, "ERROR_ARITMETICO");
});

test("R5 y R8: contabilizarActa transiciona REGISTRADA -> CONTABILIZADA", async () => {
  const contract = new ActaContract();
  const state = new Map();
  const hash = sha256("acta");
  await contract.registrarActa(makeContext("OPERADOR_ODPE", "ONPEMSP", null, state), "079168-12", "PRES", "150101", hash, hash, '{"P1":80,"BLANCOS":10,"NULOS":10}', "100");
  const cont = JSON.parse(await contract.contabilizarActa(makeContext("SUPERVISOR_COMPUTO", "ONPEMSP", null, state), "079168-12", "PRES"));
  assert.equal(cont.estado, "CONTABILIZADA");
  assert.equal(cont.historial.length, 2);
});

test("R6 y R10: recuento exige competencia JEE y conserva votosAnteriores", async () => {
  const contract = new ActaContract();
  const state = new Map();
  const hash = sha256("acta-obs");
  await contract.registrarActa(makeContext("OPERADOR_ODPE", "ONPEMSP", null, state), "079168-13", "PRES", "220901", hash, hash, '{"P1":40}', "100");

  // JEE de otra jurisdicción debe fallar (R6)
  await assert.rejects(
    () => contract.recuento(makeContext("JEE_MAGISTRADO", "JNEMSP", "JEE-15", state), "079168-13", "PRES", '{"P1":90,"BLANCOS":10}', "100", sha256("recuento")),
    /Competencia denegada/
  );

  // JEE competente (JEE-22) realiza recuento
  const rec = JSON.parse(await contract.recuento(makeContext("JEE_MAGISTRADO", "JNEMSP", "JEE-22", state), "079168-13", "PRES", '{"P1":90,"BLANCOS":10}', "100", sha256("recuento")));
  assert.equal(rec.estado, "CONTABILIZADA");
  assert.deepEqual(rec.votosAnteriores, { P1: 40 });
  assert.deepEqual(rec.votos, { P1: 90, BLANCOS: 10 });
});

test("R9: proclamación bloqueada si hay actas OBSERVADA y calcula raíz de Merkle cuando todas están cerradas", async () => {
  const contract = new ActaContract();
  const state = new Map();
  const hash = sha256("acta-m");
  await contract.registrarActa(makeContext("OPERADOR_ODPE", "ONPEMSP", null, state), "079168-20", "PRES", "150101", hash, hash, '{"P1":100}', "100");
  await contract.registrarActa(makeContext("OPERADOR_ODPE", "ONPEMSP", null, state), "079168-21", "PRES", "150101", hash, hash, '{"P1":50}', "100"); // OBSERVADA

  await contract.contabilizarActa(makeContext("SUPERVISOR_COMPUTO", "ONPEMSP", null, state), "079168-20", "PRES");

  // Debe fallar porque 079168-21 sigue OBSERVADA
  await assert.rejects(
    () => contract.proclamar(makeContext("JNE_PLENO", "JNEMSP", null, state), "NACIONAL", "PRES", '["079168-20","079168-21"]'),
    /Proclamación bloqueada/
  );

  // Resolvemos 079168-21 y proclamamos
  await contract.resolverActa(makeContext("JEE_MAGISTRADO", "JNEMSP", "JEE-15", state), "079168-21", "PRES", "RES-001", sha256("res"), "CONTABILIZADA");
  const proc = JSON.parse(await contract.proclamar(makeContext("JNE_PLENO", "JNEMSP", null, state), "NACIONAL", "PRES", '["079168-20","079168-21"]'));
  assert.equal(proc.totalActas, 2);
  assert.match(proc.raizMerkle, /^[a-f0-9]{64}$/);
  assert.equal(proc.totales.P1, 150);
});

test("CustodiaContract: constancia de personero y nulidad dentro de plazo (R7)", async () => {
  const custodia = new CustodiaContract();
  const state = new Map();
  const c = JSON.parse(await custodia.registrarConstancia(
    makeContext("PERSONERO", "JNEMSP", null, state),
    "079168-10", "PRES", sha256("copia"), '{"P1":60}', "PARTIDO_A"
  ));
  assert.equal(c.organizacion, "PARTIDO_A");

  await assert.rejects(
    () => custodia.registrarNulidad(makeContext("PERSONERO", "JNEMSP", null, state), "079168-10", "PRES", sha256("escrito"), "Suplantación", 4),
    /Plazo vencido/
  );

  const n = JSON.parse(await custodia.registrarNulidad(
    makeContext("JEE_SECRETARIO", "JNEMSP", null, state),
    "079168-10", "PRES", sha256("escrito"), "Error grave", 2
  ));
  assert.equal(n.estado, "PRESENTADA");
});
