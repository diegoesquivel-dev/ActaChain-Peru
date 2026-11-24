"use strict";

const { ready, resetToInitial } = require("../src/server");

async function main() {
  await ready;
  await resetToInitial();
  console.log("Datos de demostración restaurados al estado inicial.");
}

main().catch(error => {
  console.error("No se pudieron restaurar los datos de demostración:", error);
  process.exitCode = 1;
});
