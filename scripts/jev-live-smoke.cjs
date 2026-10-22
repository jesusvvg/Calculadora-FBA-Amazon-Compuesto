'use strict';
// Synthetic connection test. Default: validate locally. --send: one paid call,
// through our authenticated loopback server. No retries or secret output.
const crypto = require('node:crypto');
const contract = require('../jev-observer-contract.js');
const state = {
  schemaVersion: contract.VERSION, dataOrigin: 'SIMULATED',
  product: {marketplace: 'US', condition: 'NEW', stage: 'CANDIDATO'},
  gates: {eligibility: 'AUTORIZADO', exactMatch: 'MATCH CONFIRMADO',
    brandRestriction: 'AUTORIZACIÓN EXPLÍCITA', sourceAuthenticity: 'VERIFICADA'},
  lot: {selectedUnits: 1, currency: 'USD', entryCapitalUsd: 19,
    priceUsd: 39.99, netProfitUnitUsd: 9.9915,
    netMarginRatio: 9.9915 / 39.99, roiRatio: 9.9915 / 19,
    breakEvenUsd: 24 / .85, pessimisticProfitUnitUsd: 6.59235,
    estimatedDaysToCash: 61, dtcSource: 'MANUAL_ESTIMATE',
    calculatedFinancialSignals: {baseProfitable: true, marginMeetsCurrentPolicy: true,
      roiMeetsCurrentPolicy: true, pessimisticProfitable: true}},
  capital: {availableBeforeUsd: 200, availableAfterUsd: 181, entryExposureRatio: 19 / 200},
  market: {bsrCurrent: 2000, bsrTrend: 'MEJORA', salesEstimatedMonthlyListing: 100,
    sellersFbaCurrent: 3, sellersFba30: 3, priceAvg30Usd: 39.99,
    priceAvg90Usd: 40, priceAvg180Usd: 40, priceMinRecentUsd: 37.99,
    priceStability: 'ALTA', buyBox: 'ESTABLE', amazonSeller: 'NO',
    seasonality: 'BAJA', observedPriceWar: 'BAJA', observationAgeDays: 0},
  inventory: {expectedSellThrough90: 'ALTO ≥80%', supplierReturnAllowed: 'SÍ',
    supplierReturnWindowDays: 30, supplierRestockingFeeRatio: 0,
    finalSale: 'NO', expectedReturnRateRatio: 0}
};
function fail(code) {const error = new Error(code); error.code = code; throw error;}
async function main({send = false, env = process.env, output = console.log} = {}) {
  const plan = contract.buildRequest(state);
  if (Object.keys(plan.request.questions).length !== 5) fail('INVALID_SYNTHETIC_STATE');
  if (!send) {
    output(JSON.stringify({status: 'LOCAL_VALIDATION_OK', dataOrigin: state.dataOrigin,
      questions: Object.keys(plan.request.questions), upstreamCalls: 0}, null, 2));
    return;
  }
  if (env.JEV_ENABLED !== '1') fail('JEV_DISABLED_IN_ENV');
  if (!/^[a-f0-9]{64}$/.test(env.JEV_ACCESS_TOKEN || '')) fail('INVALID_LOCAL_TOKEN');
  const port = Number(env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail('INVALID_PORT');
  const analysisId = 'SMOKE-' + crypto.randomUUID();
  const response = await fetch('http://127.0.0.1:' + port + '/api/jev/review', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + env.JEV_ACCESS_TOKEN},
    body: JSON.stringify({analysisId, state})
  });
  let body;
  try {body = await response.json();} catch {fail('INVALID_LOCAL_RESPONSE');}
  if (!response.ok) {
    const allowed = new Set(['AUTH_REQUIRED', 'DISABLED', 'BLOCKED', 'INVALID_INPUT',
      'INVALID_HOST', 'INVALID_ORIGIN', 'LOCAL_LIMIT', 'PROVIDER_AUTH_ERROR',
      'PROVIDER_LIMIT', 'PROVIDER_OVERLOADED', 'UNAVAILABLE', 'INVALID_RESPONSE', 'UPSTREAM_TIMEOUT']);
    fail(allowed.has(body?.status) ? body.status : 'HTTP_' + response.status);
  }
  if (body.status !== 'READY' || body.mode !== 'OBSERVATION' ||
      body.contractVersion !== contract.VERSION || body.analysisId !== analysisId) fail('INVALID_LOCAL_RESPONSE');
  const result = contract.validateResponse(body.result, plan.request.questions);
  output(JSON.stringify({status: 'READY', mode: 'OBSERVATION', dataOrigin: 'SIMULATED',
    model: result.model, usage: result.usage, answers: result.answers}, null, 2));
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--send')) {
    console.error('Uso: node scripts/jev-live-smoke.cjs [--send]');
    process.exitCode = 1;
  } else main({send: args[0] === '--send'}).catch(error => {
    console.error('Prueba detenida: ' + (error.code || 'LOCAL_CONNECTION_ERROR'));
    process.exitCode = 1;
  });
}
module.exports = {state, main};
