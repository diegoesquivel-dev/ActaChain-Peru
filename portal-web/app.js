window.verificationStatus = { altered: false };

function showView(name) {
  document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  const view = document.getElementById(name);
  if (view) view.classList.add("active");
  document.querySelectorAll(`.nav-item[data-view="${name}"]`).forEach(item => item.classList.add("active"));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "seguimiento") refreshExplorer();
}

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

async function consultar() {
  const id = document.getElementById("actaId").value.trim();
  const empty = document.getElementById("result-empty");
  const result = document.getElementById("acta-result");
  empty.hidden = true;

  if (!id) {
    empty.hidden = false;
    result.hidden = true;
    empty.querySelector("h2").textContent = "Ingresa un código de mesa";
    empty.querySelector("p").textContent = "Escribe el código impreso en el acta o selecciona un ejemplo.";
    return;
  }

  try {
    const response = await fetch(`/api/actas/PRES/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) {
      empty.hidden = false;
      result.hidden = true;
      empty.querySelector("h2").textContent = "No encontramos el acta";
      empty.querySelector("p").textContent = "Verifica el código ingresado. Puedes probar 079168-10, 079168-11 o 079168-12.";
      return;
    }

    empty.hidden = true;
    result.hidden = false;
    document.getElementById("summary-id").textContent = data.idActa;
    document.getElementById("summary-type").textContent =
      data.tipoEleccion === "PRES" ? "Presidencial" :
      data.tipoEleccion === "SEN_U" ? "Senadores" :
      data.tipoEleccion === "DIP" ? "Diputados" : data.tipoEleccion;
    document.getElementById("summary-district").textContent = data.distrito || data.ubigeo;
    document.getElementById("summary-local").textContent = data.localVotacion || "Local no informado";
    document.getElementById("summary-status").textContent = labelEstado(data.estado);
    document.getElementById("summary-total").textContent = `${data.emitidos} votos emitidos`;

    const observed = data.estado === "OBSERVADA";
    const statusIcon = document.getElementById("status-icon");
    const statusPill = document.getElementById("summary-status");
    statusIcon.textContent = observed ? "!" : "✓";
    statusIcon.className = observed ? "status-icon observed" : "status-icon";
    statusPill.className = observed ? "status-pill observed" : "status-pill";

    const entries = Array.isArray(data.candidatos) && data.candidatos.length
      ? data.candidatos.map(item => [item.nombre, item.votos])
      : Object.entries(data.votos || {}).map(([name, value]) => [labelVoto(name), value]);
    if (data.votos?.BLANCOS !== undefined) entries.push(["Votos en blanco", data.votos.BLANCOS]);
    if (data.votos?.NULOS !== undefined) entries.push(["Votos nulos", data.votos.NULOS]);
    const maximum = Math.max(...entries.map(([, value]) => Number(value)), 1);
    document.getElementById("votos-list").innerHTML = entries.map(([name, value]) => `
      <div class="voto-row">
        <span>${name}</span>
        <div class="voto-track"><i style="width:${Math.round(Number(value) * 100 / maximum)}%"></i></div>
        <strong>${Number(value)}</strong>
      </div>`).join("");

    const attached = document.getElementById("attached-document");
    if (data.documento) {
      attached.hidden = false;
      document.getElementById("attached-name").textContent = data.documento.nombre;
      document.getElementById("view-document").dataset.url = data.documento.url;
    } else {
      attached.hidden = true;
    }

    document.getElementById("detail-content").textContent = JSON.stringify(data, null, 2);
    document.getElementById("dialog-title").textContent = `Acta ${data.idActa}`;
  } catch (error) {
    empty.hidden = false;
    result.hidden = true;
    empty.querySelector("h2").textContent = "No podemos consultar el acta";
    empty.querySelector("p").textContent = "Comprueba que el servidor local esté activo.";
  }
}

function labelEstado(state) {
  return {
    REGISTRADA: "Registrada",
    CONTABILIZADA: "Contabilizada",
    OBSERVADA: "En revisión",
    RESUELTA: "Resuelta",
    RECONTADA: "Recontada",
    ANULADA: "Anulada"
  }[state] || state;
}

function labelVoto(name) {
  return {
    P1: "Organización 1",
    P2: "Organización 2",
    BLANCOS: "Votos en blanco",
    NULOS: "Votos nulos",
    IMPUGNADOS: "Votos impugnados"
  }[name] || name;
}

async function sha256Buffer(buffer) {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function verificar() {
  const file = document.getElementById("archivo").files[0];
  const box = document.getElementById("verification-result");
  box.hidden = false;

  if (!file) {
    box.className = "verification-result bad";
    box.textContent = "Selecciona primero una copia del acta.";
    return;
  }

  const hash = await sha256Buffer(await file.arrayBuffer());
  const id = document.getElementById("actaId").value.trim();
  const response = await fetch("/api/verify/sha256", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hash, idActa: id, tipoEleccion: "PRES" })
  });
  const data = await response.json();
  box.hidden = false;
  if (!response.ok) {
    box.className = "verification-result bad";
    box.textContent = data.error;
  } else if (data.verified) {
    box.className = "verification-result";
    box.textContent = "✓ Verificación confirmada: el archivo coincide con el registro.";
    window.verificationStatus.altered = false;
  } else {
    box.className = "verification-result bad";
    box.textContent = "¡Atención! El archivo no coincide con el registro.";
    window.verificationStatus.altered = true;
  }
}

async function registrar() {
  const id = document.getElementById("new-id").value.trim();
  const candidatos = [...document.querySelectorAll(".candidate-row")].map(row => ({
    nombre: row.querySelector(".candidate-name").value.trim(),
    votos: Number(row.querySelector(".candidate-votes").value)
  })).filter(item => item.nombre);
  if (!id || candidatos.length === 0) {
    const box = document.getElementById("registration-result");
    box.hidden = false;
    box.className = "registration-result error";
    box.textContent = "Completa el código del acta y al menos una organización o candidato.";
    return;
  }
  const votos = {};
  candidatos.forEach((item, index) => votos[`C${index + 1}`] = item.votos);
  votos.BLANCOS = Number(document.getElementById("vb").value);
  votos.NULOS = Number(document.getElementById("vn").value);
  const emitidos = Object.values(votos).reduce((sum, value) => sum + value, 0);
  const tipoEleccion = document.getElementById("new-type").value;
  const ubigeo = document.getElementById("new-ubigeo").value.trim();
  const departamento = document.getElementById("new-departamento").value.trim();
  const provincia = document.getElementById("new-provincia").value.trim();
  const distrito = document.getElementById("new-distrito").value.trim();
  const localVotacion = document.getElementById("new-local").value.trim();

  const hashImagen = await sha256Buffer(new TextEncoder().encode(`Acta ${id} registrada`));
  const hashDatos = await sha256Buffer(new TextEncoder().encode(JSON.stringify(votos)));

  const response = await fetch("/api/actas", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-demo-role": "OPERADOR_ODPE" },
    body: JSON.stringify({
      idActa: id, tipoEleccion, ubigeo, departamento, provincia, distrito, localVotacion,
      hashImagen, hashDatos, votos, candidatos, emitidos
    })
  });
  const data = await response.json();
  const box = document.getElementById("registration-result");
  box.hidden = false;
  box.className = response.ok ? "registration-result" : "registration-result error";
  box.innerHTML = response.ok
    ? `<strong>Acta registrada correctamente</strong><br><small>Código ${data.idActa} · Estado ${labelEstado(data.estado)} · Total ${data.emitidos} votos emitidos</small>`
    : `<strong>No se pudo registrar el acta</strong><br><small>${data.error}</small>`;
  if (response.ok) refreshExplorer();
}

async function refreshExplorer() {
  const [actasResponse, blocksResponse] = await Promise.all([fetch("/api/actas"), fetch("/api/blocks")]);
  const actas = await actasResponse.json();
  const blocks = await blocksResponse.json();
  document.getElementById("count-actas").textContent = actas.length;
  document.getElementById("count-blocks").textContent = blocks.length;
  const verificationLabel = document.getElementById("verification-status");
  if (verificationLabel) {
    verificationLabel.textContent = window.verificationStatus.altered
      ? "Cambio detectado"
      : "Sin cambios detectados";
  }
  document.getElementById("ledger-actas").innerHTML = actas.map(acta => `
    <div class="ledger-row">
      <strong>${acta.idActa}</strong>
      <span>${acta.tipoEleccion === "PRES" ? "Presidencial" : acta.tipoEleccion}</span>
      <span class="ledger-state ${acta.estado === "OBSERVADA" ? "observed" : ""}">${labelEstado(acta.estado)}</span>
      <button onclick="document.getElementById('actaId').value='${acta.idActa}'; showView('consulta'); consultar();">Ver acta</button>
    </div>`).join("");
}

document.getElementById("consultar").addEventListener("click", consultar);
document.getElementById("verificar").addEventListener("click", verificar);
document.getElementById("registrar").addEventListener("click", registrar);
document.querySelectorAll(".example-code").forEach(button => {
  button.addEventListener("click", () => {
    document.getElementById("actaId").value = button.dataset.code;
    consultar();
  });
});
document.getElementById("archivo").addEventListener("change", event => {
  document.getElementById("file-name").textContent = event.target.files[0]?.name || "PDF, TXT, JPG o PNG";
});
document.getElementById("open-detail").addEventListener("click", () => document.getElementById("detail-dialog").showModal());
document.getElementById("close-detail").addEventListener("click", () => document.getElementById("detail-dialog").close());
document.getElementById("view-document").addEventListener("click", event => {
  const url = event.currentTarget.dataset.url;
  if (url) window.open(url, "_blank", "noopener");
});
document.getElementById("add-candidate").addEventListener("click", () => {
  const row = document.createElement("div");
  row.className = "candidate-row";
  row.innerHTML = `
    <input class="candidate-name" placeholder="Nombre de organización o candidato" aria-label="Organización o candidato">
    <input class="candidate-votes" type="number" min="0" value="0" aria-label="Votos">
    <button type="button" class="remove-candidate" aria-label="Eliminar">×</button>`;
  document.getElementById("candidate-editor").appendChild(row);
});
document.getElementById("candidate-editor").addEventListener("click", event => {
  if (event.target.classList.contains("remove-candidate")) {
    event.target.closest(".candidate-row").remove();
  }
});
