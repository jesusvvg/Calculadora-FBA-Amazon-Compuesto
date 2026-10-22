(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./jev-observer-contract.js'));
  else root.JevObserverAdapter = factory(root.JevObserverContract);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (contract) {
  'use strict';
  const RECORD_KEY = 'amazon_compuesto_jev_observations_v01';
  const copy = value => JSON.parse(JSON.stringify(value));
  function captureBrowser(w, options) {
    options = options || {};
    const text = id => { const element = w.document.getElementById(id); return element ? element.value : ''; };
    const number = id => {
      const value = text(id);
      if (value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('Falta un dato numérico válido: ' + id);
      return Number(value);
    };
    const state = JSON.parse(w.localStorage.getItem('jev_v1') || '{}');
    const e = w.MOTOR_SCORING_ENGINE;
    if (!e || !e.final || e.final.decision !== 'COMPRAR PILOTO') {
      const error = new Error('El Motor Scoring todavía no permite un piloto.'); error.code = 'BLOCKED'; throw error;
    }
    if (text('jev_asin') !== state.product.asin || !state.product.asin) throw new Error('La identidad del análisis no está confirmada.');
    if (w.document.getElementById('op-edit-units')) throw new Error('Finaliza la edición de la compra antes de consultar otro análisis.');
    const chosen = w.document.getElementById('op-buy-units');
    const units = chosen ? number('op-buy-units') : e.final.pilotUnits;
    if (!Number.isInteger(units) || units < 1 || units > 5) throw new Error('El observador acepta pilotos de una a cinco unidades.');
    const c = state.costs && state.costs.checkout, p = state.costs && state.costs.prep, r = state.returns;
    if (!c || !p || !r) throw new Error('Faltan costos o devoluciones.');
    for (const [name, value] of Object.entries({displayedUnit:c.displayedUnit, discountUnit:c.discountUnit, taxUnit:c.taxUnit,
      supplierToPrepLot:c.supplierToPrepLot, prepUnit:p.prepUnit, otherPrepLot:p.otherPrepLot, prepToAmazonLot:p.prepToAmazonLot,
      returnRate:r.returnRateExpected, resellable:r.resellablePct, removal:r.removalCostUnit, returnPrep:r.prepReturnCostUnit, resend:r.resendCostUnit})) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Falta costo explícito: ' + name);
    }
    if (r.returnRateExpected > 100 || r.resellablePct > 100) throw new Error('Porcentaje de devoluciones inválido.');
    const inputs = {};
    for (const id of ['p_precio','p_ref','p_fba','p_almac','p_ppc','c_venta','p_presu','p_unid','p_dias']) inputs[id] = number(id);
    if (inputs.p_ref >= 100) throw new Error('Referral fee inválido.');
    const currency = text('p_moneda'), rate = currency === 'USD' ? 1 : number('p_tc');
    if (!['USD','CLP','CAD','MXN'].includes(currency) || !(rate > 0)) throw new Error('Moneda o conversión pendiente.');
    const entryCapital = units * (Math.max(0,c.displayedUnit-c.discountUnit+c.taxUnit)/rate+p.prepUnit) + c.supplierToPrepLot/rate+p.otherPrepLot+p.prepToAmazonLot;
    // A manual investment override is explicitly captured; never borrow a saved lot preview.
    const investment = chosen ? number('op-buy-investment') : entryCapital;
    const fin = e.evaluatePurchaseFinancial(units, investment), balance = w.AMAZON_CAPITAL_BALANCE(null, investment);
    if (!fin || !fin.complete || !balance || !balance.complete) throw new Error('Economía o balance incompletos.');
    const v = state.verification || {}, m = state.market || {}, inv = state.rotation || {}, exit = v.exitPlan || {};
    const now = options.now === undefined ? Date.now() : options.now;
    const checked = m.checkedAt ? Date.parse(m.checkedAt) : NaN;
    const age = Number.isFinite(checked) && checked <= now ? Math.floor((now-checked)/86400000) : null;
    const nullable = value => value === undefined ? null : value;
    const days = w.MOTOR_SCORING_PHASE5 && w.MOTOR_SCORING_PHASE5.rotation && w.MOTOR_SCORING_PHASE5.rotation.dtc;
    const observed = {
      schemaVersion: contract.VERSION, dataOrigin: options.dataOrigin || 'MANUAL',
      product: {marketplace:state.product.marketplace, condition:state.product.condition, stage:state.product.stage || 'CANDIDATO'},
      gates: {eligibility:state.eligibility && state.eligibility.status, exactMatch:v.productMatch && v.productMatch.status,
        brandRestriction:v.brandPolicy && v.brandPolicy.status, sourceAuthenticity:v.supply && v.supply.authenticity},
      lot: {selectedUnits:units, currency:'USD', entryCapitalUsd:investment, priceUsd:inputs.p_precio,
        netProfitUnitUsd:fin.net, netMarginRatio:fin.margin, roiRatio:fin.roi, breakEvenUsd:fin.breakEven,
        pessimisticProfitUnitUsd:fin.pessNet, estimatedDaysToCash:days, dtcSource:'MANUAL_ESTIMATE',
        calculatedFinancialSignals: {baseProfitable:fin.net>0, marginMeetsCurrentPolicy:fin.margin>=.08, roiMeetsCurrentPolicy:fin.roi>=.10, pessimisticProfitable:fin.pessNet>0}},
      capital: {availableBeforeUsd:balance.available, availableAfterUsd:balance.afterPurchase, entryExposureRatio:investment/balance.available},
      market: {bsrCurrent:nullable(m.bsrCurrent), bsrTrend:m.bsrTrend || 'NO VERIFICADO', salesEstimatedMonthlyListing:nullable(m.salesEstimatedMonthly),
        sellersFbaCurrent:nullable(m.sellersFbaCurrent), sellersFba30:nullable(m.sellersFba30), priceAvg30Usd:nullable(m.priceAvg30),
        priceAvg90Usd:nullable(m.priceAvg90), priceAvg180Usd:nullable(m.priceAvg180), priceMinRecentUsd:nullable(m.priceMinRecent),
        priceStability:m.priceStability || 'NO VERIFICADA', buyBox:m.buyBox || 'NO VERIFICADA', amazonSeller:m.amazonSeller || 'NO VERIFICADO',
        seasonality:m.seasonality || 'NO VERIFICADA', observedPriceWar:(state.risk || {}).priceWar || 'NO VERIFICADA', observationAgeDays:age},
      inventory: {expectedSellThrough90:inv.sellThrough90 || 'NO VERIFICADO', supplierReturnAllowed:exit.returnAllowed || 'NO VERIFICADO',
        supplierReturnWindowDays:nullable(exit.returnWindowDays), supplierRestockingFeeRatio:exit.restockingFeePct == null ? null : exit.restockingFeePct/100,
        finalSale:exit.finalSale || 'NO VERIFICADO', expectedReturnRateRatio:r.returnRateExpected/100}
    };
    const clean = contract.normalizeState(observed);
    const identity = {asin:state.product.asin, marketplace:state.product.marketplace};
    const baseline = {final:copy(e.final), confidence:copy(e.confidence), financialScore:fin.score,
      recommendationAppliesToChosenLot:units === e.final.pilotUnits && Math.abs(investment-e.final.pilotCapital) < 1e-6};
    const sourceMetadata = {eligibility:copy(state.eligibility), matchCheckedAt:v.productMatch && v.productMatch.checkedAt || null,
      marketSource:m.source || 'MANUAL', marketCheckedAt:m.checkedAt || null};
    // Signature includes raw numerical inputs and provenance, even if rounded totals coincide.
    const signature = JSON.stringify({identity, clean, inputs, currency, rate, costs:state.costs, returns:r,
      verification:v, market:m, rotation:inv, risk:state.risk, capital:balance, baseline, sourceMetadata});
    return {state:clean, identity, baseline, sourceMetadata, signature};
  }
  function createObserver(options) {
    let pending = false, last = null, lastSignature = null, sequence = 0;
    const clock = options.clock || (() => new Date().toISOString());
    async function evaluate() {
      if (pending) return {status:'PENDING'};
      let snapshot;
      try { snapshot = options.capture(); } catch (error) { return {status:error.code === 'BLOCKED' ? 'BLOCKED' : 'INSUFFICIENT_DATA', message:error.message}; }
      let plan;
      try { plan = contract.buildRequest(snapshot.state); } catch (error) { return {status:error.code === 'BLOCKED' ? 'BLOCKED' : 'INSUFFICIENT_DATA', message:error.message}; }
      const record = {analysisId:'JEV-'+clock()+'-'+(++sequence), createdAt:clock(), mode:'OBSERVATION', contractVersion:contract.VERSION,
        identity:copy(snapshot.identity), state:copy(snapshot.state), baseline:copy(snapshot.baseline), skipped:plan.skipped, status:'PENDING'};
      if (snapshot.sourceMetadata) record.sourceMetadata=copy(snapshot.sourceMetadata);
      if (!Object.keys(plan.request.questions).length) { record.status='INSUFFICIENT_DATA'; }
      else {
        pending = true;
        try {
          const reply = await options.transport({analysisId:record.analysisId, state:copy(snapshot.state)});
          if (!reply || reply.mode !== 'OBSERVATION' || reply.contractVersion !== contract.VERSION ||
              reply.analysisId !== record.analysisId || typeof reply.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(reply.fingerprint)) {
            const error = new Error('Respuesta del servidor inválida.'); error.code='INVALID_RESPONSE'; throw error;
          }
          record.result = contract.validateResponse(reply.result, plan.request.questions);
          record.fingerprint = reply.fingerprint;
          record.status = 'READY';
        } catch (error) {
          record.status = ['INVALID_RESPONSE','AUTH_REQUIRED','DISABLED'].includes(error.code) ? error.code : 'UNAVAILABLE';
        } finally { pending = false; }
      }
      try { if (options.capture().signature !== snapshot.signature) record.status='STALE'; }
      catch { record.status='STALE'; }
      record.completedAt = clock();
      if (options.writeRecord) {
        try { options.writeRecord(copy(record)); record.saved=true; }
        catch { record.saved=false; record.saveError='No se pudo guardar la observación.'; }
      }
      last = copy(record);
      lastSignature = snapshot.signature;
      return copy(record);
    }
    function latest() {
      if (!last) return null;
      const result = copy(last);
      try { if (options.capture().signature !== lastSignature) result.status='STALE'; }
      catch { result.status='STALE'; }
      return result;
    }
    return Object.freeze({evaluate, latest});
  }
  function browserObserver(w, options) {
    options = options || {};
    const endpoint = new w.URL(options.endpoint || '/api/jev/review', w.location.href);
    if (endpoint.origin !== w.location.origin) throw new Error('Configura JEV bajo el mismo origen de la calculadora.');
    // This private access token is kept in memory only. It is not the TypeSafe key.
    const accessToken = options.accessToken;
    return createObserver({capture:() => captureBrowser(w, options), transport:async payload => {
      if (!accessToken) { const error=new Error('Acceso al servidor pendiente.'); error.code='AUTH_REQUIRED'; throw error; }
      const controller = new w.AbortController(), timer = w.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await w.fetch(endpoint.href, {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+accessToken},
          body:JSON.stringify(payload), signal:controller.signal, cache:'no-store', credentials:'omit', redirect:'error'});
        if (!response.ok) { const error=new Error('Consulta no disponible.'); error.code=response.status===401?'AUTH_REQUIRED':response.status===503?'DISABLED':'UNAVAILABLE'; throw error; }
        return await response.json();
      } finally { w.clearTimeout(timer); }
    }, writeRecord:record => {
      const records=JSON.parse(w.localStorage.getItem(RECORD_KEY)||'[]');
      if (!Array.isArray(records)) throw new Error('Historial de observaciones ilegible.');
      records.push(record); w.localStorage.setItem(RECORD_KEY,JSON.stringify(records.slice(-100)));
    }});
  }
  return Object.freeze({RECORD_KEY, captureBrowser, createObserver, browserObserver});
});
