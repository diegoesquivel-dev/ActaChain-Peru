window.verificationStatus = { altered: false, lastHash: null, currentActa: null };

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
  const tipo = document.getElementById("search-type")?.value || "PRES";
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
    const endpoint = tipo === "AUTO"
      ? `/api/actas/buscar/${encodeURIComponent(id)}`
      : `/api/actas/${encodeURIComponent(tipo)}/${encodeURIComponent(id)}`;
    let response = await fetch(endpoint);
    if (!response.ok && tipo !== "AUTO") {
      response = await fetch(`/api/actas/buscar/${encodeURIComponent(id)}`);
    }
    const data = await response.json();
    if (!response.ok) {
      empty.hidden = false;
      result.hidden = true;
      empty.querySelector("h2").textContent = "No encontramos el acta";
      empty.querySelector("p").textContent = "Verifica el código ingresado. Puedes probar 079168-10, 079168-11 o 079168-12.";
      return;
    }

    window.verificationStatus.currentActa = data;
    window.verificationStatus.lastHash = null;
    document.getElementById("hash-comparison").hidden = true;
    document.getElementById("verification-result").hidden = true;

    empty.hidden = true;
    result.hidden = false;
    document.getElementById("summary-id").textContent = data.idActa;
    document.getElementById("summary-type").textContent = labelTipo(data.tipoEleccion);
    document.getElementById("summary-district").textContent = `${data.distrito || data.ubigeo} (${data.jee || "-"})`;
    document.getElementById("summary-local").textContent = data.localVotacion || "Local no informado";
    document.getElementById("summary-status").textContent = labelEstado(data.estado);
    document.getElementById("summary-total").textContent = `${data.emitidos} votos emitidos`;

    const observed = data.estado === "OBSERVADA" || data.estado === "ANULADA";
    const statusIcon = document.getElementById("status-icon");
    const statusPill = document.getElementById("summary-status");
    statusIcon.textContent = observed ? "!" : "✓";
    statusIcon.className = observed ? "status-icon observed" : "status-icon";
    statusPill.className = observed ? "status-pill observed" : "status-pill";

    const entries = Array.isArray(data.candidatos) && data.candidatos.length
      ? data.candidatos.map(item => [item.nombre, item.votos])
      : Object.entries(data.votos || {})
        .filter(([name]) => name !== "BLANCOS" && name !== "NULOS" && name !== "IMPUGNADOS")
        .map(([name, value]) => [labelVoto(name), value]);
    if (data.votos?.BLANCOS !== undefined) entries.push(["Votos en blanco", data.votos.BLANCOS]);
    if (data.votos?.NULOS !== undefined) entries.push(["Votos nulos", data.votos.NULOS]);
    if (data.votos?.IMPUGNADOS) entries.push(["Votos impugnados", data.votos.IMPUGNADOS]);
    const maximum = Math.max(...entries.map(([, value]) => Number(value)), 1);
    document.getElementById("votos-list").innerHTML = entries.map(([name, value]) => `
      <div class="voto-row">
        <span>${escapeHtml(name)}</span>
        <div class="voto-track"><i style="width:${Math.round(Number(value) * 100 / maximum)}%"></i></div>
        <strong>${Number(value)}</strong>
      </div>`).join("");

    const prevBox = document.getElementById("votos-anteriores-box");
    if (data.votosAnteriores) {
      prevBox.hidden = false;
      prevBox.innerHTML = `<small><strong>Historial R10 (Votos antes del recuento):</strong> ${escapeHtml(JSON.stringify(data.votosAnteriores))}</small>`;
    } else {
      prevBox.hidden = true;
    }

    const attached = document.getElementById("attached-document");
    if (data.documento) {
      attached.hidden = false;
      document.getElementById("attached-name").textContent = data.documento.nombre;
      document.getElementById("view-document").dataset.url = data.documento.url;
      const dl = document.getElementById("download-document");
      if (dl) {
        dl.href = data.documento.url;
        dl.download = data.documento.nombre;
      }
    } else {
      attached.hidden = true;
    }

    // Trazabilidad criptográfica e historial (P-02 / RF08)
    document.getElementById("trace-jee").textContent = data.jee || "JEE";
    document.getElementById("trace-hash-img").textContent = data.hashImagen || "-";
    document.getElementById("trace-hash-data").textContent = data.hashDatos || "-";
    document.getElementById("trace-signer").textContent = `${data.firmante || "-"} · ${data.msp || "-"} · Endosos: ${(data.endosos || [data.msp]).join(" AND ")}`;

    document.getElementById("historial-list").innerHTML = (data.historial || []).map(ev => `
      <div class="hist-row">
        <strong>${escapeHtml(ev.evento)}</strong>
        <span class="ledger-state ${ev.estado === "OBSERVADA" ? "observed" : ""}">${escapeHtml(labelEstado(ev.estado))}</span>
        <code>tx: ${escapeHtml(ev.txId || "-")} · Bloque #${escapeHtml(ev.bloque || "-")}</code>
        <small>${escapeHtml(ev.fecha || "")}</small>
      </div>`).join("");

    const constBox = document.getElementById("constancias-list");
    if (Array.isArray(data.constancias) && data.constancias.length > 0) {
      constBox.hidden = false;
      constBox.innerHTML = `<h4 class="sub-title">Constancias de personeros (${data.constancias.length})</h4>` +
        data.constancias.map(c => `<div class="hist-row"><strong>${escapeHtml(c.organizacion)}</strong><span>${c.coincideImagen ? "Coincide" : "Discrepancia"}</span><code>${escapeHtml(c.hashCopia)}</code><small>${escapeHtml(c.txId)}</small></div>`).join("");
    } else {
      constBox.hidden = true;
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

function labelTipo(tipo) {
  return {
    PRES: "Presidencial",
    SEN_U: "Senadores Único",
    SEN_M: "Senadores Múltiple",
    DIP: "Diputados",
    PAND: "Parlamento Andino"
  }[tipo] || tipo;
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
  const compBox = document.getElementById("hash-comparison");
  box.hidden = false;

  if (!file) {
    box.className = "verification-result bad";
    box.textContent = "Selecciona primero una copia del acta.";
    return;
  }

  const hash = await sha256Buffer(await file.arrayBuffer());
  window.verificationStatus.lastHash = hash;
  const acta = window.verificationStatus.currentActa;
  const id = acta?.idActa || document.getElementById("actaId").value.trim();
  const tipoEleccion = acta?.tipoEleccion || "PRES";
  const response = await fetch("/api/verify/sha256", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hash, idActa: id, tipoEleccion })
  });
  const data = await response.json();
  box.hidden = false;
  if (response.ok) {
    compBox.hidden = false;
    compBox.innerHTML = `
      <div><small>Hash calculado localmente (navegador):</small><code>${escapeHtml(hash)}</code></div>
      <div><small>Hash oficial registrado en blockchain:</small><code>${escapeHtml(data.officialHash)}</code></div>`;
  }
  if (!response.ok) {
    box.className = "verification-result bad";
    box.textContent = data.error;
  } else if (data.verified) {
    box.className = "verification-result";
    box.textContent = "✓ Verificado - Integridad confirmada: el archivo coincide exactamente con el registro.";
    window.verificationStatus.altered = false;
  } else {
    box.className = "verification-result bad";
    box.textContent = "¡Discrepancia detectada! El archivo no corresponde al acta original registrada. Puedes exportar la constancia para el JEE.";
    window.verificationStatus.altered = true;
  }
}

async function exportarEvidencia() {
  const acta = window.verificationStatus.currentActa;
  const id = acta?.idActa || document.getElementById("actaId").value.trim();
  const tipo = acta?.tipoEleccion || "PRES";
  const hashParam = window.verificationStatus.lastHash ? `?hashArchivo=${encodeURIComponent(window.verificationStatus.lastHash)}` : "";
  const response = await fetch(`/api/actas/${encodeURIComponent(tipo)}/${encodeURIComponent(id)}/constancia-evidencia${hashParam}`);
  const data = await response.json();
  if (!response.ok) return alert(data.error || "No se pudo exportar la constancia");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `constancia-evidencia-${id}.json`;
  link.click();
  URL.revokeObjectURL(url);
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
  const impugnados = Number(document.getElementById("vi")?.value || 0);
  if (impugnados > 0) votos.IMPUGNADOS = impugnados;

  const autoSum = Object.values(votos).reduce((sum, value) => sum + value, 0);
  const overrideRaw = document.getElementById("emitidos-override")?.value?.trim();
  const emitidos = overrideRaw ? Number(overrideRaw) : autoSum;
  const electoresHabiles = Number(document.getElementById("habiles")?.value || 300);

  const tipoEleccion = document.getElementById("new-type").value;
  const ubigeo = document.getElementById("new-ubigeo").value.trim();
  const departamento = document.getElementById("new-departamento").value.trim();
  const provincia = document.getElementById("new-provincia").value.trim();
  const distrito = document.getElementById("new-distrito").value.trim();
  const localVotacion = document.getElementById("new-local").value.trim();
  const [demoRole, demoMsp] = (document.getElementById("reg-role")?.value || "OPERADOR_ODPE|ONPEMSP").split("|");

  const hashImagen = await sha256Buffer(new TextEncoder().encode(`Acta ${id} registrada`));
  const hashDatos = await sha256Buffer(new TextEncoder().encode(JSON.stringify(votos)));

  const response = await fetch("/api/actas", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-demo-role": demoRole, "x-demo-msp": demoMsp },
    body: JSON.stringify({
      idActa: id, tipoEleccion, ubigeo, departamento, provincia, distrito, localVotacion,
      hashImagen, hashDatos, votos, candidatos, emitidos, electoresHabiles
    })
  });
  const data = await response.json();
  const box = document.getElementById("registration-result");
  box.hidden = false;
  box.className = response.ok ? "registration-result" : "registration-result error";
  box.innerHTML = response.ok
    ? `<strong>Acta registrada correctamente</strong><br><small>Código ${escapeHtml(data.idActa)} · Estado ${escapeHtml(labelEstado(data.estado))} · Total ${data.emitidos} votos emitidos · txId ${escapeHtml(data.historial?.[0]?.txId || "-")}</small>`
    : `<strong>No se pudo registrar el acta (HTTP ${response.status})</strong><br><small>${escapeHtml(data.error)}</small>`;
  if (response.ok) refreshExplorer();
}

function showGestionBox(elId, ok, title, detail) {
  const box = document.getElementById(elId);
  box.hidden = false;
  box.className = ok ? "registration-result" : "registration-result error";
  box.innerHTML = `<strong>${escapeHtml(title)}</strong><br><small>${escapeHtml(detail)}</small>`;
}

async function contabilizarActaUI() {
  const id = document.getElementById("gest-cont-id").value.trim();
  const tipo = document.getElementById("gest-cont-tipo").value;
  const res = await fetch(`/api/actas/${encodeURIComponent(tipo)}/${encodeURIComponent(id)}/contabilizar`, {
    method: "POST",
    headers: { "x-demo-role": "SUPERVISOR_COMPUTO" }
  });
  const data = await res.json();
  if (res.ok) {
    showGestionBox("res-contabilizar", true, "Acta contabilizada con endoso ONPE AND JNE", `Estado: ${data.estado} · Endosos: ${(data.endosos || []).join(", ")}`);
    refreshExplorer();
  } else {
    showGestionBox("res-contabilizar", false, `Operación rechazada (HTTP ${res.status})`, data.error);
  }
}

async function recuentoUI() {
  const id = document.getElementById("gest-jee-id").value.trim();
  const tipo = document.getElementById("gest-jee-tipo").value;
  const jeeCode = document.getElementById("gest-jee-code").value.trim();
  const p1 = Number(document.getElementById("gest-rec-p1").value);
  const p2 = Number(document.getElementById("gest-rec-p2").value);
  const [blancos, nulos] = document.getElementById("gest-rec-bn").value.split(",").map(v => Number(v.trim() || 0));
  const votos = { P1: p1, P2: p2, BLANCOS: blancos || 0, NULOS: nulos || 0 };
  const emitidos = Object.values(votos).reduce((a, b) => a + b, 0);
  const hashActaRecuento = await sha256Buffer(new TextEncoder().encode(`recuento-${id}-${Date.now()}`));

  const res = await fetch(`/api/actas/${encodeURIComponent(tipo)}/${encodeURIComponent(id)}/recuento`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-demo-role": "JEE_MAGISTRADO", "x-demo-jee": jeeCode },
    body: JSON.stringify({
      votos,
      candidatos: [{ nombre: "Organización 1", votos: p1 }, { nombre: "Organización 2", votos: p2 }],
      emitidos,
      hashActaRecuento
    })
  });
  const data = await res.json();
  if (res.ok) {
    showGestionBox("res-recuento", true, "Recuento registrado (R10: votos anteriores conservados)", `Estado: ${data.estado} · Anteriores: ${JSON.stringify(data.votosAnteriores)}`);
    refreshExplorer();
  } else {
    showGestionBox("res-recuento", false, `Rechazado (HTTP ${res.status})`, data.error);
  }
}

async function constanciaUI() {
  const id = document.getElementById("gest-per-id").value.trim();
  const tipo = document.getElementById("gest-per-tipo").value;
  const organizacion = document.getElementById("gest-per-org").value.trim();
  let hashCopia = document.getElementById("gest-per-hash").value.trim();
  if (!hashCopia) {
    hashCopia = await sha256Buffer(new TextEncoder().encode(`copia-${organizacion}-${id}-${Date.now()}`));
  }
  const res = await fetch(`/api/actas/${encodeURIComponent(tipo)}/${encodeURIComponent(id)}/constancia`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-demo-role": "PERSONERO" },
    body: JSON.stringify({ organizacion, hashCopia })
  });
  const data = await res.json();
  if (res.ok) {
    showGestionBox("res-constancia", true, "Constancia de personero registrada", `txId: ${data.txId} · Bloque #${data.bloque}`);
    refreshExplorer();
  } else {
    showGestionBox("res-constancia", false, `Rechazado (HTTP ${res.status})`, data.error);
  }
}

async function proclamarUI() {
  const ambito = document.getElementById("gest-proc-ambito").value.trim();
  const tipoEleccion = document.getElementById("gest-proc-tipo").value;
  const res = await fetch("/api/proclamacion", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-demo-role": "JNE_PLENO" },
    body: JSON.stringify({ ambito, tipoEleccion })
  });
  const data = await res.json();
  if (res.ok) {
    showGestionBox("res-proclamar", true, `Proclamación emitida (${data.totalActas} actas)`, `Raíz de Merkle: ${data.raizMerkle}`);
    refreshExplorer();
  } else {
    showGestionBox("res-proclamar", false, `Bloqueado (HTTP ${res.status})`, data.error);
  }
}

async function refreshExplorer() {
  const [actasResponse, blocksResponse, procResponse, outboxResponse] = await Promise.all([
    fetch("/api/actas"),
    fetch("/api/blocks"),
    fetch("/api/proclamaciones"),
    fetch("/api/outbox")
  ]);
  const actas = await actasResponse.json();
  const blocks = await blocksResponse.json();
  const proclamaciones = await procResponse.json();
  const outbox = await outboxResponse.json();

  document.getElementById("count-actas").textContent = actas.length;
  document.getElementById("count-blocks").textContent = blocks.length;
  const outboxBadge = document.getElementById("outbox-badge");
  if (outboxBadge) outboxBadge.textContent = `Outbox: ${outbox.length} pendientes`;

  const verificationLabel = document.getElementById("verification-status");
  if (verificationLabel) {
    verificationLabel.textContent = window.verificationStatus.altered
      ? "Cambio detectado"
      : "Sin cambios detectados";
  }
  document.getElementById("ledger-actas").innerHTML = actas.map(acta => `
    <div class="ledger-row">
      <strong>${escapeHtml(acta.idActa)}</strong>
      <span>${escapeHtml(labelTipo(acta.tipoEleccion))}</span>
      <span class="ledger-state ${acta.estado === "OBSERVADA" || acta.estado === "ANULADA" ? "observed" : ""}">${escapeHtml(labelEstado(acta.estado))}</span>
      <button onclick="document.getElementById('actaId').value='${escapeHtml(acta.idActa)}'; document.getElementById('search-type').value='${escapeHtml(acta.tipoEleccion)}'; showView('consulta'); consultar();">Ver acta</button>
    </div>`).join("");

  const blocksEl = document.getElementById("ledger-blocks");
  if (blocksEl) {
    blocksEl.innerHTML = [...blocks].reverse().slice(0, 12).map(b => `
      <div class="hist-row">
        <strong>Bloque #${b.numero} · ${escapeHtml(b.evento)}</strong>
        <span>Acta/Ámbito: ${escapeHtml(b.acta || "-")}</span>
        <code>${escapeHtml(b.txId)}</code>
        <small>${escapeHtml(b.fecha)}</small>
      </div>`).join("");
  }

  const procEl = document.getElementById("ledger-proclamaciones");
  if (procEl) {
    procEl.innerHTML = proclamaciones.length
      ? proclamaciones.map(p => `
        <div class="hist-row">
          <strong>${escapeHtml(p.ambito)} (${escapeHtml(p.tipoEleccion)})</strong>
          <span>${p.totalActas} actas</span>
          <code>Merkle: ${escapeHtml(p.raizMerkle)}</code>
          <small>${escapeHtml(p.fecha)}</small>
        </div>`).join("")
      : `<p class="card-description">Aún no se han emitido proclamaciones (R9 exige que ninguna acta esté OBSERVADA o pendiente).</p>`;
  }
}

document.getElementById("consultar").addEventListener("click", consultar);
document.getElementById("verificar").addEventListener("click", verificar);
document.getElementById("export-evidence").addEventListener("click", exportarEvidencia);
document.getElementById("registrar").addEventListener("click", registrar);
document.getElementById("btn-contabilizar").addEventListener("click", contabilizarActaUI);
document.getElementById("btn-recuento").addEventListener("click", recuentoUI);
document.getElementById("btn-constancia").addEventListener("click", constanciaUI);
document.getElementById("btn-proclamar").addEventListener("click", proclamarUI);

document.querySelectorAll(".example-code").forEach(button => {
  button.addEventListener("click", () => {
    document.getElementById("actaId").value = button.dataset.code;
    document.getElementById("search-type").value = "PRES";
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
