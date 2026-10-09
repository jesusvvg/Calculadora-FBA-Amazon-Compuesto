// Full-page isolated regression: ASIN switching, per-product inputs, shared capital and two purchases.
// Run with jsdom available; never accesses the user's browser or saved records.
const {JSDOM,VirtualConsole}=require('jsdom');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),KEY='jev_v1',OPS='amazon_compuesto_operations_v1',CAT='motor_scoring_asin_v1';
const A='B0TESTJEV002',B='B0TESTJEV003';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clone=x=>JSON.parse(JSON.stringify(x));
function initial(){
  const inputs={p_presu:'300',p_unid:'8',p_precio:'39.99',p_ref:'15',p_fba:'5',p_almac:'0',p_ppc:'1',c_venta:'14',p_dias:'61'};
  const state={product:{asin:A,brand:'TEST-A',stage:'CANDIDATO'},eligibility:{status:'AUTORIZADO'},
    costs:{checkout:{displayedUnit:10,discountUnit:0,taxUnit:0,supplierToPrepLot:6},prep:{prepUnit:1,otherPrepLot:1,prepToAmazonLot:1}},
    returns:{returnRateExpected:0,resellablePct:100,removalCostUnit:0,prepReturnCostUnit:0,resendCostUnit:0},
    market:{salesEstimatedMonthly:100,priceMinRecent:39.99,checkedAt:new Date().toISOString()},rotation:{sellThrough90:'ALTO >80%'},capital:{reserveTarget:100}};
  const net=39.99*.85-5-12-1;
  const summary={operationId:'OP-A',units:8,checkout:10,supplier:6,prepUnit:1,other:1,prepAmazon:1,fixedLot:8,total:96,landed:12,budget:300,inputs,
    financial:{complete:true,net,margin:net/39.99,roi:net/12,breakEven:18/.85,returnCost:0}};
  const op={id:'OP-A',kind:'COMPRA',status:'ABIERTA',product:{asin:A,brand:'TEST-A'},
    prediction:{units:1,investment:19,price:39.99,daysToCash:61,roi:.447,margin:.212,costModel:{currency:'USD',rate:1,displayedUnit:10,discountUnit:0,taxUnit:0,supplierToPrepLot:6,prepUnit:1,otherPrepLot:1,prepToAmazonLot:1}},
    purchase:{units:8,investment:96,summary,estimate:{netUnit:net,netTotal:net*8,roi:net/12,margin:net/39.99}},actual:{}};
  return {[KEY]:JSON.stringify(state),fba_v2:JSON.stringify(inputs),[OPS]:JSON.stringify([op])};
}
function saved(w){return Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)]))}
function read(w,key){return JSON.parse(w.localStorage.getItem(key))}
function input(w,id,value){const field=w.document.getElementById(id);assert(field,id);field.value=value;field.dispatchEvent(new w.Event('input',{bubbles:true}));return field}
function change(w,id,value){const field=w.document.getElementById(id);field.value=value;field.dispatchEvent(new w.Event('change',{bubbles:true}))}
function closeLot(w,id,units,profit){
  w.document.querySelector(`.ops-close-btn[data-id="${id}"]`).click();
  for(const [name,value]of Object.entries({units,price:units?39.99:0,returns:0,dtc:61,profit}))input(w,'op-'+name,value);
  w.document.getElementById('op-settled').checked=true;w.document.getElementById('op-confirm').click();
}
(async()=>{
  const server=http.createServer((req,res)=>{try{const name=req.url.split('?')[0],file=path.join(root,name==='/'?'index.html':name);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/`,windows=[];
  async function mount(data=initial()){
    const errors=[],alerts=[],vc=new VirtualConsole();let navigations=0;
    vc.on('jsdomError',e=>{if(/Not implemented: navigation/.test(e.message))navigations++;else errors.push(String(e))});
    const dom=await JSDOM.fromURL(url,{resources:'usable',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){for(const [k,v]of Object.entries(data))w.localStorage.setItem(k,v);w.alert=m=>alerts.push(m);w.confirm=()=>true}});
    const w=dom.window;windows.push(w);await wait(1100);assert.deepEqual(errors,[]);assert.equal(w.MOTOR_SCORING_SELF_TEST.failed,0);
    return {w,alerts,navigations:()=>navigations};
  }
  try{
    let {w,alerts,navigations}=await mount();const originalA=clone(read(w,OPS)[0]);
    const originalFin=clone(w.MOTOR_SCORING_ENGINE.financial);
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,104);
    // Typing another ASIN must not relabel the current product when an identity field saves.
    w.document.getElementById('jev_asin').value=B;input(w,'jev_brand','TEST-A');
    assert.equal(read(w,KEY).product.asin,A);
    change(w,'jev_asin',B);assert.equal(navigations(),1);
    assert.equal(read(w,KEY).product.asin,B);assert.equal(read(w,KEY).capital.reserveTarget,100);
    assert.equal(read(w,'fba_v2').p_precio,'','new ASIN does not borrow the old sale price');
    assert.equal(read(w,CAT)[A].inputs.p_unid,'8');assert.equal(read(w,CAT)[A].inputs.p_ppc,'1');
    assert.deepEqual(read(w,OPS)[0],originalA);
    let data=saved(w);w.close();({w,alerts,navigations}=await mount(data));
    assert.equal(w.document.getElementById('jev_asin').value,B);assert.equal(w.document.getElementById('jev_reserve').value,'100');
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,104);
    assert.equal(w.MOTOR_SCORING_ENGINE.financial.complete,false,'new product starts without an invented financial result');
    for(const [id,value]of Object.entries({jev_displayed:10,jev_discount:0,jev_tax:0,jev_supplier_prep:6,jev_prep_unit:1,jev_prep_other:1,jev_prep_amazon:1,jev_return_rate:0,jev_resellable:100,jev_removal:0,jev_return_prep:0,jev_resend:0,p_precio:39.99,p_ref:15,p_fba:5,p_almac:0,p_ppc:0,p_unid:1,c_venta:14,p_dias:61,jev_brand:'TEST-B'}))input(w,id,value);
    change(w,'jev_eligibility','AUTORIZADO');
    input(w,'jev_sales_month',50);
    const stateB=clone(read(w,KEY)),finB=clone(w.MOTOR_SCORING_ENGINE.financial);
    assert.equal(finB.complete,true);assert.notEqual(finB.roi,originalFin.roi);
    // Keep eligibility/scoring policy out of this test: exercise the actual purchase form with a fixed proposal.
    w.MOTOR_SCORING_ENGINE.final={decision:'COMPRAR PILOTO',pilotUnits:1,pilotCapital:19};
    const buy=w.document.getElementById('ops-buy');buy.disabled=false;buy.click();
    w.document.getElementById('op-buy-confirm').click();await wait(400);assert.deepEqual(alerts,[]);
    let ops=read(w,OPS);assert.equal(ops.length,2);const other=clone(ops[1]);
    assert.equal(other.product.asin,B);assert.equal(other.purchase.units,1);assert.equal(other.purchase.investment,19);
    assert.deepEqual(ops[0],originalA);assert.equal(w.AMAZON_CAPITAL_BALANCE().committed,115);assert.equal(w.AMAZON_CAPITAL_BALANCE().available,85);
    // Archived budget/reserve values are historical context, not separate accounts for each ASIN.
    const catalog=read(w,CAT);catalog[A].inputs.p_presu='999';catalog[A].state.capital.reserveTarget=0;
    w.localStorage.setItem(CAT,JSON.stringify(catalog));change(w,'jev_asin',A);assert.equal(navigations(),1);
    data=saved(w);w.close();({w,alerts,navigations}=await mount(data));
    assert.equal(w.document.getElementById('p_unid').value,'8');assert.equal(w.document.getElementById('p_ppc').value,'1');
    assert.equal(w.document.getElementById('p_presu').value,'300');assert.equal(w.document.getElementById('jev_reserve').value,'100');
    assert.equal(read(w,KEY).market.salesEstimatedMonthly,100);assert.equal(w.document.getElementById('jev_sales_month').value,'100');assert.equal(w.document.getElementById('jev_brand').value,'TEST-A');
    assert.equal(w.MOTOR_SCORING_ENGINE.financial.roi,originalFin.roi,'returning to ASIN restores its own ROI');
    assert.deepEqual(read(w,OPS)[1],other,'switching ASINs never replaces another saved purchase');
    closeLot(w,'OP-A',8,124.43);await wait(400);assert.deepEqual(alerts,[]);
    assert.deepEqual(read(w,OPS)[1],other,'closing product A leaves product B unchanged');
    assert.equal(w.AMAZON_CAPITAL_BALANCE().totalCapital,424.43);assert.equal(w.AMAZON_CAPITAL_BALANCE().committed,19);
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,305.43);
    change(w,'jev_asin',B);data=saved(w);w.close();({w,alerts}=await mount(data));
    assert.equal(w.document.getElementById('p_unid').value,'1');assert.equal(w.document.getElementById('p_ppc').value,'0');
    assert.deepEqual(read(w,KEY).costs,stateB.costs);assert.deepEqual(read(w,KEY).market,stateB.market);
    assert.equal(w.MOTOR_SCORING_ENGINE.financial.roi,finB.roi,'second product prediction survives switching and reload');
    assert.equal(w.AMAZON_CAPITAL_BALANCE().available,305.43);
    closeLot(w,other.id,0,-19);await wait(400);assert.deepEqual(alerts,[]);
    assert.equal(w.AMAZON_CAPITAL_BALANCE().totalCapital,405.43);assert.equal(w.AMAZON_CAPITAL_BALANCE().available,305.43);
    assert.equal(w.JEV_FINANCIAL_SYNC.globalTotals().closedCount,2);
    data=saved(w);w.close();({w,alerts}=await mount(data));assert.equal(w.AMAZON_CAPITAL_BALANCE().totalCapital,405.43);
    assert.equal(w.document.querySelectorAll('.ops-closed-record').length,2);assert(!w.document.querySelector('.ops-archive-fold').open);
    // Failed catalog persistence must block switching rather than abandon the current product.
    const beforeFailure=saved(w),set=w.Storage.prototype.setItem;
    w.Storage.prototype.setItem=function(k,v){if(k===CAT)throw new Error('quota');return set.call(this,k,v)};
    change(w,'jev_asin',A);assert.match(alerts.pop(),/No se pudo guardar/);assert.equal(read(w,KEY).product.asin,B);
    assert.deepEqual(saved(w),beforeFailure);w.Storage.prototype.setItem=set;
    console.log('PASS: two distinct ASINs; independent identity/costs/market/price/quantity/ROI; shared budget/reserve; purchase/close/reload; immutable other lot; storage failure.');
  }finally{windows.forEach(w=>w.close());await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1});
