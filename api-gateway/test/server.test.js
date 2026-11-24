const test = require("node:test");
const assert = require("node:assert/strict");
const { app } = require("../src/server");

test("health endpoint exists", async () => {
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
  await new Promise(resolve => server.close(resolve));
});

test("consulta pública el acta demostrativa", async () => {
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/api/actas/PRES/079168-10`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).idActa, "079168-10");
  await new Promise(resolve => server.close(resolve));
});
