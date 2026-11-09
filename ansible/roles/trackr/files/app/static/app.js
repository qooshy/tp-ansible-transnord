// TrackR - poste du quai.
// Chaque saisie reçoit un identifiant unique ICI, puis part dans une file
// d'attente locale. La file est vidée vers le serveur dès qu'il répond ; s'il
// ne répond pas, rien n'est perdu et rien n'est saisi deux fois.
(function () {
  const QKEY = "trackr-file-attente";
  const $ = (s) => document.querySelector(s);
  const statusEl = $("#status");

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  const load = () => { try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch { return []; } };
  const save = (q) => localStorage.setItem(QKEY, JSON.stringify(q));

  function setStatus(kind, text) { statusEl.className = "status " + kind; statusEl.textContent = text; }
  const hhmm = (iso) => iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";

  let online = true, node = $("#node").textContent;

  async function flush() {
    const q = load();
    while (q.length) {
      try {
        const r = await fetch("/api/events", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-Requested-With": "trackr" },
          body: JSON.stringify(q[0]),
        });
        if (r.status === 401) { setStatus("warn", "Session expirée : reconnectez-vous. Vos saisies sont conservées."); return; }
        if (r.status === 400 || r.status === 403) { q.shift(); save(q); continue; }  // saisie invalide : abandonnée
        if (!r.ok) throw new Error(r.status);
        const body = await r.json(); node = body.node;
        q.shift(); save(q); online = true;
      } catch (e) { online = false; break; }
    }
    render(q.length);
  }

  function render(pending) {
    $("#node").textContent = node;
    if (!online) setStatus("down", `Serveur injoignable - ${pending} saisie(s) gardée(s) sur ce poste, envoi automatique dès le retour.`);
    else if (pending) setStatus("warn", `${pending} saisie(s) en cours d'envoi...`);
    else setStatus("ok", `Connecté - serveur ${node}`);
  }

  async function refresh() {
    try {
      const r = await fetch("/api/events", { credentials: "same-origin" });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json(); node = d.node; online = true;
      $("#k-arr").textContent = d.summary.arrivees;
      $("#k-dep").textContent = d.summary.departs;
      $("#k-late").textContent = d.summary.retards;
      const showWho = window.TRACKR.role !== "prestataire";
      $("#events").innerHTML = d.events.map((e) => `
        <tr class="${e.late ? "late" : ""}">
          <td>${hhmm(e.actual_at)}</td><td>${e.kind === "arrivee" ? "Arrivée" : "Départ"}</td>
          <td>${esc(e.plate)}</td><td>${esc(e.reference)}</td><td>${esc(e.quay || "")}</td>
          <td>${hhmm(e.scheduled_at)}</td><td>${e.late ? "RETARD" : "à l'heure"}</td>
          ${showWho ? `<td>${esc(e.recorded_by || "")}</td>` : ""}
        </tr>`).join("");
    } catch (e) { online = false; }
    render(load().length);
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const form = $("#entry");
  if (form) {
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = new FormData(form);
      let scheduled = null;
      if (f.get("scheduled")) {
        const [h, m] = f.get("scheduled").split(":");
        const d = new Date(); d.setHours(+h, +m, 0, 0); scheduled = d.toISOString();
      }
      const q = load();
      q.push({
        id: uuid(), kind: ev.submitter ? ev.submitter.value : "arrivee",
        plate: f.get("plate"), reference: f.get("reference"), quay: f.get("quay"),
        scheduled_at: scheduled, actual_at: new Date().toISOString(),
      });
      save(q);
      form.reset();
      form.querySelector("input").focus();
      flush().then(refresh);
    });
  }

  setInterval(() => flush().then(refresh), 5000);
  flush().then(refresh);
})();
