// Isolated full-page tests; no provider calls or user data.
const {JSDOM, VirtualConsole} = require('jsdom');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..'), KEY = 'amazon_compuesto_plan_expenses_v1';
const OPS = 'amazon_compuesto_operations_v1', wait = ms => new Promise(r => setTimeout(r, ms));
const NOW = '2026-10-11T15:00:00Z';
const base = {
  fba_v2:JSON.stringify({p_presu:'300',p_plan:'pro',p_unid:'1',p_precio:'39.99',p_ref:'15',p_fba:'5',p_almac:'0',p_ppc:'0'}),
  jev_v1:JSON.stringify({product:{asin:'SYNTHETIC'},capital:{reserveTarget:100},costs:{checkout:{displayedUnit:10,taxUnit:0,supplierToPrepLot:6},prep:{prepUnit:1,otherPrepLot:1,prepToAmazonLot:1}},returns:{returnRateExpected:0,resellablePct:100,removalCostUnit:0,prepReturnCostUnit:0,resendCostUnit:0}}),
  [OPS]:JSON.stringify([{id:'CLOSED',kind:'COMPRA',status:'CERRADA',product:{asin:'OTHER-ASIN'},purchase:{units:1,investment:19},actual:{capitalSettled:true,unitsSold:1,price:39.99,sales:39.99,profit:9.91}}])
};
const storage = w => Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
function input(w,id,value){const e=w.document.getElementById(id);assert(e,id);e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));return e;}
(async () => {
  const windows=[], server=http.createServer((req,res)=>{
    try { const file=path.join(ROOT,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);
      res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(file));
    } catch (_) { res.statusCode=404;res.end(); }
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  async function mount(saved=base){
    const errors=[], alerts=[], vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e)));
    const dom=await JSDOM.fromURL('http://127.0.0.1:'+server.address().port+'/',{resources:'usable',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
      const RealDate=w.Date;w.Date=class extends RealDate{constructor(...a){super(...(a.length?a:[NOW]));}static now(){return RealDate.parse(NOW);}};
      for(const [k,v]of Object.entries(saved))w.localStorage.setItem(k,v);w.alert=x=>alerts.push(x);w.confirm=()=>true;
    }});
    const w=dom.window;windows.push(w);await wait(1300);assert.deepEqual(errors,[]);assert.equal(w.MOTOR_SCORING_SELF_TEST.failed,0);return {w,alerts};
  }
  try {
    let {w,alerts}=await mount(), api=w.AMAZON_PLAN_EXPENSES;
    const originalOps=w.localStorage.getItem(OPS), originalFin=JSON.stringify(w.MOTOR_SCORING_ENGINE.financial);
    assert.equal(w.AMAZON_CAPITAL_BALANCE().totalCapital,309.91);
    assert.equal(w.localStorage.getItem(KEY),null,'opening the app never invents a charge');
    assert.equal(w.document.getElementById('amazon-plan-panel').previousElementSibling.querySelector('select').id,'p_plan');
    assert.equal(api.monthDate('2024-01-31',1),'2024-02-29');assert.equal(api.monthDate('2024-01-31',2),'2024-03-31');
    assert.equal(api.monthDate('2025-01-31',1),'2025-02-28');
    assert.throws(()=>api.configure('', '2026-09-01',true),/importe/);
    assert.throws(()=>api.configure(39.999,'2026-09-01',true),/importe/);
    assert.throws(()=>api.configure(39.99,'2026-02-30',true),/importe/);
    input(w,'amazon-plan-amount','39.99');input(w,'amazon-plan-start','2026-09-01');w.document.getElementById('amazon-plan-save').click();
    assert.deepEqual(Array.from(api.schedule(api.read(),'2026-10-11').pending),['2026-09-01','2026-10-01']);
    assert.equal(api.schedule(api.read(),'2026-10-11').next,'2026-11-01');
    assert.equal(w.AMAZON_CAPITAL_BALANCE().totalCapital,309.91,'pending months do not debit capital');
    assert.throws(()=>api.register('2026-09-01',39.99,'2026-09-01',false),/Confirma/);
    assert.throws(()=>api.register('2026-11-01',39.99,'2026-10-01',true),/pendiente/);
    assert.throws(()=>api.register('2026-09-01',39.99,'2026-11-01',true),/futura/);
    assert.throws(()=>api.register('2026-09-01',0,'2026-09-01',true),/importe/);
    assert.throws(()=>api.register('invalid',39.99,'2026-09-01',true),/vencimiento/);
    assert.equal(api.totals().paid,0);
    const pending=w.document.querySelector('#amazon-plan-pending button');pending.click();
    assert.equal(w.document.getElementById('amazon-plan-paid-date').value,'','actual date requires evidence');
    w.document.getElementById('amazon-plan-confirm-payment').click();assert.match(w.document.getElementById('amazon-plan-message').textContent,/Confirma/);
    input(w,'amazon-plan-paid-date','2026-09-02');w.document.getElementById('amazon-plan-confirm-payment').click();
    assert.match(w.document.getElementById('amazon-plan-message').textContent,/Confirma/);
    w.document.getElementById('amazon-plan-confirmed').checked=true;w.document.getElementById('amazon-plan-confirm-payment').click();
    await wait(400);assert.equal(api.totals().paid,39.99);assert.equal(api.totals().count,1);
    let b=w.AMAZON_CAPITAL_BALANCE();assert.equal(b.totalCapital,269.92);assert.equal(b.available,169.92);assert.equal(b.planExpenses,39.99);
    assert.equal(b.businessRealized,-30.08);
    assert.equal(w.document.querySelector('#business-net-profit .v').textContent,'US$-30,08');
    assert.equal(w.document.querySelector('#global-total-capital .v').textContent,'$269,92');
    assert.equal(w.document.querySelector('#global-realized-net .v').textContent,'$9,91','lot result stays before the plan');
    assert.equal(w.localStorage.getItem(OPS),originalOps,'expense changes neither product nor lot history');
    assert.equal(JSON.stringify(w.MOTOR_SCORING_ENGINE.financial),originalFin,'fixed expense never gets charged to every unit');
    w.document.querySelector('#amazon-plan-pending button').click();input(w,'amazon-plan-paid-amount','50');
    w.document.getElementById('amazon-plan-cancel-payment').click();assert.equal(api.totals().paid,39.99,'cancel records no expense');
    assert.throws(()=>api.register('2026-09-01',39.99,'2026-09-02',true),/ya está/);
    api.configure(44.99,'2026-09-02',true);
    assert.deepEqual(Array.from(api.schedule(api.read(),'2026-10-11').pending),['2026-10-02'],'one charge per monthly period even after changing billing day');
    assert.equal(api.totals().paid,39.99,'future amount changes never rewrite historical payments');
    api.register('2026-10-02',42.50,'2026-10-03',true);await wait(400);
    assert.equal(api.totals().paid,82.49);assert.equal(w.AMAZON_CAPITAL_BALANCE().totalCapital,227.42);
    const data=storage(w);w.close();({w,alerts}=await mount(data));api=w.AMAZON_PLAN_EXPENSES;
    assert.equal(api.totals().paid,82.49,'reload does not recharge either month');
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,127.42);
    api.voidPayment('AMAZON-PRO-2026-09');assert.equal(w.AMAZON_CAPITAL_BALANCE().totalCapital,267.41);
    assert(api.read().payments.find(p=>p.id==='AMAZON-PRO-2026-09').voidedAt);
    api.register('2026-09-02',39.99,'2026-09-02',true);assert.equal(api.totals().paid,82.49);
    assert.equal(api.read().payments.find(p=>p.id==='AMAZON-PRO-2026-09').previousVersions.length,1);
    api.configure(44.99,'2026-09-02',false);assert.equal(api.schedule(api.read(),'2026-12-31').pending.length,0);assert.equal(api.totals().paid,82.49);
    const stored=w.localStorage.getItem(KEY), setItem=w.Storage.prototype.setItem;
    w.Storage.prototype.setItem=function(k,v){if(k===KEY)throw new Error('synthetic full storage');return setItem.call(this,k,v)};
    assert.throws(()=>api.configure(10,'2026-10-01',true),/No se pudo guardar/);
    w.Storage.prototype.setItem=setItem;assert.equal(w.localStorage.getItem(KEY),stored,'failed persistence never debits capital');
    // No sales is still a business expense, and negative capital is displayed honestly.
    const noSales={...base,[OPS]:'[]'};let m=await mount(noSales);const nw=m.w;
    nw.AMAZON_PLAN_EXPENSES.configure(39.99,'2026-10-01',true);nw.AMAZON_PLAN_EXPENSES.register('2026-10-01',39.99,'2026-10-01',true);
    assert.equal(nw.AMAZON_CAPITAL_BALANCE().totalCapital,260.01);
    assert.equal(nw.document.querySelector('#business-net-profit .v').textContent,'US$-39,99');
    nw.document.getElementById('p_presu').value='20';assert.equal(nw.AMAZON_CAPITAL_BALANCE().totalCapital,-19.99);
    // Corrupted expenses must block new purchases rather than silently become zero.
    const valid=api.read();w.localStorage.setItem(KEY,'{broken');
    assert.equal(api.totals().complete,false);assert.equal(w.AMAZON_CAPITAL_BALANCE().complete,false);
    w.dispatchEvent(new w.Event('motor-scoring-expenses-changed'));await wait(400);assert(w.document.getElementById('ops-buy').disabled);
    w.localStorage.setItem(KEY,JSON.stringify({...valid,payments:[valid.payments[0],valid.payments[0]]}));assert.equal(api.totals().complete,false);
    assert.deepEqual(alerts,[]);
    console.log('PASS: confirmed monthly expenses, duplicate protection, capital and business results, reload, month ends, edits/void audit, no sales and invalid ledger.');
  } finally { windows.forEach(w=>w.close());await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
