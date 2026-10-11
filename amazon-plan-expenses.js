(function (w) {
  'use strict';
  const KEY = 'amazon_compuesto_plan_expenses_v1', d = w.document;
  const $ = id => d.getElementById(id);
  const cents = value => {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value), rounded = Math.round(n * 100);
    return Number.isFinite(n) && n > 0 && Number.isSafeInteger(rounded) && rounded > 0 && Math.abs(n * 100 - rounded) < .000001 ? rounded : null;
  };
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const x = new Date(value + 'T00:00:00Z');
    return Number.isFinite(x.getTime()) && x.toISOString().slice(0, 10) === value ? x : null;
  }
  function today() {
    const x = new Date();
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  const money = n => n === null || n === undefined ? '—' : 'US$' + Number(n).toLocaleString('es-CL', {minimumFractionDigits:2, maximumFractionDigits:2});
  const cycleId = due => 'AMAZON-PRO-' + due.slice(0, 7);
  function read() {
    let s;
    try { s = JSON.parse(w.localStorage.getItem(KEY) || '{"config":null,"payments":[]}'); }
    catch (_) { throw new Error('No se puede leer el registro del plan. El capital no se puede calcular con seguridad.'); }
    if (!s || !Array.isArray(s.payments)) throw new Error('El registro del plan está incompleto.');
    if (s.config !== null && (!s.config || typeof s.config.active !== 'boolean' || !date(s.config.startDate) || cents(s.config.amount) === null)) throw new Error('La configuración del plan es inválida.');
    const ids = new Set();
    for (const p of s.payments) {
      if (!p || !date(p.dueDate) || !date(p.paidDate) || cents(p.amount) === null || p.id !== cycleId(p.dueDate) || ids.has(p.id) || typeof p.createdAt !== 'string' || (p.voidedAt !== null && typeof p.voidedAt !== 'string')) throw new Error('Hay un pago inválido o duplicado en el registro del plan.');
      ids.add(p.id);
    }
    return s;
  }
  function write(s) {
    try { w.localStorage.setItem(KEY, JSON.stringify(s)); }
    catch (_) { throw new Error('No se pudo guardar el registro. El pago no se ha registrado.'); }
    w.dispatchEvent(new w.Event('motor-scoring-expenses-changed'));
    render();
  }
  function monthDate(start, offset) {
    const x = date(start), first = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + offset, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(x.getUTCDate(), last));
    return first.toISOString().slice(0, 10);
  }
  function schedule(s, asOf) {
    if (!date(asOf)) throw new Error('Fecha de consulta inválida.');
    if (!s.config || !s.config.active) return {pending:[], next:null};
    const paid = new Set(s.payments.filter(p => !p.voidedAt).map(p => p.id)), pending = [];
    const start = date(s.config.startDate), end = date(asOf);
    const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
    if (months > 1200) throw new Error('Revisa la fecha inicial del plan: supera cien años.');
    for (let n = 0; n <= months; n++) {
      const due = monthDate(s.config.startDate, n);
      if (due <= asOf && !paid.has(cycleId(due))) pending.push(due);
    }
    let offset = Math.max(0, months), next = monthDate(s.config.startDate, offset);
    if (next <= asOf) next = monthDate(s.config.startDate, ++offset);
    return {pending, next};
  }
  function totals() {
    try {
      const s = read(), active = s.payments.filter(p => !p.voidedAt);
      const total = active.reduce((sum, p) => sum + cents(p.amount), 0);
      if (!Number.isSafeInteger(total)) throw new Error('El total de gastos supera el límite admitido.');
      return {complete:true, paid:total / 100, count:active.length};
    } catch (e) { return {complete:false, reason:e.message}; }
  }
  function configure(amount, startDate, active) {
    const s = read();
    if (cents(amount) === null || !date(startDate) || typeof active !== 'boolean') throw new Error('Indica un importe positivo con hasta dos decimales y la fecha del primer cobro a controlar.');
    s.config = {amount:cents(amount) / 100, startDate, active}; write(s);
  }
  function register(dueDate, amount, paidDate, confirmed) {
    const s = read();
    if (!date(dueDate)) throw new Error('Fecha de vencimiento inválida.');
    if (confirmed !== true) throw new Error('Confirma el cargo real y que no está descontado en el beneficio de los lotes ni en el presupuesto base.');
    if (cents(amount) === null || !date(paidDate) || paidDate > today()) throw new Error('Indica el importe real positivo y una fecha de pago que no sea futura.');
    const id = cycleId(dueDate), previous = s.payments.find(p => p.id === id);
    if (previous && !previous.voidedAt) throw new Error('Esta mensualidad ya está registrada. No se descontó otra vez.');
    if (!schedule(s, today()).pending.includes(dueDate)) throw new Error('Esta mensualidad no está pendiente. Revisa las fechas del plan.');
    const payment = {id, dueDate, paidDate, amount:cents(amount) / 100, createdAt:new Date().toISOString(), voidedAt:null};
    if (previous) {
      const archived = {...previous}; delete archived.previousVersions;
      payment.previousVersions = (previous.previousVersions || []).concat([archived]); s.payments[s.payments.indexOf(previous)] = payment;
    }
    else s.payments.push(payment);
    write(s); return payment;
  }
  function voidPayment(id) {
    const s = read(), p = s.payments.find(x => x.id === id && !x.voidedAt);
    if (!p) throw new Error('Ese pago no está activo.');
    p.voidedAt = new Date().toISOString(); write(s);
  }
  function message(text, bad) { const e = $('amazon-plan-message'); if(e) { e.textContent = text; e.style.color = bad ? 'var(--bad)' : 'var(--good)'; } }
  function act(fn, success) { try { fn(); message(success, false); } catch (e) { message(e.message, true); } }
  function openPayment(due) {
    const s = read(), host = $('amazon-plan-payment'); host.replaceChildren();
    const title = d.createElement('p'); title.textContent = 'Registrar mensualidad con vencimiento ' + due; host.appendChild(title);
    host.insertAdjacentHTML('beforeend', '<label class="f"><div class="flabel">Importe real cobrado · US$</div><div class="fbox"><input id="amazon-plan-paid-amount" type="number" min="0.01" step="0.01"></div></label><label class="f"><div class="flabel">Fecha real del cargo</div><div class="fbox"><input id="amazon-plan-paid-date" type="date"></div></label><label class="f"><input id="amazon-plan-confirmed" type="checkbox"> Confirmé el cargo en Amazon. Este gasto no está descontado en el beneficio de mis lotes ni en mi presupuesto base.</label><button type="button" id="amazon-plan-confirm-payment">Registrar pago</button> <button type="button" id="amazon-plan-cancel-payment">Cancelar</button>');
    $('amazon-plan-paid-amount').value = s.config.amount;
    $('amazon-plan-paid-date').max = today();
    // Leave the actual charge date blank: the due date is not evidence of payment.
    $('amazon-plan-confirm-payment').onclick = () => act(() => {
      register(due, $('amazon-plan-paid-amount').value, $('amazon-plan-paid-date').value, $('amazon-plan-confirmed').checked);
      host.replaceChildren();
    }, 'Pago registrado. El gasto se descontó una sola vez del capital.');
    $('amazon-plan-cancel-payment').onclick = () => { host.replaceChildren(); message('', false); };
  }
  function render() {
    if (!$('amazon-plan-status')) return;
    let s, scheduled, t;
    try { s = read(); scheduled = schedule(s, today()); t = totals(); }
    catch (e) { $('amazon-plan-status').textContent = e.message; $('amazon-plan-pending').replaceChildren(); summary(); return; }
    const pro = $('p_plan') && $('p_plan').value === 'pro';
    $('amazon-plan-status').textContent = !s.config ? 'Sin calendario. Configura el primer cobro que quieras controlar; no se generan gastos históricos automáticamente.' :
      (s.config.active ? scheduled.pending.length + ' mensualidad(es) pendiente(s) de confirmar. Próximo vencimiento: ' + scheduled.next + '.' : 'Calendario pausado. Los pagos registrados siguen descontándose.') + (!pro ? ' El selector no está en Profesional: pausa el calendario si ya cambiaste de plan.' : '');
    const pending = $('amazon-plan-pending'); pending.replaceChildren();
    scheduled.pending.forEach(due => {
      const row = d.createElement('p'); row.textContent = due + ' · ' + money(s.config.amount) + ' estimados · ';
      const button = d.createElement('button'); button.type = 'button'; button.textContent = 'Confirmar cargo'; button.onclick = () => act(() => openPayment(due), 'Comprueba el importe y la fecha real del cargo.'); row.appendChild(button); pending.appendChild(row);
    });
    $('amazon-plan-total').textContent = 'Plan profesional registrado: ' + money(t.complete ? t.paid : null) + ' · ' + (t.count || 0) + ' pago(s). Los pendientes no se descuentan del capital.';
    const history = $('amazon-plan-history'); history.replaceChildren();
    s.payments.slice().reverse().forEach(p => {
      const row = d.createElement('p'); row.textContent = 'Mensualidad ' + p.dueDate + ' · cargo ' + p.paidDate + ' · ' + money(p.amount) + (p.voidedAt ? ' · ANULADO' : ' · Registrado');
      if (!p.voidedAt) { const undo = d.createElement('button'); undo.type = 'button'; undo.textContent = 'Anular registro'; undo.onclick = () => { if (w.confirm('¿Anular este registro? El importe volverá al capital calculado. Esto no devuelve el cargo de Amazon.')) act(() => voidPayment(p.id), 'Registro anulado. Se conservó la trazabilidad.'); }; row.appendChild(undo); }
      history.appendChild(row);
    });
    summary();
  }
  function summary() {
    const root = $('amazon-business-summary'); if (!root) return;
    const expense = totals(), b = w.AMAZON_CAPITAL_BALANCE && w.AMAZON_CAPITAL_BALANCE();
    const t = w.JEV_FINANCIAL_SYNC && w.JEV_FINANCIAL_SYNC.globalTotals();
    const ops = t && !t.invalid && t.realizedComplete ? t.realized : null;
    const paid = expense.complete ? expense.paid : null, net = ops !== null && paid !== null ? Math.round((ops - paid) * 100) / 100 : null;
    const sales = t && t.realizedSalesComplete && !t.invalid ? t.realizedSales : null;
    const margin = sales > 0 && net !== null ? (net / sales * 100).toFixed(1) + '%' : '—';
    root.innerHTML = '<div class="cardtitle">Resultado del negocio · después del plan profesional</div><div class="stats">' +
      metric('business-operation-profit', 'Resultado de operaciones', ops, 'Lotes cerrados · antes del plan') +
      metric('business-plan-expenses', 'Plan profesional pagado', paid, 'Gasto único por mensualidad confirmada') +
      metric('business-net-profit', 'Resultado después del plan', net, 'Resultado de operaciones − plan registrado · margen: ' + margin) +
      metric('business-total-capital', 'Capital total actualizado', b && b.complete ? b.totalCapital : null, 'Presupuesto + resultados liquidados − plan pagado') +
      metric('business-capital-available', 'Disponible para nuevas compras', b && b.complete ? b.available : null, 'Capital actualizado − compras abiertas − reserva') + '</div>' +
      '<p class="hint">Los cargos se registran aquí una sola vez, aunque Amazon los retenga de una liquidación. Introduce el beneficio de cada lote antes del plan y conserva el presupuesto base. Los pagos pendientes requieren comprobar el cargo. Los datos se guardan en este navegador.</p>';
    let cfg; try { cfg = read().config; } catch (_) {}
    const f = w.MOTOR_SCORING_ENGINE && w.MOTOR_SCORING_ENGINE.financial;
    $('amazon-plan-coverage').textContent = cfg && cfg.active && f && f.complete && f.net > 0 ?
      'Cobertura orientativa: ' + Math.ceil(cfg.amount / f.net) + ' ventas a ' + money(f.net) + ' de beneficio por unidad antes del plan para cubrir una mensualidad de ' + money(cfg.amount) + '. No es un pronóstico de ventas.' :
      'El beneficio por producto se calcula antes del plan. El resultado del negocio descuenta los cargos confirmados.';
  }
  function metric(id, label, value, note) { return '<div id="' + id + '" class="stat"><div class="l">' + label + '</div><div class="v' + (value < 0 ? ' bad' : '') + '">' + money(value) + '</div><div class="s">' + note + '</div></div>'; }
  function init() {
    const host = $('amazon-plan-panel'); if (!host) return;
    host.innerHTML = '<summary>Plan profesional · registro mensual</summary><div class="jev-details-body"><p class="hint">Control común para todos los productos. Configura el importe de tu cuenta en US$ y la fecha del primer cobro a controlar.</p><label class="f"><div class="flabel">Importe mensual previsto · US$</div><div class="fbox"><input id="amazon-plan-amount" type="number" min="0.01" step="0.01" value="39.99"></div></label><label class="f"><div class="flabel">Primer vencimiento a controlar</div><div class="fbox"><input id="amazon-plan-start" type="date"></div></label><label class="f"><input id="amazon-plan-active" type="checkbox" checked> Calendario mensual activo</label><button type="button" id="amazon-plan-save">Guardar calendario</button><p id="amazon-plan-message" role="status" aria-live="polite"></p><p id="amazon-plan-status" class="hint"></p><div id="amazon-plan-pending"></div><div id="amazon-plan-payment"></div><p id="amazon-plan-total" class="hint"></p><p id="amazon-plan-coverage" class="hint"></p><details><summary>Historial de mensualidades</summary><div id="amazon-plan-history"></div></details></div>';
    const style = d.createElement('style'); style.textContent = '#amazon-plan-panel button{font:inherit;padding:8px 10px;min-height:44px;cursor:pointer;border:1px solid var(--lineStrong);background:#fff;color:var(--deep)}#amazon-plan-panel .f input[type=checkbox]{margin-right:5px}#amazon-plan-payment:not(:empty){padding:10px;border:1px solid var(--lineStrong);margin:12px 0}#amazon-plan-history button{margin-left:8px}#amazon-business-summary{padding-bottom:12px}'; d.head.appendChild(style);
    try { const s = read(); if(s.config) { $('amazon-plan-amount').value = s.config.amount; $('amazon-plan-start').value = s.config.startDate; $('amazon-plan-active').checked = s.config.active; } } catch (_) {}
    $('amazon-plan-save').onclick = () => act(() => { configure($('amazon-plan-amount').value, $('amazon-plan-start').value, $('amazon-plan-active').checked); $('amazon-plan-payment').replaceChildren(); }, 'Calendario guardado. Ningún pago se descuenta sin confirmar el cargo.');
    for (const e of ['motor-scoring-operations-changed', 'motor-scoring-expenses-changed', 'focus']) w.addEventListener(e, render);
    w.addEventListener('storage', e => {
      if (e.key === KEY || e.key === null) w.dispatchEvent(new w.Event('motor-scoring-expenses-changed'));
      else render();
    });
    d.addEventListener('visibilitychange', () => { if (!d.hidden) render(); });
    d.addEventListener('input', () => w.setTimeout(summary, 0));
    d.addEventListener('change', () => w.setTimeout(render, 0));
    w.setTimeout(render, 400); w.setTimeout(render, 1200);
    let renderedDay = today();
    w.setInterval(() => { const day = today(); if (day !== renderedDay) { renderedDay = day; render(); } }, 60000);
    render();
  }
  w.AMAZON_PLAN_EXPENSES = {totals, configure, register, voidPayment, read, schedule, monthDate, render};
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})(window);
