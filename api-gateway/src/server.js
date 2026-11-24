const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const dataDir = path.join(__dirname, "../data");
const dataFile = path.join(dataDir, "database.json");
const evidenceDir = path.join(__dirname, "../evidence");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });

const officialText = fs.readFileSync(path.join(__dirname, "../../portal-web/demo/acta_079168-10.html"));
const officialHash = crypto.createHash("sha256").update(officialText).digest("hex");

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
      hashDatos: crypto.createHash("sha256").update('{"P1":60,"P2":30,"BLANCOS":5,"NULOS":5}').digest("hex"),
      votos: { P1: 60, P2: 30, BLANCOS: 5, NULOS: 5 }, emitidos: 100,
      candidatos: [
        { nombre: "Organización 1", votos: 60 },
        { nombre: "Organización 2", votos: 30 }
      ],
      documento: { nombre: "acta_079168-10.html", url: "/demo/acta_079168-10.html", tipo: "text/html" },
      estado: "REGISTRADA", firmante: "CN=OPERADOR_ODPE", msp: "ONPEMSP",
      fechaRegistro: "2026-11-23T21:17:34Z",
      historial: [{ evento: "ACTA_REGISTRADA", estado: "REGISTRADA", txId: "tx-demo-001", bloque: 2 }]
    },
    {
      idActa: "079168-11", tipoEleccion: "PRES", ubigeo: "220901",
      departamento: "Lima", provincia: "Lima", distrito: "San Borja",
      localVotacion: "IE 0015 San Juan", mesa: "079168",
      jee: "JEE-22",
      hashImagen: crypto.createHash("sha256").update("acta oficial observada").digest("hex"),
      hashDatos: crypto.createHash("sha256").update('{"P1":40,"P2":50,"BLANCOS":5,"NULOS":5}').digest("hex"),
      votos: { P1: 40, P2: 50, BLANCOS: 5, NULOS: 5 }, emitidos: 100,
      candidatos: [
        { nombre: "Organización 1", votos: 40 },
        { nombre: "Organización 2", votos: 50 }
      ],
      documento: { nombre: "acta_079168-11.html", url: "/demo/acta_079168-11.html", tipo: "text/html" },
      estado: "OBSERVADA", motivoObservacion: "ERROR_ARITMETICO", jeeAsignado: "JEE-22",
      firmante: "CN=SUPERVISOR_COMPUTO", msp: "ONPEMSP",
      fechaRegistro: "2026-11-23T21:18:10Z",
      historial: [{ evento: "ACTA_OBSERVADA", estado: "OBSERVADA", txId: "tx-demo-002", bloque: 3 }]
    },
    {
      idActa: "079168-12", tipoEleccion: "PRES", ubigeo: "150101",
      departamento: "Lima", provincia: "Lima", distrito: "Lima",
      localVotacion: "Colegio María Montenegro", mesa: "079168",
      jee: "JEE-LIMA-CENTRO",
      hashImagen: crypto.createHash("sha256").update("acta contabilizada lima").digest("hex"),
      hashDatos: crypto.createHash("sha256").update('{"P1":45,"P2":42,"BLANCOS":8,"NULOS":5}').digest("hex"),
      votos: { P1: 45, P2: 42, BLANCOS: 8, NULOS: 5 }, emitidos: 100,
      candidatos: [
        { nombre: "Organización 1", votos: 45 },
        { nombre: "Organización 2", votos: 42 }
      ],
      documento: { nombre: "acta_079168-12.html", url: "/demo/acta_079168-12.html", tipo: "text/html" },
      estado: "CONTABILIZADA", firmante: "CN=SUPERVISOR_COMPUTO", msp: "ONPEMSP",
      fechaRegistro: "2026-11-23T21:20:10Z",
      historial: [{ evento: "ACTA_CONTABILIZADA", estado: "CONTABILIZADA", txId: "tx-demo-003", bloque: 4 }]
    }
  ]
};

let database;
if (fs.existsSync(dataFile)) {
  database = JSON.parse(fs.readFileSync(dataFile, "utf8"));
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
    acta.candidatos.forEach((item, index) => {
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
      ["Votos en blanco", acta.votos.BLANCOS || 0],
      ["Votos nulos", acta.votos.NULOS || 0],
      ["TOTAL DE VOTOS EMITIDOS", acta.emitidos]
    ];
    totals.forEach((row, index) => {
      pdf.rect(36, y, boxWidth, 24).fill(index === 2 ? "#dce8f8" : "#f7f9fc").stroke("#d8e0ea");
      pdf.fillColor(index === 2 ? blue : ink).fontSize(index === 2 ? 10 : 9);
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

Promise.resolve().then(async () => {
  for (const acta of database.actas) {
    if (!acta.candidatos) continue;
    const pdfBuffer = await createActaPdfBuffer(acta);
    const pdfName = `Acta-${acta.idActa}.pdf`;
    fs.writeFileSync(path.join(evidenceDir, pdfName), pdfBuffer);
    acta.hashImagen = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    acta.documento = { nombre: pdfName, url: `/evidence/${pdfName}`, tipo: "application/pdf" };
  }
  saveDatabase();
});

app.post("/api/actas", async (req, res) => {
  const role = req.header("x-demo-role");
  if (role !== "OPERADOR_ODPE") return res.status(403).json({ error: "Acceso denegado para registrar esta acta" });
  const {
    idActa, tipoEleccion, ubigeo, departamento, provincia, distrito, localVotacion,
    hashImagen, hashDatos, votos, candidatos, emitidos
  } = req.body;
  if (!idActa || !tipoEleccion || !/^[a-f0-9]{64}$/i.test(hashImagen) || !/^[a-f0-9]{64}$/i.test(hashDatos)) {
    return res.status(400).json({ error: "Datos o hashes inválidos" });
  }
  const sum = Object.values(votos || {}).reduce((acc, value) => acc + Number(value), 0);
  if (sum !== Number(emitidos)) return res.status(400).json({ error: "La suma aritmética no coincide" });
  const key = `${tipoEleccion}:${idActa}`;
  if (actas.has(key)) return res.status(409).json({ error: "El acta ya fue registrada" });

  const acta = {
    idActa, tipoEleccion, ubigeo,
    departamento: departamento || "", provincia: provincia || "", distrito: distrito || "",
    localVotacion: localVotacion || "", mesa: String(idActa).slice(0, 6),
    jee: `JEE-${String(ubigeo).slice(0, 2)}`, hashImagen,
    hashDatos: hashDatos.toLowerCase(), votos,
    candidatos: Array.isArray(candidatos) ? candidatos : [],
    documento: null, emitidos: Number(emitidos), estado: "REGISTRADA",
    firmante: "CN=OPERADOR_ODPE", msp: "ONPEMSP", fechaRegistro: new Date().toISOString(),
    historial: [{ evento: "ACTA_REGISTRADA", estado: "REGISTRADA", txId: `tx-${Date.now()}`, bloque: database.bloques.length + 1 }]
  };

  const generatedPdfName = `Acta-${idActa}.pdf`;
  const generatedPdfPath = path.join(evidenceDir, generatedPdfName);
  const pdfBuffer = await createActaPdfBuffer(acta);
  fs.writeFileSync(generatedPdfPath, pdfBuffer);
  acta.hashImagen = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
  acta.documento = { nombre: generatedPdfName, url: `/evidence/${generatedPdfName}`, tipo: "application/pdf" };
  actas.set(key, acta);
  database.actas.push(acta);
  database.bloques.push({ numero: database.bloques.length + 1, txId: acta.historial[0].txId, evento: "ACTA_REGISTRADA", acta: idActa, fecha: acta.fechaRegistro });
  saveDatabase();
  res.status(201).json(acta);
});

app.get("/api/actas/:tipo/:id", (req, res) => {
  const acta = actas.get(`${req.params.tipo}:${req.params.id}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });
  res.json(acta);
});

app.post("/api/verify/sha256", (req, res) => {
  const { hash, idActa, tipoEleccion = "PRES" } = req.body;
  const acta = actas.get(`${tipoEleccion}:${idActa}`);
  if (!acta) return res.status(404).json({ error: "Acta no encontrada" });
  const verified = acta.hashImagen === String(hash).toLowerCase();
  res.json({ verified, officialHash: acta.hashImagen, submittedHash: hash });
});

app.get("/api/actas", (_req, res) => res.json(database.actas));
app.get("/api/blocks", (_req, res) => res.json(database.bloques));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "ActaChain Perú API" }));
app.use("/evidence", express.static(evidenceDir));
app.use(express.static(path.join(__dirname, "../../portal-web")));

const port = Number(process.env.PORT || 3000);
if (require.main === module) app.listen(port, () => console.log(`ActaChain API en http://localhost:${port}`));
module.exports = { app, actas };
