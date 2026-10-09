// Run with Node and jsdom available (NODE_PATH may point to a temporary install).
// Uses an isolated local server and synthetic localStorage; never changes user data.
const {JSDOM, VirtualConsole} = require('jsdom');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const KEY = 'amazon_compuesto_operations_v1';
const SELECTED = 'amazon_compuesto_selected_purchase_v1';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = value => JSON.parse(JSON.stringify(value));

function lot(id, units, investment) {
  const price = 39.99, net = price * .85 - 5 - investment / units;
  const summary = {operationId:id, units, checkout:10, supplier:6, prepUnit:1,
    other:1, prepAmazon:1, fixedLot:8, total:investment, landed:investment/units,
    budget:300, inputs:{p_precio:price,p_ref:15,p_fba:5,p_almac:0,c_venta:0,p_ppc:0},
    financial:{complete:true, net, roi:net/(investment/units), margin:net/price,
      breakEven:(investment/units+5)/.85, returnCost:0}};
  return {id,kind:'COMPRA',status:'ABIERTA',product:{asin:'SYNTHETIC'},
    prediction:{units:1,investment:19,price,roi:.45,margin:.21,daysToCash:61,
      costModel:{currency:'USD',rate:1,displayedUnit:10,discountUnit:0,taxUnit:0,
        supplierToPrepLot:6,prepUnit:1,otherPrepLot:1,prepToAmazonLot:1}},
    purchase:{units,investment,summary,estimate:{netUnit:net,netTotal:net*units,
      roi:summary.financial.roi,margin:summary.financial.margin,breakEven:summary.financial.breakEven}},
    actual:{unitsSold:null,price:null,returns:null,daysToCash:null,profit:null}};
}
function initial() {
  const ops = [lot('OP-EIGHT',8,96),lot('OP-ONE',1,19)];
  return {[KEY]:JSON.stringify(ops),[SELECTED]:JSON.stringify({id:ops[0].id,summary:ops[0].purchase.summary}),
    jev_v1:JSON.stringify({capital:{reserveTarget:100},costs:{checkout:{displayedUnit:10,taxUnit:0,supplierToPrepLot:6},prep:{prepUnit:1,otherPrepLot:1,prepToAmazonLot:1}}}),
    fba_v2:JSON.stringify({p_presu:'300',p_unid:'1',p_precio:'39.99'})};
}
function storage(w) { return Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)])); }
function operations(w) { return JSON.parse(w.localStorage.getItem(KEY)); }
function input(w,id,value) { const e=w.document.getElementById(id);e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));return e; }
function closeEditor(w,id) {
  w.document.querySelector(`.ops-close-btn[data-id="${id}"]`).click();
  assert.equal(w.document.getElementById('ops-editor').parentNode.getAttribute('data-operation-id'),id,'close form belongs directly to the chosen operation');
}
function fillClose(w,values={}) {
  const fields={units:8,price:20,returns:0,dtc:61,profit:40,...values};
  for(const [k,v] of Object.entries(fields)) input(w,'op-'+k,v);
}
function confirmClose(w) { w.document.getElementById('op-settled').checked=true;w.document.getElementById('op-confirm').click(); }

(async()=>{
  const server=http.createServer((req,res)=>{
    try {
      const name=req.url.split('?')[0];
      const file=path.join(root,name==='/'?'index.html':name);
      res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');
      res.end(fs.readFileSync(file));
    } catch { res.statusCode=404;res.end(); }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/`,windows=[];
  async function mount(saved=initial()) {
    const errors=[],alerts=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e)));
    const dom=await JSDOM.fromURL(url,{resources:'usable',runScripts:'dangerously',virtualConsole:vc,
      beforeParse(w){for(const [k,v]of Object.entries(saved))w.localStorage.setItem(k,v);w.alert=m=>alerts.push(m);w.confirm=()=>true;}});
    const w=dom.window;windows.push(w);await wait(1100);
    assert.deepEqual(errors,[],'full page startup has no script errors');
    assert.equal(w.MOTOR_SCORING_SELF_TEST.failed,0,'all engine self-tests pass');
    return {w,alerts,errors};
  }
  try {
    let {w,alerts}=await mount();
    const baseline=operations(w),baseStorage=storage(w);
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,85);
    assert.equal(w.document.getElementById('global-total-capital'),null,'real results appear after closure');
    assert.equal(w.JEV_FINANCIAL_SYNC.globalTotals().units,9);
    assert.equal(w.AMAZON_CAPITAL_BALANCE('OP-EIGHT',96).afterPurchase,85,'editing replaces rather than adds the existing investment');
    // Existing purchase controls still enforce global capital and reject empty fields.
    w.MOTOR_SCORING_ENGINE.final={decision:'COMPRAR PILOTO',pilotUnits:1,pilotCapital:19};
    w.document.getElementById('ops-buy').disabled=false;w.document.getElementById('ops-buy').click();
    input(w,'op-buy-units','');w.document.getElementById('op-buy-confirm').click();
    assert.match(alerts.pop(),/Completa unidades/);assert.deepEqual(operations(w),baseline);
    input(w,'op-buy-units',1);input(w,'op-buy-investment',86);w.document.getElementById('op-buy-confirm').click();
    assert.match(alerts.pop(),/solo hay/);assert.deepEqual(operations(w),baseline);
    w.document.getElementById('op-buy-cancel').click();
    closeEditor(w,'OP-EIGHT');w.document.getElementById('op-confirm').click();
    assert.match(alerts.pop(),/Completa todos/,'blank fields are not zero');
    assert.deepEqual(operations(w),baseline);
    fillClose(w);w.document.getElementById('op-confirm').click();
    assert.match(alerts.pop(),/liquidado/,'cash must be settled before release');
    for(const [field,value]of [['units',9],['units',1.5],['returns',9],['returns',.5],['price',-1],['dtc',-1],['dtc',1.5]]) {
      fillClose(w);input(w,'op-'+field,value);confirmClose(w);
      assert.match(alerts.pop(),/Revisa/);assert.deepEqual(operations(w),baseline);
    }
    fillClose(w,{price:0});confirmClose(w);assert.match(alerts.pop(),/precio positivo/);
    fillClose(w);w.document.getElementById('op-cancel').click();
    assert.deepEqual(storage(w),baseStorage,'cancel changes no saved data');
    // Editing quantity still leaves its form mounted; cancel preserves the global summary.
    w.document.querySelector('.ops-edit-btn[data-id="OP-EIGHT"]').click();
    const editor=input(w,'op-edit-units',9);w.AMAZON_COMPOUND_OPERATIONS.render();
    assert.equal(w.document.getElementById('op-edit-units'),editor);
    assert.equal(editor.closest('.ops-row').getAttribute('data-operation-id'),'OP-EIGHT','edit form belongs to its operation');
    w.document.getElementById('op-edit-cancel').click();assert.deepEqual(operations(w),baseline);
    closeEditor(w,'OP-EIGHT');fillClose(w);confirmClose(w);await wait(400);
    const closed=operations(w)[0];
    assert.equal(closed.status,'CERRADA');assert.equal(closed.actual.sales,160);
    assert.equal(closed.actual.roi,40/96);assert.equal(closed.actual.margin,.25);
    assert.deepEqual(closed.prediction,baseline[0].prediction,'original prediction stays frozen');
    assert.deepEqual(closed.purchase,baseline[0].purchase,'original lot estimate stays frozen');
    assert.deepEqual(operations(w)[1],baseline[1],'other lot is entirely unchanged');
    assert.equal(closed.variance.roi,40/96-baseline[0].purchase.estimate.roi,'compare against purchased lot');
    let balance=w.AMAZON_CAPITAL_BALANCE();
    assert.equal(balance.committed,19);assert.equal(balance.realized,40);
    assert.equal(balance.totalCapital,340);assert.equal(balance.available,221);
    assert.equal(w.document.querySelector('#global-total-capital .v').textContent,'$340,00');
    assert.equal(w.document.getElementById('global-total-capital').parentNode.parentNode.id,'closed-operations-summary');
    let totals=w.JEV_FINANCIAL_SYNC.globalTotals();
    assert.equal(totals.count,1);assert.equal(totals.closedCount,1);assert.equal(totals.realized,40);
    assert.equal(totals.net,baseline[1].purchase.estimate.netTotal,'closed estimate leaves open totals');
    assert(w.document.getElementById('closed-operations-summary').textContent.includes('$40,00'));
    assert.equal(w.document.querySelector('.ops-close-btn[data-id="OP-EIGHT"]'),null);
    assert.equal(w.document.querySelector('#ops-list [data-operation-id="OP-EIGHT"]'),null,'closed operation leaves the active list');
    let archived=w.document.querySelector('.ops-closed-record[data-id="OP-EIGHT"]');
    assert(archived&&!archived.open,'closed operation is archived collapsed');
    assert.equal(archived.querySelector('summary').textContent,'OP-EIGHT','collapsed row displays only the OP identifier');
    assert.equal(w.document.getElementById('p-prod').lastElementChild.id,'closed_operations_history','archive is after the output and last capital cards');
    assert(w.document.getElementById('closed-operations-summary').compareDocumentPosition(archived)&w.Node.DOCUMENT_POSITION_FOLLOWING);
    const beforeConsult=storage(w);archived.open=true;
    assert(archived.textContent.includes('RESULTADO REAL:'));assert(archived.textContent.includes('COMPRA REAL:'));
    assert.deepEqual(storage(w),beforeConsult,'consulting a closed record never changes saved data');
    closeEditor(w,'OP-ONE');fillClose(w,{units:1});
    assert(!w.document.getElementById('closed_operations_history').contains(w.document.getElementById('ops-editor')),'open lot editor never appears under closed archive');
    w.document.getElementById('op-cancel').click();
    const after=storage(w);w.close();({w,alerts}=await mount(after));
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,221,'reload never counts profit twice');
    assert.equal(w.document.querySelector('#global-total-capital .v').textContent,'$340,00');
    assert(!w.document.querySelector('.ops-closed-record[data-id="OP-EIGHT"]').open,'archive starts collapsed after reload');
    for(let i=0;i<4;i++)w.JEV_FINANCIAL_SYNC.sync();
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,221);
    // Complete loss: zero sales are valid, margin is undefined rather than Infinity.
    closeEditor(w,'OP-ONE');fillClose(w,{units:0,price:0,returns:1,dtc:70,profit:-19});confirmClose(w);await wait(400);
    assert.equal(operations(w)[1].actual.roi,-1);assert.equal(operations(w)[1].actual.margin,null);
    balance=w.AMAZON_CAPITAL_BALANCE();assert.equal(balance.committed,0);
    assert.equal(balance.realized,21);assert.equal(balance.available,221);
    assert.equal(w.document.querySelector('#global-total-capital .v').textContent,'$321,00');
    totals=w.JEV_FINANCIAL_SYNC.globalTotals();assert.equal(totals.count,0);assert.equal(totals.net,0);
    const output=w.document.getElementById('p_out').textContent;
    assert(output.includes('0 compras abiertas'));assert(output.includes('$21,00'));
    assert(!output.includes('Infinity'));assert(!output.includes('NaN'));
    const bothClosed=storage(w);w.close();({w}=await mount(bothClosed));
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,221);
    assert.equal(w.document.querySelectorAll('#ops-list .ops-row').length,0);
    assert.equal(w.document.querySelectorAll('#closed_operations_history .ops-closed-record').length,2);
    let mutations=0;const observer=new w.MutationObserver(ms=>mutations+=ms.length);
    observer.observe(w.document.getElementById('p_out'),{childList:true,subtree:true});
    for(let i=0;i<4;i++)w.JEV_FINANCIAL_SYNC.sync();await wait(500);
    assert.equal(mutations,0,'global and realized output has no observer loop');observer.disconnect();
    // Legacy closes may already have been included manually in the budget.
    const legacy=initial(),old=JSON.parse(legacy[KEY]);old[0].status='CERRADA';old[0].actual={profit:40};
    legacy[KEY]=JSON.stringify(old);delete legacy[SELECTED];w.close();({w}=await mount(legacy));
    assert.equal(w.AMAZON_CAPITAL_BALANCE().realized,0);
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,181,'legacy profit is not silently added again');
    assert.equal(w.JEV_FINANCIAL_SYNC.globalTotals().realized,40);
    // Detect concurrent edits and storage failures without losing either lot.
    w.close();({w,alerts}=await mount());closeEditor(w,'OP-EIGHT');fillClose(w);
    const changed=operations(w);changed[0].purchase.units=7;w.localStorage.setItem(KEY,JSON.stringify(changed));
    confirmClose(w);assert.match(alerts.pop(),/operación cambió/);assert.equal(operations(w)[0].status,'ABIERTA');
    w.close();({w,alerts}=await mount());closeEditor(w,'OP-EIGHT');fillClose(w);
    const original=w.Storage.prototype.setItem;
    w.Storage.prototype.setItem=function(k,v){if(k===KEY)throw new Error('quota');return original.call(this,k,v);};
    confirmClose(w);assert.match(alerts.pop(),/No se pudo guardar/);assert.equal(operations(w)[0].status,'ABIERTA');
    w.Storage.prototype.setItem=original;
    console.log('PASS: real full-page closure; blank/invalid inputs; settlement; cancel; edit stability; profit/loss; automatic ROI/margin; unchanged other lot and predictions; global separation; reload; legacy compatibility; concurrency; storage failure; stable DOM; engine self-tests.');
  } finally { windows.forEach(w=>w.close());await new Promise(resolve=>server.close(resolve)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
