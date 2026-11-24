const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// Seguridad de cabecera y limitación de tasa en API Gateway (RNF05 / Cap. 5)
const rateLimits = new Map();
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  if (!req.path.startsWith("/api/")) return next();
  const ip = req.ip || "local";
  const now = Date.now();
  const windowMs = 60_000;
  const maxReq = Number(process.env.RATE_LIMIT_MAX || 300);
  const entry = rateLimits.get(ip);
  if (!entry || now - entry.start > windowMs) {
    rateLimits.set(ip, { start: now, count: 1 });
    return next();
  }
  entry.count += 1;
  if (entry.count > maxReq) {
    return res.status(429).json({ error: "Límite de consultas excedido en API Gateway" });
  }
  next();
});

const dataDir = path.join(__dirname, "../data");
const dataFile = path.join(dataDir, "database.json");
const evidenceDir = path.join(__dirname, "../evidence");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });

const officialText = fs.readFileSync(path.join(__dirname, "../../portal-web/demo/acta_079168-10.html"));
const officialHash = crypto.createHash("sha256").update(officialText).digest("hex");

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

const initialDatabase = {
  bloques: [
    { numero: 1, txId: "tx-demo-genesis", evento: "CANAL_CREADO", fecha: "2026-11-20T10:00:00Z" },
    { numero: 2, txId: "tx-demo-001", evento: "ACTA_REGISTRADA", acta: "079168-10", fecha: "2026-11-23T21:17:34Z" },
    { numero: 3, txId: "tx-demo-002", evento: "ACTA_OBSERVADA", acta: "079168-11", fecha: "2026-11-23T21:18:10Z" },
    { numero: 4, txId: "tx-demo-003", evento: "ACTA_CONTABILIZADA", acta: "079168-12", fecha: "2026-11-23T21:20:10Z" }
  ],
  actas: [
    {
      idActa: "079168-10", tipoEleccion: "PRES", ubigeo: "220901",
      departamento: "Lima", provincia: "Lima", distrito: "San Borja",
      localVotacion: "IE 0015 San Juan", mesa: "079168",
      jee: "JEE-22",
      hashImagen: officialHash,
      hashDatos: sha256('{"P1":60,"P2":30,"BLANCOS":5,"NULOS":5}'),
      votos: { P1: 60, P2: 30, BLANCOS: 5, NULOS: 5 }, emitidos: 100, electoresHabiles: 300,
      candidatos: [
        { nombre: "Organización 1", votos: 60 },
        { nombre: "Organización 2", votos: 30 }
      ],
      documento: { nombre: "acta_079168-10.html", url: "/demo/acta_079168-10.html", tipo: "text/html" },
      estado: "REGISTRADA", firmante: "CN=OPERADOR_ODPE", msp: "ONPEMSP",
      endosos: ["ONPEMSP"],
      fechaRegistro: "2026-11-23T21:17:34Z",
      historial: [{ evento: "ACTA_REGISTRADA", estado: "REGISTRADA", txId: "tx-demo-001", bloque: 2, fecha: "2026-11-23T21:17:34Z" }]
    },
    {
      idActa: "079168-11", tipoEleccion: "PRES", ubigeo: "220901",
      departamento: "Lima", provincia: "Lima", distrito: "San Borja",
      localVotacion: "IE 0015 San Juan", mesa: "079168",
      jee: "JEE-22",
      hashImagen: sha256("acta oficial observada"),
      hashDatos: sha256('{"P1":40,"P2":50,"BLANCOS":5,"NULOS":5}'),
      votos: { P1: 40, P2: 50, BLANCOS: 5, NULOS: 5 }, emitidos: 105, electoresHabiles: 300,
      candidatos: [
        { nombre: "Organización 1", votos: 40 },
        { nombre: "Organización 2", votos: 50 }
      ],
      documento: { nombre: "acta_079168-11.html", url: "/demo/acta_079168-11.html", tipo: "text/html" },
      estado: "OBSERVADA", motivoObservacion: "ERROR_ARITMETICO", jeeAsignado: "JEE-22",
      firmante: "CN=SUPERVISOR_COMPUTO", msp: "ONPEMSP",
      endosos: ["ONPEMSP"],
      fechaRegistro: "2026-11-23T21:18:10Z",
      historial: [{ evento: "ACTA_OBSERVADA", estado: "OBSERVADA", txId: "tx-demo-002", bloque: 3, fecha: "2026-11-23T21:18:10Z" }]
    },
    {
      idActa: "079168-12", tipoEleccion: "PRES", ubigeo: "150101",
      departamento: "Lima", provincia: "Lima", distrito: "Lima",
      localVotacion: "Colegio María Montenegro", mesa: "079168",
      jee: "JEE-15",
      hashImagen: sha256("acta contabilizada lima"),
      hashDatos: sha256('{"P1":45,"P2":42,"BLANCOS":8,"NULOS":5}'),
      votos: { P1: 45, P2: 42, BLANCOS: 8, NULOS: 5 }, emitidos: 100, electoresHabiles: 300,
      candidatos: [
        { nombre: "Organización 1", votos: 45 },
        { nombre: "Organización 2", votos: 42 }
      ],
      documento: { nombre: "acta_079168-12.html", url: "/demo/acta_079168-12.html", tipo: "text/html" },
      estado: "CONTABILIZADA", firmante: "CN=SUPERVISOR_COMPUTO", msp: "ONPEMSP",
      endosos: ["ONPEMSP", "JNEMSP"],
      fechaRegistro: "2026-11-23T21:20:10Z",
      historial: [{ evento: "ACTA_CONTABILIZADA", estado: "CONTABILIZADA", txId: "tx-demo-003", bloque: 4, fecha: "2026-11-23T21:20:10Z" }]
    }
  ],
  constancias: [],
  nulidades: [],
  proclamaciones: [],
  outbox: []
};

let database;
if (fs.existsSync(dataFile)) {
  database = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  database.constancias = database.constancias || [];
  database.nulidades = database.nulidades || [];
  database.proclamaciones = database.proclamaciones || [];
  database.outbox = database.outbox || [];
} else {
  database = structuredClone(initialDatabase);
  fs.writeFileSync(dataFile, JSON.stringify(database, null, 2));
}

database.actas = database.actas.map(acta => {
  if (acta.idActa === "079168-10") {
    return {
      ...acta,
      departamento: "Lima", provincia: "Lima", distrito: "San Borja",
      localVotacion: "IE 0015 San Juan", mesa: "079168",
      hashImagen: officialHash,
      candidatos: [{ nombre: "Organización 1", votos: acta.votos?.P1 ?? 0 }, { nombre: "Organización 2", votos: acta.votos?.P2 ?? 0 }],
      documento: { nombre: "Acta de escrutinio 079168-10.html", url: "/demo/acta_079168-10.html", tipo: "text/html" }
    };
  }
  if (!acta.departamento) {
    acta.departamento = "Lima";
    acta.provincia = "Lima";
    acta.distrito = acta.ubigeo === "150101" ? "Lima" : "San Borja";
    acta.localVotacion = acta.idActa === "079168-12" ? "Colegio María Montenegro" : "IE 0015 San Juan";
    acta.mesa = String(acta.idActa).slice(0, 6);
  }
  if (!acta.candidatos) {
    acta.candidatos = Object.entries(acta.votos || {})
      .filter(([name]) => name !== "BLANCOS" && name !== "NULOS")
      .map(([nombre, votos]) => ({ nombre: nombre === "P1" ? "Organización 1" : nombre === "P2" ? "Organización 2" : nombre, votos }));
  }
  if (!acta.documento) {
    acta.documento = {
      nombre: `Acta de escrutinio ${acta.idActa}.html`,
      url: `/demo/acta_${acta.idActa}.html`,
      tipo: "text/html"
    };
  }
  return acta;
});
saveDatabase();

function saveDatabase() {
  fs.writeFileSync(dataFile, JSON.stringify(database, null, 2));
}

function actaMapKey(acta) {
  return `${acta.tipoEleccion}:${acta.idActa}`;
}

const actas = new Map(database.actas.map(acta => [actaMapKey(acta), acta]));

function appendBlock(evento, idActa, extra = {}) {
  const numero = database.bloques.length + 1;
  const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const fecha = new Date().toISOString();
  const block = { numero, txId, evento, acta: idActa, fecha, ...extra };
  database.bloques.push(block);
  return block;
}

function createActaPdfBuffer(acta) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 36, layout: "portrait" });
    const chunks = [];
    pdf.on("data", chunk => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    const blue = "#063f9f";
    const red = "#e21d2f";
    const ink = "#1d2a44";
    pdf.rect(36, 36, 523, 72).fill("#ffffff").stroke("#063f9f");
    pdf.rect(36, 36, 8, 72).fill(red);
    pdf.fontSize(20).fillColor(blue).text("ONPE", 56, 48);
    pdf.fontSize(11).fillColor(ink).text("JURADO NACIONAL DE ELECCIONES", 56, 76);
    pdf.fontSize(12).fillColor(blue).text("ACTA DE ESCRUTINIO", 310, 48, { align: "right", width: 230 });
    pdf.fontSize(9).fillColor(ink).text(`ACTA N.º ${acta.idActa}`, 310, 68, { align: "right", width: 230 });
    pdf.text("DOCUMENTO GENERADO DIGITALMENTE", 310, 84, { align: "right", width: 230 });

    pdf.moveDown(4);
    const top = 128;
    const boxWidth = 523;
    pdf.fontSize(10).fillColor(blue).text("DATOS DE LA MESA", 36, top);
    pdf.rect(36, top + 18, boxWidth, 82).stroke("#b8c6d8");
    pdf.fontSize(9).fillColor(ink);
    pdf.text(`Departamento: ${acta.departamento || "-"}`, 48, top + 32);
    pdf.text(`Provincia: ${acta.provincia || "-"}`, 48, top + 50);
    pdf.text(`Distrito: ${acta.distrito || "-"}`, 48, top + 68);
    pdf.text(`Local de votación: ${acta.localVotacion || "-"}`, 250, top + 32);
    pdf.text(`Código geográfico: ${acta.ubigeo || "-"}`, 250, top + 50);
    pdf.text(`Tipo de elección: ${acta.tipoEleccion}`, 250, top + 68);

    const tableTop = top + 118;
    pdf.fontSize(10).fillColor(blue).text("RESULTADOS REGISTRADOS", 36, tableTop);
    const yHeader = tableTop + 18;
    pdf.rect(36, yHeader, boxWidth, 24).fill("#063f9f");
    pdf.fillColor("#ffffff").fontSize(9);
    pdf.text("N.º", 44, yHeader + 7, { width: 30 });
    pdf.text("Organización política / candidato", 82, yHeader + 7, { width: 310 });
    pdf.text("Votos", 430, yHeader + 7, { width: 100, align: "right" });

    let y = yHeader + 24;
    (acta.candidatos || []).forEach((item, index) => {
      if (y > 700) {
        pdf.addPage();
        y = 48;
      }
      pdf.rect(36, y, boxWidth, 20).fill(index % 2 ? "#eef3f8" : "#ffffff").stroke("#d8e0ea");
      pdf.fillColor(ink).fontSize(8);
      pdf.text(String(index + 1), 44, y + 6, { width: 30 });
      pdf.text(item.nombre, 82, y + 6, { width: 310 });
      pdf.text(String(item.votos), 430, y + 6, { width: 100, align: "right" });
      y += 20;
    });

    const totals = [
      ["Votos en blanco", acta.votos?.BLANCOS || 0],
      ["Votos nulos", acta.votos?.NULOS || 0],
      ...(acta.votos?.IMPUGNADOS ? [["Votos impugnados", acta.votos.IMPUGNADOS]] : []),
      ["TOTAL DE VOTOS EMITIDOS", acta.emitidos]
    ];
    totals.forEach((row, index) => {
      const isTotal = index === totals.length - 1;
      pdf.rect(36, y, boxWidth, 24).fill(isTotal ? "#dce8f8" : "#f7f9fc").stroke("#d8e0ea");
      pdf.fillColor(isTotal ? blue : ink).fontSize(isTotal ? 10 : 9);
      pdf.text(row[0], 82, y + 7, { width: 310 });
      pdf.text(String(row[1]), 430, y + 7, { width: 100, align: "right" });
      y += 24;
    });

    y += 28;
    if (y > 740) {
      pdf.addPage();
      y = 48;
    }
    pdf.fontSize(9).fillColor(ink).text("Observaciones", 36, y);
    pdf.rect(36, y + 16, boxWidth, 48).stroke("#b8c6d8");
    y += 78;
    pdf.fontSize(8).fillColor("#66758e");
    pdf.text("Firma del presidente de mesa", 48, y);
    pdf.text("Firma del secretario", 248, y);
    pdf.text("Firma del tercer miembro", 410, y);
    pdf.moveTo(48, y - 18).lineTo(210, y - 18).stroke("#66758e");
    pdf.moveTo(248, y - 18).lineTo(382, y - 18).stroke("#66758e");
    pdf.moveTo(410, y - 18).lineTo(548, y - 18).stroke("#66758e");
    pdf.fontSize(7).fillColor("#66758e").text(`Huella digital registrada: ${acta.hashImagen || "-"}`, 36, 790, { width: 523 });
    pdf.end();
  });
}

async function syncSeedPdfs() {
  for (const acta of database.actas) {
    if (!acta.candidatos) continue;
    const pdfBuffer = await createActaPdfBuffer(acta);
    const pdfName = `Acta-${acta.idActa}.pdf`;
    fs.writeFileSync(path.join(evidenceDir, pdfName), pdfBuffer);
    acta.hashImagen = sha256(pdfBuffer);
    acta.documento = { nombre: pdfName, url: `/evidence/${pdfName}`, tipo: "application/pdf" };
  }
  saveDatabase();
}

const ready = syncSeedPdfs();

async function resetToInitial() {
  database = structuredClone(initialDatabase);
  actas.clear();
  for (const acta of database.actas) {
    actas.set(actaMapKey(acta), acta);
  }
  await syncSeedPdfs();
}

app.post("/api/actas", async (req, res) => {
  const role = req.header("x-demo-role");
  const msp = req.header("x-demo-msp") || "ONPEMSP";
  if (role !== "OPERADOR_ODPE" || msp !== "ONPEMSP") {
    return res.status(403).json({ error: "Acceso denegado (R1): se requiere ONPEMSP / OPERADOR_ODPE" });
  }
  const {
    idActa, tipoEleccion, ubigeo = "150101", departamento, provincia, distrito, localVotacion,
    hashImagen, hashDatos, votos, candidatos, emitidos, electoresHabiles = 300
  } = req.body;
  if (!idActa || !tipoEleccion || !isSha256Hex(hashImagen) || !isSha256Hex(hashDatos)) {
    return res.status(400).json({ error: "Datos o hashes inválidos (R3)" });
  }
  const key = `${tipoEleccion}:${idActa}`;
  if (actas.has(key)) return res.status(409).json({ error: "El acta ya fue registrada (R2)" });

  const sum = Object.values(votos || {}).reduce((acc, value) => acc + Number(value), 0);
  const emitidosNum = Number(emitidos);
  const habilesNum = Number(electoresHabiles);
  const aritmeticaOk = sum === emitidosNum && emitidosNum <= habilesNum;
  const estado = aritmeticaOk ? "REGISTRADA" : "OBSERVADA";
  const jee = `JEE-${String(ubigeo).slice(0, 2)}`;
  const evento = estado === "OBSERVADA" ? "ACTA_OBSERVADA" : "ACTA_REGISTRADA";
  const block = appendBlock(evento, idActa);

  const acta = {
    idActa, tipoEleccion, ubigeo,
    departamento: departamento || "", provincia: provincia || "", distrito: distrito || "",
    localVotacion: localVotacion || "", mesa: String(idActa).slice(0, 6),
    jee,
    jeeAsignado: estado === "OBSERVADA" ? jee : undefined,
    motivoObservacion: estado === "OBSERVADA" ? "ERROR_ARITMETICO" : null,
    hashImagen: hashImagen.toLowerCase(),
    hashDatos: hashDatos.toLowerCase(),
    votos,
    candidatos: Array.isArray(candidatos) ? candidatos : [],
    documento: null,
    emitidos: emitidosNum,
    electoresHabiles: habilesNum,
    estado,
    firmante: "CN=OPERADOR_ODPE",
    msp: "ONPEMSP",
    endosos: ["ONPEMSP"],
    fechaRegistro: block.fecha,
    historial: [{ evento, estado, txId: block.txId, bloque: block.numero, fecha: block.fecha }]
  };

  const generatedPdfName = `Acta-${idActa}.pdf`;
  const generatedPdfPath = path.join(evidenceDir, generatedPdfName);
  const pdfBuffer = await createActaPdfBuffer(acta);
  fs.writeFileSync(generatedPdfPath, pdfBuffer);
  acta.hashImagen = sha256(pdfBuffer);
  acta.documento = { nombre: generatedPdfName, url: `/evidence/${generatedPdfName}`, tipo: "application/pdf" };

  actas.set(key, acta);
  database.actas.push(acta);
  saveDatabase();
  res.status(201).json(acta);
});

app.post("/api/actas/:tipo/:id/contabilizar", (req, res) => {
  const role = req.header("x-demo-role");
  if (role !== "SUPERVISOR_COMPUTO" && role !== "JEE_MAGISTRADO") {
    return res.status(403).json({ error: "Acceso denegado (R1/R8): se requiere SUPERVISOR_COMPUTO o JEE_MAGISTRADO" });
  }
  const acta = actas.get(`${req.params.tipo}:${req.params.id}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });
  if (acta.estado !== "REGISTRADA") {
    return res.status(409).json({ error: `Transición inválida (R5): estado actual es ${acta.estado}` });
  }

  const block = appendBlock("ACTA_CONTABILIZADA", acta.idActa, { endosos: ["ONPEMSP", "JNEMSP"] });
  acta.estado = "CONTABILIZADA";
  acta.endosos = ["ONPEMSP", "JNEMSP"];
  acta.historial.push({ evento: "ACTA_CONTABILIZADA", estado: "CONTABILIZADA", txId: block.txId, bloque: block.numero, fecha: block.fecha });
  saveDatabase();
  res.json(acta);
});

app.post("/api/actas/:tipo/:id/observar", (req, res) => {
  const role = req.header("x-demo-role");
  if (role !== "SUPERVISOR_COMPUTO") {
    return res.status(403).json({ error: "Acceso denegado (R1): se requiere SUPERVISOR_COMPUTO" });
  }
  const acta = actas.get(`${req.params.tipo}:${req.params.id}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });
  if (acta.estado !== "REGISTRADA") {
    return res.status(409).json({ error: `Transición inválida (R5): estado actual es ${acta.estado}` });
  }
  const { motivo = "OTRO" } = req.body || {};
  const block = appendBlock("ACTA_OBSERVADA", acta.idActa, { motivo });
  acta.estado = "OBSERVADA";
  acta.motivoObservacion = motivo;
  acta.jeeAsignado = acta.jee;
  acta.historial.push({ evento: "ACTA_OBSERVADA", estado: "OBSERVADA", motivo, txId: block.txId, bloque: block.numero, fecha: block.fecha });
  saveDatabase();
  res.json(acta);
});

app.post("/api/actas/:tipo/:id/ejemplar-jee", (req, res) => {
  const role = req.header("x-demo-role");
  const jeeHeader = req.header("x-demo-jee");
  if (role !== "JEE_SECRETARIO") {
    return res.status(403).json({ error: "Acceso denegado (R1): se requiere JEE_SECRETARIO" });
  }
  const acta = actas.get(`${req.params.tipo}:${req.params.id}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });
  if (jeeHeader && jeeHeader !== acta.jee) {
    return res.status(403).json({ error: `Competencia denegada (R6): ${jeeHeader} no corresponde a ${acta.jee}` });
  }
  const { hashImagenJEE, hashDatosJEE } = req.body || {};
  if (!isSha256Hex(hashImagenJEE) || !isSha256Hex(hashDatosJEE)) {
    return res.status(400).json({ error: "Hashes de ejemplar JEE inválidos (R3)" });
  }
  const block = appendBlock("EJEMPLAR_JEE_REGISTRADO", acta.idActa);
  acta.hashEjemplarJEE = hashImagenJEE.toLowerCase();
  acta.hashDatosJEE = hashDatosJEE.toLowerCase();
  acta.cotejoCoincide = acta.hashEjemplarJEE === acta.hashImagen && acta.hashDatosJEE === acta.hashDatos;
  acta.historial.push({ evento: "EJEMPLAR_JEE_REGISTRADO", estado: acta.estado, cotejoCoincide: acta.cotejoCoincide, txId: block.txId, bloque: block.numero, fecha: block.fecha });
  saveDatabase();
  res.json(acta);
});

app.post("/api/actas/:tipo/:id/resolver", (req, res) => {
  const role = req.header("x-demo-role");
  const jeeHeader = req.header("x-demo-jee");
  if (role !== "JEE_MAGISTRADO" && role !== "JNE_PLENO") {
    return res.status(403).json({ error: "Acceso denegado (R1): se requiere JEE_MAGISTRADO o JNE_PLENO" });
  }
  const acta = actas.get(`${req.params.tipo}:${req.params.id}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });
  if (role === "JEE_MAGISTRADO" && jeeHeader && jeeHeader !== acta.jee) {
    return res.status(403).json({ error: `Competencia denegada (R6): ${jeeHeader} no corresponde a ${acta.jee}` });
  }
  if (acta.estado !== "OBSERVADA") {
    return res.status(409).json({ error: "Transición inválida (R5): solo se resuelve un acta OBSERVADA" });
  }
  const { nroResolucion, hashResolucion, decision = "CONTABILIZADA" } = req.body || {};
  if (!nroResolucion || !isSha256Hex(hashResolucion)) {
    return res.status(400).json({ error: "Número o hash SHA-256 de resolución inválido (R3)" });
  }
  const finalState = decision === "ANULADA" ? "ANULADA" : "CONTABILIZADA";
  const block = appendBlock("RESOLUCION_JEE", acta.idActa, { nroResolucion, decision: finalState });
  acta.refResolucion = `${nroResolucion}:${hashResolucion.toLowerCase()}`;
  acta.estado = finalState;
  acta.endosos = ["ONPEMSP", "JNEMSP"];
  acta.historial.push({ evento: "RESOLUCION_JEE", estado: finalState, nroResolucion, txId: block.txId, bloque: block.numero, fecha: block.fecha });
  saveDatabase();
  res.json(acta);
});

app.post("/api/actas/:tipo/:id/recuento", async (req, res) => {
  const role = req.header("x-demo-role");
  const jeeHeader = req.header("x-demo-jee");
  if (role !== "JEE_MAGISTRADO") {
    return res.status(403).json({ error: "Acceso denegado (R1): se requiere JEE_MAGISTRADO" });
  }
  const acta = actas.get(`${req.params.tipo}:${req.params.id}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });
  if (jeeHeader && jeeHeader !== acta.jee) {
    return res.status(403).json({ error: `Competencia denegada (R6): ${jeeHeader} no corresponde a ${acta.jee}` });
  }
  if (acta.estado !== "OBSERVADA") {
    return res.status(409).json({ error: "Solo se recuenta un acta OBSERVADA (R5)" });
  }
  const { votos, candidatos, emitidos, hashActaRecuento } = req.body || {};
  if (!votos || !isSha256Hex(hashActaRecuento)) {
    return res.status(400).json({ error: "Votos o hash de recuento inválido (R3)" });
  }
  const sum = Object.values(votos).reduce((acc, value) => acc + Number(value), 0);
  const emitidosNum = Number(emitidos);
  const habiles = acta.electoresHabiles || 300;
  if (sum !== emitidosNum || emitidosNum > habiles) {
    return res.status(400).json({ error: "El recuento no cumple la regla aritmética (R4)" });
  }

  const block = appendBlock("RECUENTO_REGISTRADO", acta.idActa, { endosos: ["ONPEMSP", "JNEMSP"] });
  acta.votosAnteriores = acta.votos;
  acta.votos = votos;
  if (Array.isArray(candidatos)) acta.candidatos = candidatos;
  acta.emitidos = emitidosNum;
  acta.hashRecuento = hashActaRecuento.toLowerCase();
  acta.hashDatos = sha256(JSON.stringify(votos));
  acta.estado = "CONTABILIZADA";
  acta.endosos = ["ONPEMSP", "JNEMSP"];
  acta.historial.push({ evento: "RECUENTO_REGISTRADO", estado: "CONTABILIZADA", txId: block.txId, bloque: block.numero, fecha: block.fecha });
  saveDatabase();
  res.json(acta);
});

app.post("/api/actas/:tipo/:id/constancia", (req, res) => {
  const role = req.header("x-demo-role");
  if (role !== "PERSONERO") {
    return res.status(403).json({ error: "Acceso denegado (R1): se requiere rol PERSONERO" });
  }
  const acta = actas.get(`${req.params.tipo}:${req.params.id}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });

  const alreadyProclaimed = database.proclamaciones.some(p => p.tipoEleccion === acta.tipoEleccion);
  if (alreadyProclaimed) {
    return res.status(409).json({ error: "Plazo vencido (R7): el ámbito ya fue proclamado" });
  }

  const { hashCopia, votosCopia, organizacion } = req.body || {};
  if (!organizacion || !isSha256Hex(hashCopia)) {
    return res.status(400).json({ error: "Organización o hash SHA-256 de copia inválido" });
  }

  const block = appendBlock("CONSTANCIA_PERSONERO", acta.idActa, { organizacion });
  const coincideImagen = hashCopia.toLowerCase() === acta.hashImagen;
  const constancia = {
    idActa: acta.idActa,
    tipoEleccion: acta.tipoEleccion,
    organizacion,
    hashCopia: hashCopia.toLowerCase(),
    votosCopia: votosCopia || null,
    coincideImagen,
    txId: block.txId,
    bloque: block.numero,
    fecha: block.fecha
  };
  database.constancias.push(constancia);
  acta.constancias = acta.constancias || [];
  acta.constancias.push(constancia);
  acta.historial.push({ evento: "CONSTANCIA_PERSONERO", estado: acta.estado, organizacion, txId: block.txId, bloque: block.numero, fecha: block.fecha });
  saveDatabase();
  res.status(201).json(constancia);
});

app.post("/api/actas/:tipo/:id/nulidad", (req, res) => {
  const role = req.header("x-demo-role");
  if (role !== "JEE_SECRETARIO" && role !== "PERSONERO") {
    return res.status(403).json({ error: "Acceso denegado (R1): se requiere JEE_SECRETARIO o PERSONERO" });
  }
  const acta = actas.get(`${req.params.tipo}:${req.params.id}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });

  const { hashEscrito, motivo, diasDesdeJornada = 1 } = req.body || {};
  if (Number(diasDesdeJornada) > 3) {
    return res.status(409).json({ error: "Plazo vencido (R7): excede los 3 días de ley (Ley N.° 26859, art. 363)" });
  }
  if (!motivo || !isSha256Hex(hashEscrito)) {
    return res.status(400).json({ error: "Motivo o hash SHA-256 del escrito inválido" });
  }

  const block = appendBlock("NULIDAD_PRESENTADA", acta.idActa);
  const nulidad = {
    idNulidad: block.txId,
    idActa: acta.idActa,
    tipoEleccion: acta.tipoEleccion,
    hashEscrito: hashEscrito.toLowerCase(),
    motivo,
    estado: "PRESENTADA",
    fecha: block.fecha
  };
  database.nulidades.push(nulidad);
  acta.historial.push({ evento: "NULIDAD_PRESENTADA", estado: acta.estado, txId: block.txId, bloque: block.numero, fecha: block.fecha });
  saveDatabase();
  res.status(201).json(nulidad);
});

app.post("/api/proclamacion", (req, res) => {
  const role = req.header("x-demo-role");
  if (role !== "JEE_MAGISTRADO" && role !== "JNE_PLENO") {
    return res.status(403).json({ error: "Acceso denegado (R1): se requiere JEE_MAGISTRADO o JNE_PLENO" });
  }
  const { ambito = "NACIONAL", tipoEleccion = "PRES" } = req.body || {};
  const actasAmbito = database.actas.filter(a => a.tipoEleccion === tipoEleccion);
  if (actasAmbito.length === 0) {
    return res.status(404).json({ error: "No existen actas para el tipo de elección indicado" });
  }
  const pendientes = actasAmbito.filter(a => a.estado === "OBSERVADA" || a.estado === "REGISTRADA");
  if (pendientes.length > 0) {
    return res.status(409).json({
      error: `Proclamación bloqueada (R9): hay ${pendientes.length} acta(s) pendiente(s) o en revisión`,
      pendientes: pendientes.map(a => ({ idActa: a.idActa, estado: a.estado }))
    });
  }

  const hashes = actasAmbito.map(a => sha256(`${a.idActa}:${a.hashImagen}:${a.hashDatos}:${a.estado}`));
  const raizMerkle = computeMerkleRoot(hashes);
  const totales = {};
  for (const a of actasAmbito) {
    if (a.estado === "CONTABILIZADA") {
      for (const [k, v] of Object.entries(a.votos || {})) {
        totales[k] = (totales[k] || 0) + Number(v);
      }
    }
  }
  const block = appendBlock("PROCLAMACION", ambito, { tipoEleccion, raizMerkle });
  const proclamacion = {
    ambito,
    tipoEleccion,
    totalActas: actasAmbito.length,
    raizMerkle,
    totales,
    txId: block.txId,
    bloque: block.numero,
    fecha: block.fecha
  };
  database.proclamaciones.push(proclamacion);
  saveDatabase();
  res.status(201).json(proclamacion);
});

app.get("/api/proclamaciones", (_req, res) => res.json(database.proclamaciones));

app.get("/api/actas/buscar/:id", (req, res) => {
  const found = database.actas.find(a => a.idActa === req.params.id);
  if (!found) return res.status(404).json({ error: "Acta no encontrada" });
  res.json(found);
});

app.get("/api/actas/:tipo/:id", (req, res) => {
  const acta = actas.get(`${req.params.tipo}:${req.params.id}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });
  res.json(acta);
});

app.get("/api/actas/:tipo/:id/constancia-evidencia", (req, res) => {
  const acta = actas.get(`${req.params.tipo}:${req.params.id}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });
  const hashArchivoExterno = req.query.hashArchivo || null;
  const payload = {
    documento: "CONSTANCIA CRIPTOGRÁFICA DE VERIFICACIÓN - ACTACHAIN PERÚ",
    idActa: acta.idActa,
    tipoEleccion: acta.tipoEleccion,
    ubigeo: acta.ubigeo,
    jee: acta.jee,
    estadoActual: acta.estado,
    hashImagenOficial: acta.hashImagen,
    hashDatosOficial: acta.hashDatos,
    hashArchivoConsultado: hashArchivoExterno,
    coincide: hashArchivoExterno ? String(hashArchivoExterno).toLowerCase() === acta.hashImagen : null,
    votosRegistrados: acta.votos,
    emitidos: acta.emitidos,
    endosos: acta.endosos || [acta.msp],
    historial: acta.historial,
    fechaEmision: new Date().toISOString()
  };
  payload.selloIntegridad = sha256(JSON.stringify(payload));
  res.json(payload);
});

app.post("/api/verify/sha256", (req, res) => {
  const { hash, idActa, tipoEleccion = "PRES" } = req.body;
  const acta = actas.get(`${tipoEleccion}:${idActa}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });
  const verified = acta.hashImagen === String(hash).toLowerCase();
  res.json({ verified, officialHash: acta.hashImagen, submittedHash: hash });
});

app.post("/api/verify/votos", (req, res) => {
  const { votosCopia, idActa, tipoEleccion = "PRES" } = req.body || {};
  const acta = actas.get(`${tipoEleccion}:${idActa}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });
  const diferencias = [];
  const keys = new Set([...Object.keys(acta.votos || {}), ...Object.keys(votosCopia || {})]);
  for (const k of keys) {
    const oficial = Number(acta.votos?.[k] ?? 0);
    const copia = Number(votosCopia?.[k] ?? 0);
    if (oficial !== copia) diferencias.push({ campo: k, oficial, copia });
  }
  res.json({ coincide: diferencias.length === 0, diferencias, votosOficiales: acta.votos });
});

app.get("/api/outbox", (_req, res) => res.json(database.outbox));
app.post("/api/outbox/enqueue", (req, res) => {
  const item = { id: `outbox-${Date.now()}`, payload: req.body, encoladoEn: new Date().toISOString(), estado: "PENDIENTE" };
  database.outbox.push(item);
  saveDatabase();
  res.status(202).json(item);
});
app.post("/api/outbox/flush", (_req, res) => {
  const procesados = database.outbox.length;
  database.outbox = [];
  saveDatabase();
  res.json({ procesados, pendientes: 0 });
});

app.get("/api/actas", (_req, res) => res.json(database.actas));
app.get("/api/blocks", (_req, res) => res.json(database.bloques));

app.get("/api/openapi.json", (_req, res) => {
  const specPath = path.join(__dirname, "../../docs/openapi.json");
  if (!fs.existsSync(specPath)) return res.status(404).json({ error: "Especificación OpenAPI no encontrada" });
  res.type("application/json").send(fs.readFileSync(specPath, "utf8"));
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "ActaChain Perú API" }));
app.use("/evidence", express.static(evidenceDir));
app.use(express.static(path.join(__dirname, "../../portal-web")));

const port = Number(process.env.PORT || 3000);
if (require.main === module) {
  ready.then(() => app.listen(port, () => console.log(`ActaChain API en http://localhost:${port}`)));
}
module.exports = { app, actas, computeMerkleRoot, ready, resetToInitial };
