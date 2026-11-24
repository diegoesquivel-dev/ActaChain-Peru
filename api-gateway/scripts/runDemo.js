"use strict";

const { app, ready, resetToInitial } = require("../src/server");

async function main() {
  await ready;
  await resetToInitial();
  const port = Number(process.env.PORT || 3005);
  const server = app.listen(port, () => {
    console.log(`ActaChain API en http://localhost:${port}`);
  });
  server.once("error", error => {
    console.error(`No se pudo iniciar ActaChain API en el puerto ${port}:`, error);
    process.exitCode = 1;
  });
}

main().catch(error => {
  console.error("No se pudo preparar la demostración:", error);
  process.exitCode = 1;
});
