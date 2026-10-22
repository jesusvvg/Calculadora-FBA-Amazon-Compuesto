/* Verificación FBA obligatoria (Motor Scoring) — para TODOS los productos: manuales, Scanner o Nepeto.
 *
 * Regla aprobada por Jesús (2026-10-22):
 *  - FBA verificado y autorizado para la cuenta → puede continuar al Motor Scoring.
 *  - FBA no verificado → ESPERAR.   - Requiere aprobación / revisión → ESPERAR.   - No autorizado → DESCARTAR.
 *  - La verificación debe corresponder al mismo ASIN, marketplace, condición y modalidad FBA del producto.
 *  - Una verificación positiva vence (72 h): se revalida en Seller Central.
 * Solo afecta decisiones actuales y futuras: las operaciones y análisis guardados conservan su predicción.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FBA_VERIFICATION = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var KEY = "jev_v1", TTL_HOURS = 72, CHANNEL = "FBA";
  var STATUS = {
    FBA_ELIGIBLE: "FBA AUTORIZADO", REQUIRES_APPROVAL: "FBA REQUIERE APROBACIÓN", HAZMAT_REVIEW: "FBA EN REVISIÓN (HAZMAT)",
    FBA_RESTRICTED: "FBA NO AUTORIZADO", NOT_VERIFIED: "FBA NO VERIFICADO"
  };

  function norm(v) { return String(v === null || v === undefined ? "" : v).trim().toUpperCase(); }
  function label(status) { return STATUS[status] || STATUS.NOT_VERIFIED; }

  // Registro de una verificación: siempre ligado a ASIN + marketplace + condición + modalidad.
  function makeRecord(o) {
    var status = STATUS[o.status] ? o.status : "NOT_VERIFIED";
    var checkedAt = o.checkedAt || null;
    var validUntil = o.validUntil || (checkedAt ? new Date(Date.parse(checkedAt) + TTL_HOURS * 3600e3).toISOString() : null);
    return { status: status, label: label(status), asin: norm(o.asin), marketplace: norm(o.marketplace), condition: norm(o.condition),
      channel: CHANNEL, source: o.source || "MANUAL", checkedAt: checkedAt, evidenceAt: o.evidenceAt || checkedAt,
      validUntil: validUntil, note: o.note ? String(o.note).slice(0, 300) : "" };
  }

  // Puerta pura. Devuelve null solo si FBA está verificado, autorizado, vigente y corresponde al producto.
  function gate(s, nowMs) {
    var now = nowMs || Date.now(), f = s && s.fulfillment, p = (s && s.product) || {};
    if (!f || !f.status || f.status === "NOT_VERIFIED")
      return { decision: "ESPERAR", reason: "Falta verificar FBA en Seller Central para este ASIN (obligatorio)." };
    if (f.status === "FBA_RESTRICTED")
      return { decision: "DESCARTAR", reason: "FBA no autorizado para tu cuenta en este ASIN" + (f.source === "SCANNER" ? " (según el Scanner)." : ".") };
    if (f.status === "REQUIRES_APPROVAL" || f.status === "HAZMAT_REVIEW")
      return { decision: "ESPERAR", reason: label(f.status) + ": resuelve la aprobación en Seller Central antes de comprar." };
    if (f.status !== "FBA_ELIGIBLE")
      return { decision: "ESPERAR", reason: "Estado FBA desconocido: verifica en Seller Central." };
    var mismatch = [];
    if (!f.asin || norm(f.asin) !== norm(p.asin)) mismatch.push("ASIN");
    if (!f.marketplace || norm(f.marketplace) !== norm(p.marketplace || "US")) mismatch.push("marketplace");
    if (!f.condition || norm(f.condition) !== norm(p.condition || "NEW")) mismatch.push("condición");
    if (norm(f.channel) !== CHANNEL) mismatch.push("modalidad FBA");
    if (mismatch.length)
      return { decision: "ESPERAR", reason: "La verificación FBA no corresponde a este producto (" + mismatch.join(", ") + "): vuelve a verificar." };
    var until = f.validUntil ? Date.parse(f.validUntil) : NaN;
    if (!isFinite(until) || until <= now)
      return { decision: "ESPERAR", reason: "La verificación FBA caducó: revalídala en Seller Central." };
    var e = s.eligibility || {};
    if (e.source === "SCANNER") {
      var eu = e.validUntil ? Date.parse(e.validUntil) : NaN;
      if (!isFinite(eu) || eu <= now) return { decision: "ESPERAR", reason: "El permiso para publicar del Scanner caducó: revalídalo antes de decidir." };
    }
    return null;
  }

  // ---------- registro manual (solo navegador) ----------
  function esc(s) { return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function read(ls) { try { var v = JSON.parse(ls.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }

  function save(win, record) {
    var ls = win.localStorage, prev = ls.getItem(KEY), s = read(ls);
    s.fulfillment = record;
    try { ls.setItem(KEY, JSON.stringify(s)); }
    catch (e) { try { if (prev === null) ls.removeItem(KEY); else ls.setItem(KEY, prev); } catch (e2) { } return false; }
    return true;
  }

  function render(win) {
    var doc = win.document, host = doc.getElementById("jev_summary");
    if (!host || doc.getElementById("fba-verification")) return !!host;
    var s = read(win.localStorage), f = s.fulfillment || null, g = gate(s, Date.now());
    var box = doc.createElement("div");
    box.id = "fba-verification"; box.className = "note"; box.style.marginTop = "12px";
    var stateLine = f ? esc(f.label || label(f.status)) + " · " + esc(f.asin || "—") + " · " + esc(f.marketplace || "—") + " · " + esc(f.condition || "—") +
      " · " + esc(f.source || "—") + (f.checkedAt ? " · " + esc(new Date(f.checkedAt).toLocaleString("es-CL")) : (f.evidenceAt ? " · exportado " + esc(new Date(f.evidenceAt).toLocaleString("es-CL")) : "")) +
      (f.validUntil ? " · vence " + esc(new Date(f.validUntil).toLocaleString("es-CL")) : "") : "Sin verificación registrada";
    box.innerHTML = '<div class="flabel">Verificación FBA (obligatoria)</div>' +
      '<div class="hint" style="margin:0 0 8px">' + stateLine + "</div>" +
      (g ? '<div style="margin-bottom:8px;color:var(--' + (g.decision === "DESCARTAR" ? "bad" : "warn") + ')"><b>' + esc(g.decision) + "</b> · " + esc(g.reason) + "</div>"
         : '<div style="margin-bottom:8px;color:var(--good)"><b>FBA vigente</b> · puede continuar al Motor Scoring.</div>') +
      '<label class="f" style="margin-bottom:8px"><div class="flabel">Resultado en Seller Central</div><select id="fba_status">' +
      '<option value="NOT_VERIFIED">FBA NO VERIFICADO</option><option value="FBA_ELIGIBLE">FBA AUTORIZADO para mi cuenta</option>' +
      '<option value="REQUIRES_APPROVAL">FBA REQUIERE APROBACIÓN</option><option value="FBA_RESTRICTED">FBA NO AUTORIZADO</option></select></label>' +
      '<label class="f" style="margin-bottom:8px"><div class="flabel">Qué viste (obligatorio)</div><div class="fbox"><input id="fba_note" type="text" maxlength="300" autocomplete="off" placeholder="Ej. Add a Product → FBA sin restricción, 22-10"></div></label>' +
      '<button type="button" id="fba_save" class="linkbtn">Registrar verificación FBA para este ASIN, marketplace y condición</button>' +
      '<div class="hint">Se guarda ligada al ASIN, marketplace y condición actuales, con fecha. Vence en ' + TTL_HOURS + ' h. Las operaciones ya guardadas no cambian.</div>';
    host.parentNode.insertBefore(box, host.nextSibling);
    doc.getElementById("fba_save").addEventListener("click", function () {
      var note = doc.getElementById("fba_note").value.trim(), status = doc.getElementById("fba_status").value;
      var asin = (doc.getElementById("jev_asin") || {}).value, mk = (doc.getElementById("jev_marketplace") || {}).value, cond = (doc.getElementById("jev_condition") || {}).value;
      if (!/^[A-Z0-9]{10}$/.test(norm(asin))) { win.alert("Primero indica un ASIN válido."); return; }
      if (status !== "NOT_VERIFIED" && !note) { win.alert("Anota qué viste en Seller Central."); return; }
      var rec = makeRecord({ status: status, asin: asin, marketplace: mk || "US", condition: cond || "NEW", source: "MANUAL",
        checkedAt: status === "NOT_VERIFIED" ? null : new Date().toISOString(), note: note });
      if (!save(win, rec)) { win.alert("No se pudo guardar. No cambió nada."); return; }
      win.location.reload();   // recarga para que ningún módulo con estado antiguo pise el registro
    });
    return true;
  }

  function mount(win, tries) {
    tries = tries || 0;
    if (render(win) || tries > 40) return;
    win.setTimeout(function () { mount(win, tries + 1); }, 50);
  }
  if (typeof window !== "undefined" && window.document) {
    if (window.document.readyState === "loading") window.document.addEventListener("DOMContentLoaded", function () { mount(window); });
    else mount(window);
  }

  return { gate: gate, makeRecord: makeRecord, label: label, TTL_HOURS: TTL_HOURS, STATUS: STATUS };
});
