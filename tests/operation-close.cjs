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
function checkTabs(w){
  const keys=['ciclo','prod','purchases','closed'],before=storage(w),editor=w.document.getElementById('ops-editor');
  for(const key of keys){
    w.document.getElementById('t-'+key).click();
    for(const other of keys){const selected=other===key;
      assert.equal(w.document.getElementById('t-'+other).getAttribute('aria-selected'),String(selected));
      assert.equal(w.document.getElementById('p-'+other).hidden,!selected);
      assert.equal(w.document.getElementById('t-'+other).tabIndex,selected?0:-1);
    }
    assert.equal(w.document.getElementById('ops-editor'),editor,'navigation preserves the mounted form');
  }
  assert.deepEqual(storage(w),before,'navigation never edits financial inputs or saved operations');
}

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
    assert.equal(w.document.querySelectorAll('.tabs [role="tab"]').length,4);
    assert.equal(w.document.getElementById('p_out').parentNode.id,'p-purchases');
    assert.equal(w.document.getElementById('jev_final_decision').closest('[role="tabpanel"]').id,'p-prod');
    checkTabs(w);
    const lastTab=w.document.getElementById('t-closed');
    lastTab.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));
    assert.equal(w.document.activeElement.id,'t-ciclo');
    w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
    assert.equal(w.document.activeElement.id,'t-closed');
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,85);
    assert.equal(w.document.getElementById('global-total-capital'),null,'real results appear after closure');
    assert.equal(w.JEV_FINANCIAL_SYNC.globalTotals().units,9);
    assert.equal(w.document.querySelector('#global-estimated-sales .v').textContent,'$359,91');
    assert(w.document.querySelector('[data-operation-id="OP-EIGHT"] .ops-lot-details').textContent.includes('Facturación estimada del lote$319.92'));
    assert(w.document.querySelector('[data-operation-id="OP-ONE"] .ops-lot-details').textContent.includes('Facturación estimada del lote$39.99'));
    assert.equal(w.AMAZON_CAPITAL_BALANCE('OP-EIGHT',96).afterPurchase,85,'editing replaces rather than adds the existing investment');
    // Existing purchase controls still enforce global capital and reject empty fields.
    w.MOTOR_SCORING_ENGINE.final={decision:'COMPRAR PILOTO',pilotUnits:1,pilotCapital:19};
    w.document.getElementById('ops-buy').disabled=false;w.document.getElementById('ops-buy').click();
    input(w,'op-buy-units','');w.document.getElementById('op-buy-confirm').click();
    assert.match(alerts.pop(),/Completa unidades/);assert.deepEqual(operations(w),baseline);
    input(w,'op-buy-units',1);input(w,'op-buy-investment',86);w.document.getElementById('op-buy-confirm').click();
    assert(w.document.getElementById('op-lot-figures').textContent.includes('Facturación estimada del lote$39.99'));
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
    assert(w.document.getElementById('op-lot-figures').textContent.includes('Facturación estimada del lote$359.91'),'editing quantity updates forecast sales');
    checkTabs(w);assert.equal(w.document.getElementById('op-edit-units'),editor);assert.equal(editor.value,'9');
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
    assert.equal(totals.realizedGains,40);assert.equal(totals.realizedLosses,0);
    assert.equal(w.document.querySelector('#global-realized-losses .v').textContent,'$0,00');
    assert.equal(totals.net,baseline[1].purchase.estimate.netTotal,'closed estimate leaves open totals');
    assert.equal(totals.realizedSales,160);
    assert.equal(w.document.querySelector('#global-realized-sales .v').textContent,'$160,00');
    assert.equal(w.document.querySelector('#global-estimated-sales .v').textContent,'$39,99');
    assert(w.document.getElementById('closed-operations-summary').textContent.includes('$40,00'));
    assert.equal(w.document.querySelector('.ops-close-btn[data-id="OP-EIGHT"]'),null);
    assert.equal(w.document.querySelector('#ops-list [data-operation-id="OP-EIGHT"]'),null,'closed operation leaves the active list');
    let archived=w.document.querySelector('.ops-closed-record[data-id="OP-EIGHT"]');
    const archiveFold=w.document.querySelector('#closed_operations_history > .ops-archive-fold');
    assert(archiveFold&&!archiveFold.open,'entire archive starts collapsed');
    assert.equal(archiveFold.firstElementChild.textContent,'Operaciones cerradas · consulta');
    assert.equal(archived.parentNode,archiveFold,'OP identifiers are nested under the archive heading');
    assert(archived&&!archived.open,'closed operation is archived collapsed');
    assert.equal(archived.querySelector('summary').textContent,'OP-EIGHT','collapsed row displays only the OP identifier');
    assert.equal(w.document.getElementById('closed_operations_history').parentNode.id,'p-closed','archive lives only in its consultation tab');
    assert.equal(w.document.querySelector('#p-prod #closed_operations_history'),null);
    assert.equal(w.document.querySelector('#p-purchases #closed_operations_history'),null);
    assert(w.document.getElementById('closed-operations-summary').compareDocumentPosition(archived)&w.Node.DOCUMENT_POSITION_FOLLOWING);
    const beforeConsult=storage(w);archiveFold.open=true;archived.open=true;
    assert(archived.textContent.includes('RESULTADO REAL:'));assert(archived.textContent.includes('COMPRA REAL:'));
    assert(archived.textContent.includes('RESULTADO REAL: facturación $160.00'),'real sales are visible in closed OP');
    checkTabs(w);assert(archiveFold.open&&archived.open,'consultation stays expanded while navigating tabs');
    assert.deepEqual(storage(w),beforeConsult,'consulting a closed record never changes saved data');
    closeEditor(w,'OP-ONE');fillClose(w,{units:1});
    assert(!w.document.getElementById('closed_operations_history').contains(w.document.getElementById('ops-editor')),'open lot editor never appears under closed archive');
    w.document.getElementById('op-cancel').click();
    const after=storage(w);w.close();({w,alerts}=await mount(after));
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,221,'reload never counts profit twice');
    assert.equal(w.document.querySelector('#global-total-capital .v').textContent,'$340,00');
    assert(!w.document.querySelector('.ops-closed-record[data-id="OP-EIGHT"]').open,'archive starts collapsed after reload');
    assert(!w.document.querySelector('.ops-archive-fold').open,'archive heading also starts collapsed after reload');
    for(let i=0;i<4;i++)w.JEV_FINANCIAL_SYNC.sync();
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,221);
    // Complete loss: zero sales are valid, margin is undefined rather than Infinity.
    closeEditor(w,'OP-ONE');fillClose(w,{units:0,price:0,returns:1,dtc:70,profit:-19});confirmClose(w);await wait(400);
    assert.equal(operations(w)[1].actual.roi,-1);assert.equal(operations(w)[1].actual.margin,null);
    balance=w.AMAZON_CAPITAL_BALANCE();assert.equal(balance.committed,0);
    assert.equal(balance.realized,21);assert.equal(balance.available,221);
    assert.equal(balance.realizedGains,40);assert.equal(balance.realizedLosses,-19);
    assert.equal(w.document.querySelector('#global-realized-gains .v').textContent,'$40,00');
    assert.equal(w.document.querySelector('#global-realized-losses .v').textContent,'$-19,00');
    assert(w.document.querySelector('#global-realized-losses .v').classList.contains('bad'));
    assert.equal(w.document.querySelector('#global-realized-net .v').textContent,'$21,00');
    assert(w.document.getElementById('jev_global_capital').textContent.includes('Pérdidas reales incorporadas: $-19,00'));
    assert.equal(w.document.querySelector('#global-total-capital .v').textContent,'$321,00');
    totals=w.JEV_FINANCIAL_SYNC.globalTotals();assert.equal(totals.count,0);assert.equal(totals.net,0);
    assert.equal(totals.realizedSales,160,'zero-sales loss never adds expected sales to real sales');
    assert.equal(w.document.querySelector('#global-estimated-sales .v').textContent,'$0,00');
    assert(w.document.querySelector('.ops-closed-record[data-id="OP-ONE"]').textContent.includes('RESULTADO REAL: facturación $0.00'));
    const output=w.document.getElementById('p_out').textContent;
    assert(output.includes('0 compras abiertas'));assert(output.includes('$21,00'));
    assert(!output.includes('Infinity'));assert(!output.includes('NaN'));
    const bothClosed=storage(w);w.close();({w}=await mount(bothClosed));
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,221);
    assert.equal(w.document.querySelector('#global-realized-losses .v').textContent,'$-19,00','loss breakdown survives reload');
    assert.equal(w.document.querySelectorAll('#ops-list .ops-row').length,0);
    assert.equal(w.document.querySelectorAll('#closed_operations_history .ops-closed-record').length,2);
    let mutations=0;const observer=new w.MutationObserver(ms=>mutations+=ms.length);
    observer.observe(w.document.getElementById('p_out'),{childList:true,subtree:true});
    for(let i=0;i<4;i++)w.JEV_FINANCIAL_SYNC.sync();await wait(500);
    assert.equal(mutations,0,'global and realized output has no observer loop');observer.disconnect();
    // Same amounts as the user's two simulated closes: the loss stays visible beside a positive net.
    const userCase=clone(bothClosed),userOps=JSON.parse(userCase[KEY]);
    Object.assign(userOps[0].actual,{profit:124.43,unitsSold:8,price:39.99,sales:319.92,roi:124.43/96,margin:124.43/319.92});
    userCase[KEY]=JSON.stringify(userOps);w.close();({w}=await mount(userCase));
    assert.equal(w.document.querySelector('#global-realized-gains .v').textContent,'$124,43');
    assert.equal(w.document.querySelector('#global-realized-losses .v').textContent,'$-19,00');
    assert.equal(w.document.querySelector('#global-realized-net .v').textContent,'$105,43');
    assert.equal(w.document.querySelector('#global-total-capital .v').textContent,'$405,43');
    assert.equal(w.document.querySelector('#global-realized-sales .v').textContent,'$319,92');
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,305.43);
    assert(w.document.getElementById('jev_global_capital').textContent.includes('Ganancias reales incorporadas: $124,43 · Pérdidas reales incorporadas: $-19,00'));
    // User's current ledger: three closed lots and a fourth still open.
    const currentCase=clone(userCase),currentOps=JSON.parse(currentCase[KEY]);
    const third=lot('OP-THIRD',1,19);third.status='CERRADA';
    third.actual={unitsSold:1,price:39.99,sales:39.99,returns:0,daysToCash:61,profit:8.50,capitalSettled:true};
    const fourth=lot('OP-FOURTH',1,19);currentOps.push(third,fourth);
    currentCase[KEY]=JSON.stringify(currentOps);w.close();({w}=await mount(currentCase));
    assert.equal(w.document.querySelector('#global-realized-sales .v').textContent,'$359,91');
    assert.equal(w.document.querySelector('#global-realized-net .v').textContent,'$113,93');
    assert.equal(w.document.querySelector('#global-realized-costs .v').textContent,'$245,98','costs include the zero-sales loss once');
    assert.equal(w.document.getElementById('global-realized-cost-ratio').textContent,'68.3%');
    assert.equal(w.document.querySelector('#global-total-capital .v').textContent,'$413,93');
    assert.equal(w.document.querySelector('#global-capital-for-purchases .v').textContent,'$294,93','free capital deducts open purchases and reserve');
    assert.equal(w.document.querySelector('#global-estimated-sales .v').textContent,'$39,99','open sales stay separate from actual costs');
    const currentLedger=w.localStorage.getItem(KEY);
    input(w,'jev_reserve','50');await wait(300);
    assert.equal(w.document.querySelector('#global-capital-for-purchases .v').textContent,'$344,93','available card follows shared reserve');
    assert.equal(w.document.querySelector('#global-realized-costs .v').textContent,'$245,98');
    assert.equal(w.localStorage.getItem(KEY),currentLedger,'summary updates never modify stored operations');
    input(w,'jev_reserve','100');await wait(300);
    const currentReload=storage(w);w.close();({w}=await mount(currentReload));
    assert.equal(w.document.querySelector('#global-capital-for-purchases .v').textContent,'$294,93');
    assert.equal(w.document.querySelector('#global-realized-costs .v').textContent,'$245,98');
    // With zero real sales a loss still has costs, but no percentage denominator.
    const zeroSales=clone(currentReload);zeroSales[KEY]=JSON.stringify([currentOps[1]]);
    w.close();({w}=await mount(zeroSales));
    assert.equal(w.document.querySelector('#global-realized-costs .v').textContent,'$19,00');
    assert.equal(w.document.getElementById('global-realized-cost-ratio').textContent,'—');
    // Legacy closes may already have been included manually in the budget.
    const legacy=initial(),old=JSON.parse(legacy[KEY]);old[0].status='CERRADA';old[0].actual={profit:40};
    legacy[KEY]=JSON.stringify(old);delete legacy[SELECTED];w.close();({w}=await mount(legacy));
    assert.equal(w.AMAZON_CAPITAL_BALANCE().realized,0);
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,181,'legacy profit is not silently added again');
    assert.equal(w.JEV_FINANCIAL_SYNC.globalTotals().realized,40);
    assert.equal(w.JEV_FINANCIAL_SYNC.globalTotals().realizedGains,40);
    assert.equal(w.AMAZON_CAPITAL_BALANCE().realizedGains,0,'legacy gains stay separate from incorporated capital');
    assert.equal(w.document.querySelector('#global-realized-sales .v').textContent,'—','unknown historical sales are not silently zero');
    assert.equal(w.document.querySelector('#global-realized-costs .v').textContent,'—','unknown real sales cannot produce costs');
    assert.equal(w.document.getElementById('global-realized-cost-ratio').textContent,'—');
    old[0].actual.unitsSold=8;old[0].actual.price=20;w.localStorage.setItem(KEY,JSON.stringify(old));w.JEV_FINANCIAL_SYNC.sync();
    assert.equal(w.document.querySelector('#global-realized-sales .v').textContent,'$160,00','legacy real sales derive from actual units and price');
    // Missing real results must not render a misleading zero for accumulated losses.
    const incomplete=clone(userCase),missing=JSON.parse(incomplete[KEY]);missing[1].actual.profit=null;
    incomplete[KEY]=JSON.stringify(missing);w.close();({w}=await mount(incomplete));
    assert.equal(w.document.querySelector('#global-realized-losses .v').textContent,'—');
    assert.equal(w.document.querySelector('#global-realized-net .v').textContent,'—');
    assert.equal(w.document.querySelector('#global-realized-costs .v').textContent,'—','missing net result cannot produce costs');
    // An analysis remains visible beside the decision even when the open-purchase summary is zero.
    w.close();({w}=await mount(userCase));
    const analysisState=JSON.parse(w.localStorage.getItem('jev_v1'));
    analysisState.eligibility={status:'AUTORIZADO'};
    analysisState.verification={productMatch:{status:'MATCH CONFIRMADO'},brandPolicy:{status:'AUTORIZACIÓN EXPLÍCITA'},supply:{authenticity:'VERIFICADA'},exitPlan:{returnAllowed:'SÍ',finalSale:'NO'}};
    analysisState.returns={returnRateExpected:0,resellablePct:100,removalCostUnit:0,prepReturnCostUnit:0,resendCostUnit:0};
    analysisState.market={checkedAt:new Date().toISOString()};
    w.localStorage.setItem('jev_v1',JSON.stringify(analysisState));
    // Fixed synthetic market signals isolate the existing engine's financial rendering.
    function predictionInput(id,value){
      input(w,id,value);
      w.MOTOR_SCORING_MARKET={result:{score:90,coverage:1}};
      w.MOTOR_SCORING_PHASE5={rotation:{score:90,coverage:1,dtc:61},risk:{score:20,coverage:1}};
      input(w,'p_fba',5); // The financial field renders the engine with the fixed external signals.
    }
    for(const [id,value]of Object.entries({p_precio:39.99,p_ref:15,p_fba:5,p_almac:0,p_ppc:0,c_venta:0,p_unid:1}))w.document.getElementById(id).value=value;
    predictionInput('p_precio',39.99);w.JEV_FINANCIAL_SYNC.sync();
    assert.equal(w.MOTOR_SCORING_ENGINE.final.decision,'COMPRAR PILOTO',JSON.stringify(w.MOTOR_SCORING_ENGINE));
    const estimateBefore=operations(w);
    const format=v=>'$'+Number(v).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2});
    assert.equal(w.document.querySelector('#motor-scoring-prediction').closest('#jev_final_decision').id,'jev_final_decision');
    assert.equal(w.document.querySelector('#motor-scoring-prediction').getAttribute('data-units'),'1');
    assert.equal(w.document.querySelector('#prediction-roi .v').textContent,(w.MOTOR_SCORING_ENGINE.financial.roi*100).toFixed(1)+'%');
    assert.equal(w.document.querySelector('#prediction-net .v').textContent,format(w.MOTOR_SCORING_ENGINE.financial.net));
    assert.equal(w.document.querySelector('#prediction-capital .v').textContent,'$19,00');
    assert.equal(w.document.querySelector('#prediction-available .v').textContent,'$286,43');
    assert.equal(w.JEV_FINANCIAL_SYNC.globalTotals().net,0,'analysis profit never enters the open summary');
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,305.43,'prediction does not reserve capital');
    const firstROI=w.document.querySelector('#prediction-roi .v').textContent;
    predictionInput('p_precio',35);assert.notEqual(w.document.querySelector('#prediction-roi .v').textContent,firstROI,'price changes update prediction');
    w.JEV_FINANCIAL_SYNC.sync();assert.equal(w.document.querySelector('#global-realized-sales .v').textContent,'$319,92','current analysis never overwrites actual recorded sales');
    predictionInput('p_precio',39.99);predictionInput('p_unid',8);
    const recommended=w.MOTOR_SCORING_ENGINE.final;
    assert.equal(recommended.decision,'COMPRAR PILOTO');assert.equal(recommended.pilotUnits,5);
    const pilotFin=w.MOTOR_SCORING_ENGINE.evaluatePurchaseFinancial(5,recommended.pilotCapital);
    assert.equal(w.document.querySelector('#motor-scoring-prediction').getAttribute('data-units'),'5');
    assert.equal(w.document.querySelector('#prediction-roi .v').textContent,(pilotFin.roi*100).toFixed(1)+'%','ROI uses recommended quantity and its fixed-lot costs');
    assert.equal(w.document.querySelector('#prediction-net .v').textContent,format(pilotFin.net*5));
    assert.equal(w.document.querySelector('#prediction-capital .v').textContent,'$63,00');
    assert.deepEqual(operations(w),estimateBefore,'forecast never edits saved open or closed operations');
    analysisState.eligibility.status='NO VERIFICADO';w.localStorage.setItem('jev_v1',JSON.stringify(analysisState));predictionInput('p_precio',39.99);
    assert.equal(w.MOTOR_SCORING_ENGINE.final.decision,'ESPERAR');
    assert.equal(w.document.querySelector('#motor-scoring-prediction').getAttribute('data-kind'),'analysis','waiting analysis is not labelled a recommended purchase');
    analysisState.returns.returnRateExpected=null;w.localStorage.setItem('jev_v1',JSON.stringify(analysisState));predictionInput('p_precio',39.99);
    assert.equal(w.document.getElementById('prediction-roi'),null,'missing inputs never display a fabricated forecast');
    assert(w.document.getElementById('motor-scoring-prediction').textContent.includes('incompleta'));
    // Empty purchase summary must not show the unrelated current analysis as a saved purchase.
    const empty=initial();empty[KEY]='[]';delete empty[SELECTED];w.close();({w}=await mount(empty));
    assert.equal(w.JEV_FINANCIAL_SYNC.globalTotals().count,0);
    assert(w.document.getElementById('p_out').textContent.includes('0 compras abiertas'));
    assert.equal(w.document.querySelector('#p_out .stats .stat .v').textContent,'$0,00');
    assert.equal(w.document.getElementById('closed-operations-summary'),null);
    assert(!w.document.getElementById('closed-operations-empty').hidden);
    checkTabs(w);
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
