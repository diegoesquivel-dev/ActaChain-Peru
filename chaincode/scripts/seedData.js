const crypto = require("crypto");

const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

const actas = [
  {
    idActa: "079168-10",
    tipoEleccion: "PRES",
    ubigeo: "220901",
    hashImagen: sha256("acta-079168-10"),
    hashDatos: sha256(JSON.stringify({ P1: 60, P2: 30, BLANCOS: 5, NULOS: 5 })),
    votos: { P1: 60, P2: 30, BLANCOS: 5, NULOS: 5 },
    emitidos: 100
  },
  {
    idActa: "079168-11",
    tipoEleccion: "PRES",
    ubigeo: "220901",
    hashImagen: sha256("acta-079168-11"),
    hashDatos: sha256(JSON.stringify({ P1: 40 })),
    votos: { P1: 40 },
    emitidos: 100
  }
];

console.log(JSON.stringify(actas, null, 2));
