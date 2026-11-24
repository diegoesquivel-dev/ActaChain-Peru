const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { app, ready, resetToInitial } = require("../src/server");

const sha256 = v => crypto.createHash("sha256").update(v).digest("hex");

async function startTestServer() {
  await ready;
  await resetToInitial();
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { server, baseUrl };
}

test("health y especificación OpenAPI 3.0 existen (RNF10)", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, "ok");

    const spec = await fetch(`${baseUrl}/api/openapi.json`);
    assert.equal(spec.status, 200);
    const json = await spec.json();
    assert.equal(json.openapi, "3.0.3");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("P-01: registro válido (REGISTRADA) y descuadre aritmético pasa a OBSERVADA sin rechazarse (R4)", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    // Registro válido
    const resOk = await fetch(`${baseUrl}/api/actas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-role": "OPERADOR_ODPE", "x-demo-msp": "ONPEMSP" },
      body: JSON.stringify({
        idActa: "079168-90",
        tipoEleccion: "PRES",
        ubigeo: "150101",
        departamento: "Lima",
        provincia: "Lima",
        distrito: "Miraflores",
        localVotacion: "IE Juana Alarco",
        hashImagen: sha256("img-90"),
        hashDatos: sha256("data-90"),
        votos: { C1: 50, C2: 40, BLANCOS: 5, NULOS: 5 },
        candidatos: [{ nombre: "Organización 1", votos: 50 }, { nombre: "Organización 2", votos: 40 }],
        emitidos: 100
      })
    });
    assert.equal(resOk.status, 201);
    const actaOk = await resOk.json();
    assert.equal(actaOk.estado, "REGISTRADA");
    assert.ok(actaOk.historial[0].txId);

    // Registro con error aritmético -> OBSERVADA (R4, RF03)
    const resObs = await fetch(`${baseUrl}/api/actas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-role": "OPERADOR_ODPE" },
      body: JSON.stringify({
        idActa: "079168-91",
        tipoEleccion: "PRES",
        ubigeo: "220901",
        hashImagen: sha256("img-91"),
        hashDatos: sha256("data-91"),
        votos: { C1: 30, C2: 20, BLANCOS: 5, NULOS: 5 },
        emitidos: 99
      })
    });
    assert.equal(resObs.status, 201);
    const actaObs = await resObs.json();
    assert.equal(actaObs.estado, "OBSERVADA");
    assert.equal(actaObs.motivoObservacion, "ERROR_ARITMETICO");
    assert.equal(actaObs.jeeAsignado, "JEE-22");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("P-02: consulta pública del acta 079168-10 sin credenciales muestra votos, hashes e historial", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const response = await fetch(`${baseUrl}/api/actas/PRES/079168-10`);
    assert.equal(response.status, 200);
    const acta = await response.json();
    assert.equal(acta.idActa, "079168-10");
    assert.match(acta.hashImagen, /^[a-f0-9]{64}$/);
    assert.match(acta.hashDatos, /^[a-f0-9]{64}$/);
    assert.ok(Array.isArray(acta.historial) && acta.historial.length >= 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("P-03 y P-05: verificación local SHA-256 con PDF oficial, detección de alteración y constancia exportable (RF09, RF10)", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const pdfRes = await fetch(`${baseUrl}/evidence/Acta-079168-10.pdf`);
    assert.equal(pdfRes.status, 200);
    const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
    const localHash = sha256(pdfBuf);

    // P-03: coincidencia exacta
    const verifyOk = await fetch(`${baseUrl}/api/verify/sha256`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: localHash, idActa: "079168-10", tipoEleccion: "PRES" })
    });
    assert.equal(verifyOk.status, 200);
    assert.equal((await verifyOk.json()).verified, true);

    // P-05: alteración de 1 byte en copia local
    const alteredBuf = Buffer.from(pdfBuf);
    alteredBuf[0] = alteredBuf[0] ^ 0xff;
    const alteredHash = sha256(alteredBuf);

    const verifyBad = await fetch(`${baseUrl}/api/verify/sha256`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: alteredHash, idActa: "079168-10", tipoEleccion: "PRES" })
    });
    assert.equal(verifyBad.status, 200);
    assert.equal((await verifyBad.json()).verified, false);

    // RF10: exportación de constancia criptográfica firmada
    const evRes = await fetch(`${baseUrl}/api/actas/PRES/079168-10/constancia-evidencia?hashArchivo=${alteredHash}`);
    assert.equal(evRes.status, 200);
    const ev = await evRes.json();
    assert.equal(ev.coincide, false);
    assert.match(ev.selloIntegridad, /^[a-f0-9]{64}$/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("P-04: bloqueo de escritura para roles sin privilegios y competencia JEE (R1, R6)", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    // Rol solo lectura RENIECMSP
    const forbidden = await fetch(`${baseUrl}/api/actas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-role": "AUDITOR_NODO", "x-demo-msp": "RENIECMSP" },
      body: JSON.stringify({
        idActa: "079168-99",
        tipoEleccion: "PRES",
        hashImagen: sha256("x"),
        hashDatos: sha256("y"),
        votos: { P1: 100 },
        emitidos: 100
      })
    });
    assert.equal(forbidden.status, 403);

    // Competencia territorial JEE distinta (R6)
    const wrongJee = await fetch(`${baseUrl}/api/actas/PRES/079168-11/recuento`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-role": "JEE_MAGISTRADO", "x-demo-jee": "JEE-15" },
      body: JSON.stringify({
        votos: { P1: 50, P2: 40, BLANCOS: 5, NULOS: 5 },
        emitidos: 100,
        hashActaRecuento: sha256("recuento")
      })
    });
    assert.equal(wrongJee.status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("Ciclo TO-BE completo: contabilizar, recuento, constancia, nulidad, proclamación Merkle (R9) y outbox (RNF04)", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    // Proclamación debe bloquearse inicialmente porque 079168-10 es REGISTRADA y 079168-11 es OBSERVADA
    const procBlocked = await fetch(`${baseUrl}/api/proclamacion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-role": "JNE_PLENO" },
      body: JSON.stringify({ ambito: "NACIONAL", tipoEleccion: "PRES" })
    });
    assert.equal(procBlocked.status, 409);

    // Constancia de personero sobre 079168-10
    const constRes = await fetch(`${baseUrl}/api/actas/PRES/079168-10/constancia`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-role": "PERSONERO" },
      body: JSON.stringify({ organizacion: "PARTIDO_DEMOCRATICO", hashCopia: sha256("copia-fisica"), votosCopia: { P1: 60 } })
    });
    assert.equal(constRes.status, 201);

    // Contabilizar 079168-10 (endoso ONPE + JNE)
    const contRes = await fetch(`${baseUrl}/api/actas/PRES/079168-10/contabilizar`, {
      method: "POST",
      headers: { "x-demo-role": "SUPERVISOR_COMPUTO" }
    });
    assert.equal(contRes.status, 200);
    assert.equal((await contRes.json()).estado, "CONTABILIZADA");

    // Recuento sobre 079168-11 por JEE-22 competente
    const recRes = await fetch(`${baseUrl}/api/actas/PRES/079168-11/recuento`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-role": "JEE_MAGISTRADO", "x-demo-jee": "JEE-22" },
      body: JSON.stringify({
        votos: { P1: 45, P2: 45, BLANCOS: 5, NULOS: 5 },
        emitidos: 100,
        hashActaRecuento: sha256("recuento-079168-11")
      })
    });
    assert.equal(recRes.status, 200);
    const recActa = await recRes.json();
    assert.equal(recActa.estado, "CONTABILIZADA");
    assert.equal(recActa.votosAnteriores.P1, 40);

    // Nulidad fuera de plazo (> 3 días) rechazada (R7)
    const nulLate = await fetch(`${baseUrl}/api/actas/PRES/079168-10/nulidad`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-role": "PERSONERO" },
      body: JSON.stringify({ motivo: "Fuera de plazo", hashEscrito: sha256("nul"), diasDesdeJornada: 5 })
    });
    assert.equal(nulLate.status, 409);

    // Ahora sí procede la proclamación con raíz de Merkle (R9)
    const procOk = await fetch(`${baseUrl}/api/proclamacion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-role": "JNE_PLENO" },
      body: JSON.stringify({ ambito: "NACIONAL", tipoEleccion: "PRES" })
    });
    assert.equal(procOk.status, 201);
    const proc = await procOk.json();
    assert.match(proc.raizMerkle, /^[a-f0-9]{64}$/);
    assert.equal(proc.totalActas, 3);

    // Outbox RNF04
    const enq = await fetch(`${baseUrl}/api/outbox/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evento: "ACTA_REGISTRADA", idActa: "079168-95" })
    });
    assert.equal(enq.status, 202);
    const flush = await fetch(`${baseUrl}/api/outbox/flush`, { method: "POST" });
    assert.equal(flush.status, 200);
    assert.equal((await flush.json()).procesados, 1);
  } finally {
    await resetToInitial();
    await new Promise(resolve => server.close(resolve));
  }
});
