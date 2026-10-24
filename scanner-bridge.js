/* Puente Amazon Sourcing Scanner (JSON v2.3) → Calculador Amazon Compuesto.
 *
 * Núcleo puro (sin DOM ni localStorage) + interfaz de vista previa.
 * Reglas:
 *  - Leer y validar NO escribe nada. Solo «Importar seleccionados» escribe, y escribe
 *    UNA clave (motor_scoring_asin_v1); si el ASIN es el producto activo, además su
 *    evidencia externa en jev_v1, con restauración si la segunda escritura falla.
 *  - Los prospectos entran al catálogo como CANDIDATOS: nunca reemplazan el producto
 *    activo, ni tocan operaciones, capital, gastos ni análisis manuales.
 *  - Nada desconocido se interpreta como favorable. No se fabrican fechas: se conservan
 *    las del archivo (exported_at, last_checked, fees.fetched_at, expires_at).
 *  - Publicar (listing) y FBA son estados separados.
 *  - Etapa 5 (2026-10-24): la sección opcional `economic_review` trae candidatos en «Revisión económica»
 *    (pisos del Scanner no cumplidos o ganancia que depende de la logística supuesta). Entran como
 *    candidatos marcados, NUNCA como autorización de compra: conservan motivos, datos faltantes y
 *    procedencia de cada costo; pasan por la misma puerta FBA y se seleccionan a mano (no vienen marcados).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SCANNER_BRIDGE = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // La regla FBA vive en fba-verification.js (una sola puerta para productos manuales, Scanner o Nepeto).
  var FV = (typeof module === "object" && module.exports) ? require("./fba-verification.js")
    : (typeof self !== "undefined" ? self.FBA_VERIFICATION : null);
  var SCHEMA_V23 = "2.3", LEGACY_SCHEMA = "amazon-sourcing-scanner-prospect-v1";
  var GENERATOR = "Amazon Sourcing Scanner";
  var CATALOG_KEY = "motor_scoring_asin_v1", ACTIVE_KEY = "jev_v1", INPUTS_KEY = "fba_v2";
  var GLOBAL_INPUTS = ["p_presu", "p_plan", "c_corte1", "c_corte2", "c_banco"];
  var MAX_BYTES = 2 * 1024 * 1024, MAX_PROSPECTS = 500, MAX_TEXT = 500, MAX_MONEY = 100000, MAX_ECON_REVIEW = 50;
  var ECON = "ECONOMIC_REVIEW";
  var ASIN_RE = /^[A-Z0-9]{10}$/;

  var LISTING = { AUTHORIZED: "AUTORIZADO", REQUIRES_APPROVAL: "REQUIERE APROBACIÓN", NOT_AUTHORIZED: "NO AUTORIZADO" };
  var FBA = { FBA_ELIGIBLE: 1, FBA_RESTRICTED: 1, HAZMAT_REVIEW: 1, NOT_VERIFIED: 1 };
  var FBA_LABEL = { FBA_ELIGIBLE: "FBA AUTORIZADO", FBA_RESTRICTED: "FBA NO AUTORIZADO", HAZMAT_REVIEW: "FBA EN REVISIÓN (HAZMAT)", NOT_VERIFIED: "FBA NO VERIFICADO" };
  var V23_FIELDS = ["asin", "gtin", "source", "condition", "source_price", "source_regular_price", "shipping_cost", "source_tax",
    "source_tax_status", "source_acquisition_cost", "amazon_price", "bsr_current", "match_status", "match_confidence", "match_method",
    "listing_eligibility", "fulfillment_eligibility", "historical_data_status", "historical_source", "conservative_price",
    "manual_history_check", "fees_verified", "amazon_sale_price_conservative", "amazon_fees", "logistics_assumed",
    "net_profit_per_unit_estimate", "net_profit_excludes", "source_trust_level", "risk_flags", "opportunity_status",
    "status_reason", "source_url", "amazon_url", "last_checked", "expires_at", "logistics_status", "fba_verification",
    "candidate_type", "purchase_authorized", "economic_review"];
  var LOGISTICS = { ASSUMED: "supuesta", QUOTED: "cotizada", VERIFIED: "verificada" };
  var FV_METHODS = { USER_DECLARED: 1, SP_API: 1 };
  var FLAG_ES = {
    LOGISTICS_ASSUMED: "Logística supuesta", LOGISTICS_DEPENDENT: "Ganancia depende de la logística supuesta", ECONOMIC_FLOOR_WARNING: "Pisos del Scanner no cumplidos", TAX_ASSUMED: "Impuesto supuesto", NO_HISTORICAL_DATA: "Sin histórico propio",
    PRICE_ABOVE_RETAIL_REFERENCE: "Precio sobre referencia retail", SOURCE_TRUST_NOT_VERIFIED: "Confianza de la tienda no verificada",
    STOCK_NOT_VERIFIED: "Stock no verificado", BUY_BOX_SUPPRESSED: "Buy Box suprimida", FEES_NOT_VERIFIED: "Comisiones no verificadas",
    AMAZON_SELLS: "Amazon vende", AMAZON_PRESENCE_NOT_VERIFIED: "Presencia de Amazon no verificada",
    FBA_ELIGIBILITY_NOT_VERIFIED: "FBA no verificado", LISTING_ELIGIBILITY_NOT_VERIFIED: "Permiso para publicar no verificado",
    MANUAL_HISTORY_UNCLEAR: "Historial manual dudoso", MANUAL_HISTORY_CHECK_PENDING: "Historial manual pendiente",
    PRICE_DATA_STALE: "Precio de Amazon desactualizado", SOURCE_OFFER_STALE: "Oferta de la tienda desactualizada",
    ALTERNATIVE_OFFERS_AVAILABLE: "Hay otras ofertas"
  };

  // ---------- utilidades puras ----------
  function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function cleanText(v) {
    if (v === null || v === undefined) return null;
    if (typeof v !== "string") return null;
    var t = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    return t ? t.slice(0, MAX_TEXT) : null;
  }
  function upper(v) { var t = cleanText(v); return t ? t.toUpperCase() : null; }
  function isoOrNull(v) {
    if (typeof v !== "string") return null;
    var ms = Date.parse(v);
    return isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function safeUrl(v) {
    var t = cleanText(v);
    if (!t) return null;
    try { var u = new URL(t); return (u.protocol === "https:" || u.protocol === "http:") ? u.href : null; } catch (e) { return null; }
  }
  function marketplaceFromUrl(url) {
    if (!url) return null;
    try {
      var h = new URL(url).hostname.toLowerCase();
      if (h === "www.amazon.com" || h === "amazon.com") return "US";
      if (/(^|\.)amazon\.ca$/.test(h)) return "CA";
      if (/(^|\.)amazon\.com\.mx$/.test(h)) return "MX";
    } catch (e) { }
    return null;
  }
  // Dinero: número finito, en rango; positive=true exige > 0. null/ausente queda null (desconocido).
  function money(p, key, errors, opts) {
    var v = p[key];
    if (v === null || v === undefined) return null;
    if (typeof v !== "number" || !isFinite(v)) { errors.push(key + " no es un número válido"); return null; }
    if (v < 0 || v > MAX_MONEY) { errors.push(key + " fuera de rango (" + v + ")"); return null; }
    if (opts && opts.positive && v === 0) { errors.push(key + " debe ser mayor que 0"); return null; }
    return round2(v);
  }

  // ---------- lectura y validación ----------
  function parse(text, opts) {
    opts = opts || {};
    var now = opts.now ? new Date(opts.now).getTime() : Date.now();
    if (typeof text !== "string") return fail("No se pudo leer el archivo.");
    if (text.length > (opts.maxBytes || MAX_BYTES)) return fail("El archivo es demasiado grande para ser una exportación del Scanner (máx. 2 MB).");
    var doc;
    try { doc = JSON.parse(text); } catch (e) { return fail("El archivo no es un JSON válido."); }
    if (isObj(doc) && doc.schema === LEGACY_SCHEMA) return parseLegacy(doc, now);
    if (!isObj(doc) || doc.generator !== GENERATOR) return fail("El archivo no fue generado por Amazon Sourcing Scanner.");
    if (doc.schema_version !== SCHEMA_V23) return fail("Versión de esquema no soportada: " + String(doc.schema_version) + " (se espera 2.3).");
    if (!Array.isArray(doc.prospects)) return fail("Falta la lista de prospectos.");
    if (doc.prospects.length > MAX_PROSPECTS) return fail("Demasiados prospectos en un archivo (máx. " + MAX_PROSPECTS + ").");
    if (doc.count !== doc.prospects.length) return fail("El archivo está incompleto o alterado: count=" + doc.count + " pero trae " + doc.prospects.length + " prospectos.");
    var exportedAt = isoOrNull(doc.exported_at);
    if (!exportedAt) return fail("Fecha de exportación inválida.");
    var econ = doc.economic_review;
    if (econ !== undefined && econ !== null) {
      if (!Array.isArray(econ)) return fail("La sección «economic_review» tiene un formato inválido.");
      if (doc.economic_review_count !== econ.length) return fail("Revisión económica incompleta o alterada: economic_review_count=" + doc.economic_review_count + " pero trae " + econ.length + ".");
      var lim = doc.economic_review_limit;
      if (typeof lim !== "number" || !isFinite(lim) || lim < 0 || econ.length > lim || econ.length > MAX_ECON_REVIEW)
        return fail("Más candidatos en revisión económica que el límite del Scanner (" + String(lim) + "; máx. " + MAX_ECON_REVIEW + ").");
    } else econ = [];
    var seen = {}, mark = function (r) {
      if (r.asin && r.ok) { if (seen[r.asin]) { r.ok = false; r.duplicate = true; r.errors.push("ASIN repetido en el archivo (se usa el primero)"); } seen[r.asin] = true; }
      return r;
    };
    var records = doc.prospects.map(function (p, i) { return mark(normalizeV23(p, i, exportedAt, now)); });
    var prospectCount = records.length;
    econ.forEach(function (p, i) { records.push(mark(normalizeEconReview(p, prospectCount + i, exportedAt, now))); });
    return { ok: true, kind: "v2.3", exportedAt: exportedAt, disclaimer: cleanText(doc.disclaimer), count: records.length, records: records,
      prospectCount: prospectCount, economicReviewCount: records.length - prospectCount, economicReviewDisclaimer: cleanText(doc.economic_review_disclaimer) };
  }
  function fail(msg) { return { ok: false, error: msg, records: [] }; }

  // Procedencia de la verificación FBA. Si falta o no cuadra con el producto, se ignora (→ ESPERAR en la puerta):
  // nunca se completa ni se inventa una fecha.
  function parseFbaVerification(v, asin, fbaStatus, warnings) {
    if (v === null || v === undefined) return null;
    if (!isObj(v)) { warnings.push("fba_verification con formato inválido: se ignora"); return null; }
    var o = { status: upper(v.status), method: upper(v.method), origin: upper(v.source), asin: upper(v.asin), marketplace: upper(v.marketplace),
      condition: upper(v.condition), channel: upper(v.channel), accountRef: cleanText(v.account_ref), checkedAt: isoOrNull(v.checked_at),
      validUntil: isoOrNull(v.valid_until), note: cleanText(v.note) };
    var bad = [];
    if (o.status !== fbaStatus) bad.push("estado distinto de fulfillment_eligibility");
    if (!FV_METHODS[o.method]) bad.push("método desconocido");
    if (o.asin !== asin) bad.push("otro ASIN");
    if (!o.checkedAt) bad.push("sin fecha del chequeo");
    if (bad.length) { warnings.push("Verificación FBA ignorada (" + bad.join(", ") + ")"); return null; }
    if (o.accountRef && !/^[0-9a-f]{8,64}$/i.test(o.accountRef)) o.accountRef = null;
    if (o.note) o.note = o.note.slice(0, 300);
    return o;
  }

  // Candidato secundario: mismo contrato que un prospecto + su marca explícita de NO autorización.
  function normalizeEconReview(p, index, exportedAt, now) {
    var r = normalizeV23(p, index, exportedAt, now, true);
    if (!isObj(p)) return r;
    var er = p.economic_review;
    if (upper(p.candidate_type) !== ECON) r.errors.push("Candidato secundario sin candidate_type ECONOMIC_REVIEW");
    if (upper(p.opportunity_status) !== ECON) r.errors.push("Candidato secundario con estado distinto de ECONOMIC_REVIEW");
    if (p.purchase_authorized !== false) r.errors.push("Un candidato en revisión económica no puede venir como autorización de compra");
    if (!isObj(er) || !Array.isArray(er.reasons) || !er.reasons.length) r.errors.push("Faltan los motivos de la revisión económica");
    var list = function (v, f) { return Array.isArray(v) ? v.map(f).filter(Boolean).slice(0, 20) : []; };
    var cb = isObj(er) && isObj(er.cost_basis) ? er.cost_basis : {};
    var review = isObj(er) ? { reasons: list(er.reasons, cleanText), flags: list(er.flags, upper), missingData: list(er.missing_data, upper),
      costBasis: { logistics: upper(cb.logistics) || "ASSUMED", sourceTax: upper(cb.source_tax) || "NOT_VERIFIED", amazonFees: upper(cb.amazon_fees) || "NOT_VERIFIED" },
      spread: (typeof er.spread === "number" && isFinite(er.spread)) ? round2(er.spread) : null,
      costRatio: (typeof er.cost_ratio === "number" && isFinite(er.cost_ratio)) ? er.cost_ratio : null } : null;
    r.candidateType = ECON;
    r.warnings.unshift("Revisión económica: NO es autorización de compra; el Calculador decide con costos reales");
    if (r.errors.length) { r.ok = false; r.data = null; return r; }
    r.data.candidateType = ECON; r.data.purchaseAuthorized = false; r.data.economicReview = review;
    return r;
  }

  function normalizeV23(p, index, exportedAt, now, secondary) {
    var errors = [], warnings = [];
    if (!isObj(p)) return { index: index, asin: null, ok: false, errors: ["Registro no es un objeto"], warnings: [], data: null };
    var st = upper(p.opportunity_status);
    if (!secondary && (st === ECON || st === "REVIEW" || st === "DISCARD" || p.candidate_type !== undefined))
      errors.push("Registro que no es prospecto dentro de «prospects» (" + (st || "sin estado") + ")");
    var asin = upper(p.asin);
    if (!asin || !ASIN_RE.test(asin)) errors.push("ASIN inválido o ausente");
    var gtin = null;
    if (p.gtin !== null && p.gtin !== undefined) {
      if (typeof p.gtin !== "string") errors.push("GTIN debe venir como texto (si es número se pierden los ceros iniciales)");
      else if (!/^\d{8,14}$/.test(p.gtin)) errors.push("GTIN con formato inválido");
      else gtin = p.gtin;
    } else warnings.push("Sin GTIN en el archivo");
    var condition = upper(p.condition);
    if (condition !== "NEW") errors.push("Condición no admitida: " + (condition || "vacía") + " (solo NEW)");
    var listingRaw = upper(p.listing_eligibility), fbaRaw = upper(p.fulfillment_eligibility);
    var fbaStatus = fbaRaw && FBA[fbaRaw] ? fbaRaw : "NOT_VERIFIED";
    if (fbaRaw && !FBA[fbaRaw]) warnings.push("Estado FBA desconocido («" + fbaRaw + "»): se trata como NO VERIFICADO");
    var fv = parseFbaVerification(p.fba_verification, asin, fbaStatus, warnings);
    var fees = null;
    if (p.amazon_fees !== null && p.amazon_fees !== undefined) {
      if (!isObj(p.amazon_fees)) errors.push("amazon_fees con formato inválido");
      else {
        var fe = [];
        fees = { total: money(p.amazon_fees, "total", fe), referral: money(p.amazon_fees, "referral", fe), fba: money(p.amazon_fees, "fba", fe),
          other: money(p.amazon_fees, "other", fe), source: cleanText(p.amazon_fees.source), fetchedAt: isoOrNull(p.amazon_fees.fetched_at) };
        fe.forEach(function (x) { errors.push("amazon_fees." + x); });
        if (fees.total === null) errors.push("amazon_fees.total ausente");
        else if (fees.referral !== null && fees.fba !== null && Math.abs((fees.referral + fees.fba + (fees.other || 0)) - fees.total) > 0.02)
          warnings.push("Las comisiones desglosadas no suman el total informado");
      }
    }
    var d = {
      asin: asin, gtin: gtin, condition: condition,
      source: cleanText(p.source), sourceUrl: safeUrl(p.source_url), amazonUrl: safeUrl(p.amazon_url),
      sourcePrice: money(p, "source_price", errors, { positive: true }), sourceRegularPrice: money(p, "source_regular_price", errors),
      shippingCost: money(p, "shipping_cost", errors), sourceTax: money(p, "source_tax", errors),
      sourceTaxStatus: upper(p.source_tax_status), acquisitionCost: money(p, "source_acquisition_cost", errors),
      amazonPrice: money(p, "amazon_price", errors, { positive: true }),
      salePrice: money(p, "amazon_sale_price_conservative", errors, { positive: true }),
      bsrCurrent: (typeof p.bsr_current === "number" && isFinite(p.bsr_current) && p.bsr_current > 0) ? Math.round(p.bsr_current) : null,
      matchStatus: upper(p.match_status), matchConfidence: upper(p.match_confidence), matchMethod: upper(p.match_method),
      listingRaw: listingRaw, listingStatus: LISTING[listingRaw] || "NO VERIFICADO",
      fbaStatus: fbaStatus, fees: fees, feesVerified: p.fees_verified === true && !!fees && fees.total !== null,
      logisticsAssumed: money(p, "logistics_assumed", errors),
      logisticsStatus: LOGISTICS[upper(p.logistics_status)] ? upper(p.logistics_status) : "ASSUMED",
      fbaVerification: fv,
      netProfitEstimate: (typeof p.net_profit_per_unit_estimate === "number" && isFinite(p.net_profit_per_unit_estimate)) ? round2(p.net_profit_per_unit_estimate) : null,
      netProfitExcludes: Array.isArray(p.net_profit_excludes) ? p.net_profit_excludes.map(cleanText).filter(Boolean).slice(0, 20) : [],
      historicalDataStatus: upper(p.historical_data_status), historicalSource: upper(p.historical_source),
      conservativePrice: money(p, "conservative_price", errors), manualHistoryCheck: upper(p.manual_history_check),
      sourceTrustLevel: upper(p.source_trust_level),
      riskFlags: Array.isArray(p.risk_flags) ? p.risk_flags.map(upper).filter(Boolean).slice(0, 50) : [],
      opportunityStatus: upper(p.opportunity_status), statusReason: cleanText(p.status_reason),
      lastChecked: isoOrNull(p.last_checked), expiresAt: isoOrNull(p.expires_at), exportedAt: exportedAt,
      marketplace: marketplaceFromUrl(safeUrl(p.amazon_url))
    };
    if (p.source_url && !d.sourceUrl) warnings.push("Link de la tienda descartado (no es http/https)");
    if (!d.salePrice && !d.amazonPrice) errors.push("Sin precio de venta en Amazon");
    if (!d.expiresAt) warnings.push("Sin fecha de vencimiento: se trata como caducado");
    var expired = !d.expiresAt || Date.parse(d.expiresAt) <= now;
    if (expired) warnings.push("Datos caducados: revalida precio, permisos y FBA antes de decidir");
    if (!d.marketplace) warnings.push("Marketplace no identificado en el archivo");
    if (d.listingStatus !== "AUTORIZADO") warnings.push("Permiso para publicar: " + d.listingStatus);
    if (d.fbaStatus !== "FBA_ELIGIBLE") warnings.push("FBA: " + FBA_LABEL[d.fbaStatus]);
    else if (!fv) warnings.push("FBA declarado sin procedencia (fecha, cuenta y nota): queda en ESPERAR hasta verificarlo");
    if (!d.feesVerified) warnings.push("Comisiones de Amazon no verificadas");
    if (d.sourceTaxStatus === "ASSUMED") warnings.push("Impuesto de la tienda supuesto, no confirmado");
    var unknown = Object.keys(p).filter(function (k) { return V23_FIELDS.indexOf(k) < 0; });
    if (unknown.length) warnings.push("Campos no reconocidos ignorados: " + unknown.slice(0, 5).join(", "));
    return { index: index, asin: asin, ok: errors.length === 0, expired: expired, errors: errors, warnings: warnings, data: errors.length ? null : d };
  }

  // Contrato legado v1: un prospecto. Se lee sin inventar frescura ni ampliar su significado.
  function parseLegacy(doc, now) {
    var p = isObj(doc.prospect) ? doc.prospect : null;
    if (!p) return fail("Contrato v1 sin el objeto «prospect».");
    var errors = [], warnings = ["Formato antiguo (v1): sin comisiones, costos de tienda ni estado FBA"];
    var asin = upper(p.asin);
    if (!asin || !ASIN_RE.test(asin)) errors.push("ASIN inválido o ausente");
    var elig = isObj(p.eligibility) ? p.eligibility : {};
    var est = upper(elig.status), listing = ({ "AUTORIZADO": "AUTORIZADO", "REQUIERE APROBACIÓN": "REQUIERE APROBACIÓN", "NO AUTORIZADO": "NO AUTORIZADO" })[est] || "NO VERIFICADO";
    var price = (typeof p.priceCurrent === "number" && isFinite(p.priceCurrent) && p.priceCurrent > 0) ? round2(p.priceCurrent) : null;
    var mk = upper(p.marketplace);
    var d = { asin: asin, gtin: typeof p.upcEan === "string" && /^\d{8,14}$/.test(p.upcEan) ? p.upcEan : null, condition: "NEW",
      source: null, sourceUrl: null, amazonUrl: null, sourcePrice: null, sourceRegularPrice: null, shippingCost: null, sourceTax: null,
      sourceTaxStatus: null, acquisitionCost: null, amazonPrice: price, salePrice: price,
      bsrCurrent: isObj(p.market) && typeof p.market.bsrCurrent === "number" && p.market.bsrCurrent > 0 ? Math.round(p.market.bsrCurrent) : null,
      matchStatus: null, matchConfidence: null, matchMethod: null, listingRaw: est, listingStatus: listing, fbaStatus: "NOT_VERIFIED",
      fees: null, feesVerified: false, logisticsAssumed: null, netProfitEstimate: null, netProfitExcludes: [], historicalDataStatus: null,
      historicalSource: null, conservativePrice: null, manualHistoryCheck: null, sourceTrustLevel: null, riskFlags: [],
      opportunityStatus: null, statusReason: null, lastChecked: isoOrNull(elig.checkedAt), expiresAt: null, exportedAt: null,
      marketplace: mk === "US" || mk === "CA" || mk === "MX" ? mk : null, brand: cleanText(p.brand), category: cleanText(p.category) };
    if (p.condition && upper(p.condition) !== "NEW") errors.push("Condición no admitida (solo NEW)");
    if (!price) errors.push("Sin precio de venta en Amazon");
    warnings.push("Sin fecha de vencimiento: se trata como caducado");
    var r = { index: 0, asin: asin, ok: errors.length === 0, expired: true, errors: errors, warnings: warnings, data: errors.length ? null : d };
    return { ok: true, kind: "legacy-v1", exportedAt: null, disclaimer: null, count: 1, records: [r] };
  }

  // ---------- construcción del candidato ----------
  function evidenceFrom(d, kind) {
    return { contract: kind, exportedAt: d.exportedAt, lastChecked: d.lastChecked, expiresAt: d.expiresAt, marketplace: d.marketplace,
      gtin: d.gtin, source: d.source, sourceUrl: d.sourceUrl, amazonUrl: d.amazonUrl, sourcePrice: d.sourcePrice,
      sourceRegularPrice: d.sourceRegularPrice, shippingCost: d.shippingCost, sourceTax: d.sourceTax, sourceTaxStatus: d.sourceTaxStatus,
      acquisitionCost: d.acquisitionCost, amazonPrice: d.amazonPrice, salePrice: d.salePrice, bsrCurrent: d.bsrCurrent,
      matchStatus: d.matchStatus, matchConfidence: d.matchConfidence, matchMethod: d.matchMethod, listingRaw: d.listingRaw,
      fbaStatus: d.fbaStatus, fbaVerification: d.fbaVerification || null, fees: d.fees, feesVerified: d.feesVerified,
      logisticsAssumed: d.logisticsAssumed, logisticsStatus: d.logisticsStatus || "ASSUMED",
      netProfitEstimate: d.netProfitEstimate, netProfitExcludes: d.netProfitExcludes, historicalDataStatus: d.historicalDataStatus,
      historicalSource: d.historicalSource, conservativePrice: d.conservativePrice, manualHistoryCheck: d.manualHistoryCheck,
      sourceTrustLevel: d.sourceTrustLevel, riskFlags: d.riskFlags, opportunityStatus: d.opportunityStatus, statusReason: d.statusReason,
      candidateType: d.candidateType || "PROSPECT", purchaseAuthorized: d.candidateType === ECON ? false : null,
      economicReview: d.economicReview || null };
  }
  // Evidencia externa = lo que el Scanner afirma. Se puede refrescar sin tocar el análisis manual.
  function applyEvidence(state, d, kind, importedAt, marketplace) {
    state.scanner = evidenceFrom(d, kind);
    state.scanner.importedAt = importedAt;
    // Verificación FBA ligada al ASIN, marketplace, condición y modalidad que verificó el Scanner, con su procedencia
    // (método, cuenta, fecha real del chequeo y nota). Sin procedencia, checkedAt queda null y la puerta da ESPERAR.
    var prevF = state.fulfillment || {}, v = d.fbaVerification || null;
    var scannerAt = v && v.checkedAt ? v.checkedAt : d.exportedAt;
    // Una verificación manual MÁS RECIENTE que la del Scanner manda: no se pisa.
    var manualNewer = prevF.source === "MANUAL" && prevF.checkedAt && scannerAt && Date.parse(prevF.checkedAt) > Date.parse(scannerAt);
    if (!manualNewer) {
      var until = d.expiresAt;
      if (v && v.validUntil && (!until || Date.parse(v.validUntil) < Date.parse(until))) until = v.validUntil;
      state.fulfillment = { status: d.fbaStatus, label: FV ? FV.label(d.fbaStatus) : FBA_LABEL[d.fbaStatus], asin: v ? v.asin : d.asin,
        marketplace: (v && v.marketplace) || marketplace || d.marketplace || null, condition: v ? v.condition : "NEW",
        channel: v ? v.channel : "FBA", source: "SCANNER", method: v ? v.method : null, origin: v ? v.origin : null,
        accountRef: v ? v.accountRef : null, checkedAt: v ? v.checkedAt : null, evidenceAt: d.exportedAt, validUntil: until,
        note: v && v.note ? v.note : "" };
    }
    // El permiso para publicar solo se actualiza si nadie lo fijó a mano.
    var e = state.eligibility || {};
    if (!e.source || e.source === "SCANNER" || (e.status === "NO VERIFICADO" && !e.checkedAt)) {
      state.eligibility = { status: d.listingStatus, source: "SCANNER", checkedAt: null, evidenceAt: d.exportedAt, validUntil: d.expiresAt };
    }
    return state;
  }
  function newCandidate(d, kind, importedAt, defaults, currentInputs, marketplace) {
    var state = { version: 1,
      product: { asin: d.asin, upcEan: d.gtin || "", brand: d.brand || "", category: d.category || "", marketplace: marketplace,
        condition: "NEW", stage: "CANDIDATO" },
      eligibility: {}, financial: {}, market: { amazonSeller: "NO VERIFICADO", source: "SCANNER", checkedAt: d.lastChecked },
      risk: {}, rotation: {}, capitalEfficiency: {}, dataConfidence: {}, decision: {} };
    if (d.bsrCurrent !== null) state.market.bsrCurrent = d.bsrCurrent;
    applyEvidence(state, d, kind, importedAt, marketplace);
    var inputs = Object.assign({}, defaults || {});
    inputs.p_precio = ""; inputs.p_cogs = ""; inputs.p_flete = ""; inputs.p_unid = "1";
    GLOBAL_INPUTS.forEach(function (k) { if (currentInputs && currentInputs[k] !== undefined) inputs[k] = currentInputs[k]; });
    var sale = d.salePrice || d.amazonPrice;
    if (sale) inputs.p_precio = String(sale);
    if (sale && d.feesVerified && d.fees.referral !== null) inputs.p_ref = String(round2(d.fees.referral / sale * 100));
    if (d.feesVerified && d.fees.fba !== null) inputs.p_fba = String(round2(d.fees.fba + (d.fees.other || 0)));
    // Costos de la tienda NO se cargan: el Scanner los informa por unidad y con impuesto a veces supuesto;
    // se muestran como evidencia y los confirmas tú en «Costo real y Prep Center».
    return { asin: d.asin, updatedAt: importedAt, state: state, inputs: inputs, origin: "SCANNER" };
  }

  // ---------- plan de importación (puro) ----------
  function plan(storage, parsed, selected, opts) {
    opts = opts || {};
    var importedAt = opts.importedAt || new Date().toISOString();
    var catalog = clone(isObj(storage.catalog) ? storage.catalog : {});
    var active = isObj(storage.active) ? clone(storage.active) : {};
    var activeAsin = active.product && active.product.asin ? String(active.product.asin).trim().toUpperCase() : "";
    var activeChanged = false, results = [], want = {};
    (selected || []).forEach(function (a) { want[String(a).toUpperCase()] = true; });
    parsed.records.forEach(function (r) {
      if (!r.asin || !want[r.asin] || r.duplicate && !r.ok) {
        if (r.asin && want[r.asin] && r.duplicate) results.push({ asin: r.asin, action: "DUPLICADO", reason: r.errors.join("; ") });
        return;
      }
      if (!r.ok) { results.push({ asin: r.asin, action: "RECHAZADO", reason: r.errors.join("; ") }); return; }
      var d = r.data, marketplace = d.marketplace || opts.marketplace || null;
      if (!marketplace) { results.push({ asin: r.asin, action: "RECHAZADO", reason: "Marketplace sin confirmar" }); return; }
      if (r.asin === activeAsin) {
        if (active.scanner && active.scanner.exportedAt && active.scanner.exportedAt === d.exportedAt) { results.push({ asin: r.asin, action: "SIN CAMBIOS", reason: "Mismo archivo ya importado" }); return; }
        applyEvidence(active, d, parsed.kind, importedAt, marketplace); activeChanged = true;
        results.push({ asin: r.asin, action: "EVIDENCIA ACTUALIZADA", reason: "Producto activo: se conserva tu análisis; solo cambia la evidencia del Scanner" });
        return;
      }
      var rec = catalog[r.asin];
      if (isObj(rec) && isObj(rec.state)) {
        if (rec.state.scanner && rec.state.scanner.exportedAt && rec.state.scanner.exportedAt === d.exportedAt) { results.push({ asin: r.asin, action: "SIN CAMBIOS", reason: "Mismo archivo ya importado" }); return; }
        applyEvidence(rec.state, d, parsed.kind, importedAt, marketplace); rec.updatedAt = importedAt;
        results.push({ asin: r.asin, action: "EVIDENCIA ACTUALIZADA", reason: "Ya estaba en tu catálogo: se conserva tu análisis" });
        return;
      }
      catalog[r.asin] = newCandidate(d, parsed.kind, importedAt, opts.defaults, storage.inputs, marketplace);
      results.push({ asin: r.asin, action: "NUEVO", reason: d.candidateType === ECON
        ? "Agregado como candidato en REVISIÓN ECONÓMICA (no autoriza compra)" : "Agregado al catálogo como candidato" });
    });
    return { catalog: catalog, active: activeChanged ? active : null, results: results };
  }

  // Escritura: catálogo primero; si hay evidencia del activo, después jev_v1. Si falla, se restaura todo.
  function apply(ls, p) {
    var prev = {}, written = [];
    var changedCatalog = p.results.some(function (r) { return r.action === "NUEVO" || r.action === "EVIDENCIA ACTUALIZADA"; });
    var writes = [];
    if (changedCatalog) writes.push([CATALOG_KEY, JSON.stringify(p.catalog)]);
    if (p.active) writes.push([ACTIVE_KEY, JSON.stringify(p.active)]);
    try {
      writes.forEach(function (w) { prev[w[0]] = ls.getItem(w[0]); ls.setItem(w[0], w[1]); written.push(w[0]); });
      return { ok: true };
    } catch (e) {
      // Solo se restaura lo que alcanzó a escribirse: una escritura fallida no cambia su clave.
      var restoreError = null;
      written.reverse().forEach(function (k) {
        try { if (prev[k] === null) ls.removeItem(k); else ls.setItem(k, prev[k]); } catch (e2) { restoreError = e2; }
      });
      return { ok: false, error: "No se pudo guardar (" + (e && e.name || "error") + "). " +
        (restoreError ? "ATENCIÓN: no se pudo restaurar automáticamente; usa «Restaurar respaldo»." : "No se guardó nada: tus datos quedaron como estaban.") };
    }
  }

  // Puerta FBA (pura): delega en fba-verification.js, la misma regla para todos los productos.
  function fbaGate(s, nowMs) { return FV ? FV.gate(s, nowMs) : { decision: "ESPERAR", reason: "Módulo de verificación FBA no cargado." }; }

  // ---------- interfaz (solo en navegador) ----------
  function esc(s) { return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function usd(n) { return n === null || n === undefined ? "—" : "US$" + Number(n).toFixed(2); }
  function fdate(iso) { if (!iso) return "—"; var d = new Date(iso); return isFinite(d) ? d.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—"; }
  function tag(text, tone) { return '<span class="sb-tag ' + (tone || "") + '">' + esc(text) + "</span>"; }
  function flagEs(f) { return FLAG_ES[f] || f; }

  function injectStyles(doc) {
    if (doc.getElementById("scanner-bridge-style")) return;
    var st = doc.createElement("style"); st.id = "scanner-bridge-style";
    st.textContent = ".sb-preview{margin-top:12px}.sb-head{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-size:13px;color:var(--muted);margin-bottom:10px}" +
      ".sb-table td,.sb-table th{font-size:13px}.sb-table td.n{white-space:nowrap}.sb-tag{display:inline-block;font:600 11px var(--mono);padding:2px 7px;border-radius:4px;background:var(--line);margin:1px 2px 1px 0}" +
      ".sb-tag.good{background:color-mix(in srgb,var(--good) 18%,transparent);color:var(--good)}.sb-tag.warn{background:color-mix(in srgb,var(--warn) 18%,transparent);color:var(--warn)}" +
      ".sb-tag.bad{background:color-mix(in srgb,var(--bad) 15%,transparent);color:var(--bad)}.sb-warn{font-size:12px;color:var(--muted);margin-top:3px}" +
      ".sb-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:12px 0}.sb-btn{font:inherit;font-weight:600;padding:8px 14px;border-radius:6px;border:1px solid var(--accent);background:var(--accent);color:var(--accentInk,#fff);cursor:pointer;min-height:40px}" +
      ".sb-btn.sec{background:transparent;color:var(--ink);border-color:var(--line)}.sb-btn:disabled{opacity:.45;cursor:not-allowed}" +
      ".sb-result{font-size:13px;margin:4px 0}.sb-ev{margin-bottom:16px}.sb-ev .kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:10px 0}" +
      ".sb-ev .kv div{border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12px;color:var(--muted)}.sb-ev .kv b{display:block;font:600 15px var(--mono);color:var(--ink);margin-top:2px}";
    doc.head.appendChild(st);
  }

  function readStorage(ls) {
    function j(k) { try { var v = JSON.parse(ls.getItem(k) || "null"); return isObj(v) ? v : null; } catch (e) { return null; } }
    return { catalog: j(CATALOG_KEY) || {}, active: j(ACTIVE_KEY) || {}, inputs: j(INPUTS_KEY) || {} };
  }

  function renderPreview(host, parsed, win) {
    var doc = host.ownerDocument;
    injectStyles(doc);
    var box = doc.getElementById("sb-preview");
    if (!box) { box = doc.createElement("div"); box.id = "sb-preview"; box.className = "sb-preview"; host.appendChild(box); }
    if (!parsed.ok) { box.innerHTML = '<div class="note" style="border-left:4px solid var(--bad)">' + esc(parsed.error) + " No se guardó nada.</div>"; return; }
    var store = readStorage(win.localStorage), activeAsin = String(store.active.product && store.active.product.asin || "").toUpperCase();
    var needsMarket = parsed.records.some(function (r) { return r.ok && !r.data.marketplace; });
    var rows = parsed.records.map(function (r) {
      var d = r.data, exists = r.asin && (r.asin === activeAsin || store.catalog[r.asin]);
      var isEcon = r.candidateType === ECON;
      // Los candidatos en revisión económica no vienen marcados: se eligen a propósito.
      var check = r.ok ? '<input type="checkbox" class="sb-pick" value="' + esc(r.asin) + '"' + (isEcon ? "" : " checked") + ' aria-label="Importar ' + esc(r.asin) + '">' : "—";
      var state = !r.ok ? tag(r.duplicate ? "DUPLICADO" : "RECHAZADO", "bad") : (exists ? tag(r.asin === activeAsin ? "ACTIVO · solo evidencia" : "YA EN CATÁLOGO · solo evidencia", "warn") : tag("NUEVO", "good"));
      if (r.ok && r.expired) state += tag("CADUCADO", "bad");
      if (isEcon) state = tag("REVISIÓN ECONÓMICA · no autoriza compra", "warn") + state +
        (d && d.economicReview ? '<div class="sb-warn">' + esc(d.economicReview.reasons.join(" · ")) + "</div>" : "");
      if (!d) return "<tr><td>" + check + "</td><td>" + esc(r.asin || "(sin ASIN)") + "</td><td colspan=\"7\">" + state + '<div class="sb-warn">' + esc(r.errors.join(" · ")) + "</div></td></tr>";
      var src = d.sourceUrl ? '<a href="' + esc(d.sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(d.source || "tienda") + "</a>" : esc(d.source || "—");
      return "<tr><td>" + check + "</td><td><b>" + esc(d.asin) + '</b><div class="sb-warn">GTIN ' + esc(d.gtin || "—") + "</div></td>" +
        "<td>" + src + '<div class="sb-warn">' + usd(d.sourcePrice) + " · costo " + usd(d.acquisitionCost) + (d.sourceTaxStatus === "ASSUMED" ? " (imp. supuesto)" : "") + "</div></td>" +
        '<td class="n">' + usd(d.salePrice || d.amazonPrice) + '<div class="sb-warn">BSR ' + esc(d.bsrCurrent || "—") + "</div></td>" +
        "<td>" + tag("Publicar: " + d.listingStatus, d.listingStatus === "AUTORIZADO" ? "good" : (d.listingStatus === "NO AUTORIZADO" ? "bad" : "warn")) +
        tag(FBA_LABEL[d.fbaStatus], d.fbaStatus === "FBA_ELIGIBLE" ? "good" : (d.fbaStatus === "FBA_RESTRICTED" ? "bad" : "warn")) + "</td>" +
        "<td>" + tag("Match " + (d.matchStatus || "—") + " · " + (d.matchConfidence || "—"), d.matchStatus === "EXACT" ? "" : "warn") + "</td>" +
        '<td class="n">' + usd(d.netProfitEstimate) + '<div class="sb-warn">estimado · costes pendientes</div></td>' +
        "<td>" + state + '<div class="sb-warn">' + esc(r.warnings.join(" · ")) + "</div></td>" +
        '<td class="n">' + esc(fdate(d.lastChecked)) + '<div class="sb-warn">vence ' + esc(fdate(d.expiresAt)) + "</div></td></tr>";
    }).join("");
    var okCount = parsed.records.filter(function (r) { return r.ok; }).length, econCount = parsed.economicReviewCount || 0;
    box.innerHTML =
      '<div class="sb-head"><span><b>' + (parsed.records.length - econCount) + "</b> prospectos" + (econCount ? " · <b>" + econCount + "</b> en revisión económica" : "") +
      " · <b>" + okCount + "</b> válidos · " + (parsed.records.length - okCount) + " rechazados</span>" +
      "<span>Exportado " + esc(fdate(parsed.exportedAt)) + " · formato " + esc(parsed.kind) + "</span>" +
      (needsMarket ? '<label>Marketplace <select id="sb-market"><option value="">Elegir…</option><option value="US">Amazon.com · US</option><option value="CA">Amazon.ca · CA</option><option value="MX">Amazon.com.mx · MX</option></select></label>' : "") + "</div>" +
      '<div class="note" style="margin-bottom:10px">Vista previa: <b>todavía no se guardó nada</b>. Los seleccionados entran a tu catálogo como <b>candidatos</b>; tu producto activo, operaciones, capital y gastos no cambian. Ganancia y comisiones son <b>estimaciones del Scanner</b>; los costos de la tienda no se cargan solos. Importar no es una orden de compra.' +
      (econCount ? ' Los candidatos en <b>revisión económica</b> no cumplen los pisos del Scanner o su ganancia depende de la logística supuesta: vienen sin marcar y <b>no son autorización de compra</b>.' : "") + '</div>' +
      '<div class="scroll"><table class="sb-table"><thead><tr><th></th><th>ASIN</th><th>Tienda</th><th class="r">Venta Amazon</th><th>Permisos</th><th>Match</th><th class="r">Ganancia prelim./u</th><th>Estado y avisos</th><th class="r">Dato Amazon</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="sb-actions"><button type="button" class="sb-btn" id="sb-confirm"' + (okCount ? "" : " disabled") + '>Importar seleccionados</button><button type="button" class="sb-btn sec" id="sb-cancel">Cancelar</button></div><div id="sb-results"></div>';
    doc.getElementById("sb-cancel").addEventListener("click", function () { box.remove(); });
    doc.getElementById("sb-confirm").addEventListener("click", function () {
      var picks = Array.prototype.map.call(box.querySelectorAll(".sb-pick:checked"), function (x) { return x.value; });
      var mk = doc.getElementById("sb-market"), market = mk ? mk.value : null;
      if (mk && !market) { showResults(box, [], "Elige el marketplace del archivo antes de importar.", "bad"); return; }
      if (!picks.length) { showResults(box, [], "No hay prospectos ni candidatos seleccionados.", "bad"); return; }
      var current = readStorage(win.localStorage);
      var pl = plan(current, parsed, picks, { marketplace: market, defaults: win.DEF || {}, importedAt: new Date().toISOString() });
      var res = apply(win.localStorage, pl);
      if (!res.ok) { showResults(box, pl.results, res.error, "bad"); return; }
      doc.getElementById("sb-confirm").disabled = true;
      var counts = { NUEVO: 0, "EVIDENCIA ACTUALIZADA": 0, "SIN CAMBIOS": 0, RECHAZADO: 0, DUPLICADO: 0 };
      pl.results.forEach(function (r) { counts[r.action] = (counts[r.action] || 0) + 1; });
      showResults(box, pl.results, counts.NUEVO + " nuevos · " + counts["EVIDENCIA ACTUALIZADA"] + " con evidencia actualizada · " + counts["SIN CAMBIOS"] + " sin cambios · " +
        (counts.RECHAZADO + counts.DUPLICADO) + " rechazados." + (pl.active ? " Recargando para mostrar la evidencia del producto activo…" : ""), "good", win);
      if (pl.active) win.setTimeout(function () { win.location.reload(); }, 600);
    });
  }

  function showResults(box, results, summary, tone, win) {
    var el = box.querySelector("#sb-results");
    var rows = results.map(function (r) {
      var open = win && (r.action === "NUEVO" || r.action === "EVIDENCIA ACTUALIZADA" || r.action === "SIN CAMBIOS") ? ' <button type="button" class="sb-btn sec sb-open" data-asin="' + esc(r.asin) + '">Abrir en el Calculador</button>' : "";
      return '<div class="sb-result"><b>' + esc(r.asin) + "</b> · " + esc(r.action) + " · " + esc(r.reason) + open + "</div>";
    }).join("");
    el.innerHTML = '<div class="note" style="border-left:4px solid var(--' + (tone === "bad" ? "bad" : "good") + ')">' + esc(summary) + "</div>" + rows;
    Array.prototype.forEach.call(el.querySelectorAll(".sb-open"), function (b) {
      b.addEventListener("click", function () { openInCalculator(win, b.getAttribute("data-asin")); });
    });
  }

  // Abre un candidato con el mecanismo existente del Calculador (archiva el activo y carga el ASIN).
  function openInCalculator(win, asin) {
    var doc = win.document, field = doc.getElementById("jev_asin");
    if (!field) return;
    var tab = doc.getElementById("t-prod"); if (tab) tab.click();
    field.value = asin;
    field.dispatchEvent(new win.Event("change", { bubbles: true }));
  }

  // Tarjeta «Datos del Scanner» en Análisis de producto, si el producto activo vino del Scanner.
  function renderEvidence(win) {
    var doc = win.document, sect = doc.getElementById("p-prod");
    if (!sect) return;
    var st = readStorage(win.localStorage).active, s = st.scanner;
    var old = doc.getElementById("sb-evidence"); if (old) old.remove();
    if (!s) return;
    injectStyles(doc);
    var now = Date.now(), expired = !s.expiresAt || Date.parse(s.expiresAt) <= now, f = st.fulfillment || {};
    var gate = fbaGate(st, now);
    var card = doc.createElement("div"); card.id = "sb-evidence"; card.className = "card sb-ev";
    var flags = (s.riskFlags || []).map(function (x) { return tag(flagEs(x), "warn"); }).join("");
    var er = s.candidateType === ECON ? (s.economicReview || { reasons: [], missingData: [], costBasis: {} }) : null;
    var econBox = er ? '<div class="note" style="margin-top:8px;border-left:4px solid var(--warn)"><b>REVISIÓN ECONÓMICA · no es autorización de compra.</b> ' +
      esc((er.reasons || []).join(" · ") || "Sin motivos informados") + '<div class="sb-warn">Datos faltantes: ' + esc((er.missingData || []).join(", ") || "—") +
      " · logística " + esc((LOGISTICS[(er.costBasis || {}).logistics] || "supuesta")) + " · impuesto " + esc((er.costBasis || {}).sourceTax || "—") +
      " · comisiones " + esc((er.costBasis || {}).amazonFees || "—") + "</div></div>" : "";
    var fees = s.fees ? usd(s.fees.total) + " (referral " + usd(s.fees.referral) + " · FBA " + usd(s.fees.fba) + (s.fees.other ? " · otras " + usd(s.fees.other) : "") + ")" : "—";
    var src = s.sourceUrl ? '<a href="' + esc(s.sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(s.source || "tienda") + "</a>" : esc(s.source || "—");
    card.innerHTML = '<div class="cardtitle">Dato Scanner · evidencia importada ' + (expired ? tag("CADUCADO", "bad") : tag("vigente hasta " + fdate(s.expiresAt), "good")) + "</div>" +
      '<div class="flags">' + tag("Publicar: " + ((st.eligibility || {}).status || "—") + ((st.eligibility || {}).source === "SCANNER" ? " (Scanner)" : " (manual)"), "") +
      tag(f.label || "FBA —", f.status === "FBA_ELIGIBLE" && !expired ? "good" : (f.status === "FBA_RESTRICTED" ? "bad" : "warn")) +
      tag("Match " + (s.matchStatus || "—") + " · " + (s.matchConfidence || "—") + " (Scanner, no reemplaza tu verificación)", "") + tag("Amazon Retail: NO VERIFICADO en el archivo", "warn") + "</div>" +
      econBox +
      (gate ? '<div class="note" style="margin-top:8px;border-left:4px solid var(--' + (gate.decision === "DESCARTAR" ? "bad" : "warn") + ')"><b>' + esc(gate.decision) + "</b> · " + esc(gate.reason) + "</div>" : "") +
      '<div class="kv"><div>Tienda<b>' + src + "</b>" + usd(s.sourcePrice) + (s.sourceRegularPrice ? " · regular " + usd(s.sourceRegularPrice) : "") + "</div>" +
      "<div>Costo de adquisición<b>" + usd(s.acquisitionCost) + "</b>envío " + usd(s.shippingCost) + " · impuesto " + usd(s.sourceTax) + (s.sourceTaxStatus === "ASSUMED" ? " (supuesto)" : "") + "</div>" +
      "<div>Venta conservadora<b>" + usd(s.salePrice) + "</b>Amazon " + usd(s.amazonPrice) + " · BSR " + esc(s.bsrCurrent || "—") + "</div>" +
      "<div>Comisiones (estimado SP-API)<b>" + usd(s.fees && s.fees.total) + "</b>" + esc(fees) + "</div>" +
      "<div>Ganancia preliminar/u<b>" + usd(s.netProfitEstimate) + "</b>logística " + (LOGISTICS[s.logisticsStatus] || "supuesta") + " " + usd(s.logisticsAssumed) + " · excluye " + esc((s.netProfitExcludes || []).join(", ") || "—") + "</div>" +
      "<div>Fechas<b>" + esc(fdate(s.lastChecked)) + "</b>exportado " + esc(fdate(s.exportedAt)) + " · comisiones " + esc(fdate(s.fees && s.fees.fetchedAt)) + "</div></div>" +
      '<div class="flags">' + flags + "</div>" +
      '<div class="hint" style="margin-top:8px">Estos datos vienen del Scanner y no reemplazan tus costos reales: confírmalos en «Costo real y Prep Center». Revalida precio, permisos y FBA en Seller Central el día de la compra.</div>';
    sect.insertBefore(card, sect.firstChild);
  }

  function readFile(file, win, host) {
    var r = new win.FileReader();
    if (file.size > MAX_BYTES) { renderPreview(host, fail("El archivo es demasiado grande (máx. 2 MB)."), win); return; }
    r.onload = function () { renderPreview(host, parse(String(r.result || "")), win); };
    r.onerror = function () { renderPreview(host, fail("No se pudo leer el archivo."), win); };
    r.readAsText(file);
  }

  if (typeof window !== "undefined" && window.document) {
    var start = function () { try { renderEvidence(window); } catch (e) { } };
    if (window.document.readyState === "loading") window.document.addEventListener("DOMContentLoaded", start); else start();
  }

  return { SCHEMA_V23: SCHEMA_V23, LEGACY_SCHEMA: LEGACY_SCHEMA, parse: parse, plan: plan, apply: apply, fbaGate: fbaGate,
    newCandidate: newCandidate, readFile: readFile, renderPreview: renderPreview, renderEvidence: renderEvidence, openInCalculator: openInCalculator,
    FBA_LABEL: FBA_LABEL };
});
