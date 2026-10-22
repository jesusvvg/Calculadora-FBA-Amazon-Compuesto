// FBA obligatorio para todos los productos (regla aprobada 2026-10-22). Datos 100 % ficticios.
'use strict';
const {JSDOM,VirtualConsole}=require('jsdom');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const FV=require('../fba-verification.js');
const root=path.resolve(__dirname,'..'),KEY='jev_v1',OPS='amazon_compuesto_operations_v1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const BUY=['COMPRAR PILOTO','REPONER','ESCALAR'];
const ASIN='B0TESTFBA1',now=Date.now(),iso=ms=>new Date(ms).toISOString();
const FBA=o=>({status:'FBA_ELIGIBLE',asin:ASIN,marketplace:'US',condition:'NEW',channel:'FBA',source:'MANUAL',checkedAt:iso(now),validUntil:iso(now+72*3600e3),...o});

// Producto que, con FBA vigente, el motor recomienda como piloto (mismo perfil que tests/jev-observer.cjs).
function pilot(over={}){
  const state={product:{asin:ASIN,brand:'PRIVATE',marketplace:'US',condition:'NEW',stage:'CANDIDATO'},
    eligibility:{status:'AUTORIZADO',checkedAt:iso(now)},fulfillment:FBA(),
    verification:{productMatch:{status:'MATCH CONFIRMADO'},brandPolicy:{status:'AUTORIZACIÓN EXPLÍCITA'},supply:{authenticity:'VERIFICADA',supplierName:'PRIVATE'},
      exitPlan:{returnAllowed:'SÍ',returnWindowDays:30,restockingFeePct:0,returnShippingPaidBy:'PROVEEDOR',finalSale:'NO'}},
    costs:{checkout:{displayedUnit:10,discountUnit:0,taxUnit:0,supplierToPrepLot:6},prep:{prepUnit:1,otherPrepLot:1,prepToAmazonLot:1}},
    returns:{returnRateExpected:0,resellablePct:100,removalCostUnit:0,prepReturnCostUnit:0,resendCostUnit:0},
    market:{bsrCurrent:2000,bsrTrend:'MEJORA',salesEstimatedMonthly:100,sellersFbaCurrent:3,sellersFba30:3,priceAvg30:39.99,priceAvg90:40,priceAvg180:40,priceMinRecent:37.99,priceStability:'ALTA',buyBox:'ESTABLE',amazonSeller:'NO',seasonality:'BAJA',source:'MANUAL',checkedAt:iso(now)},
    rotation:{sellThrough90:'ALTO ≥80%'},risk:{priceWar:'BAJA'},capital:{reserveTarget:100},...over};
  const inputs={p_presu:'300',p_unid:'1',p_precio:'39.99',p_ref:'15',p_fba:'5',p_almac:'0',p_ppc:'0',c_venta:'14',p_dias:'30',p_moneda:'USD',p_tc:'1'};
  return {[KEY]:JSON.stringify(state),fba_v2:JSON.stringify(inputs)};
}

function pure(){
  const P={asin:ASIN,marketplace:'US',condition:'NEW'},g=(f,p=P,e)=>{const r=FV.gate({product:p,fulfillment:f,eligibility:e},now);return r?r.decision:'CONTINUAR'};
  // Tabla aprobada
  assert.equal(g(FBA()),'CONTINUAR','FBA verificado y autorizado → continúa al Motor Scoring');
  assert.equal(g(undefined),'ESPERAR','FBA no verificado → ESPERAR');
  assert.equal(g(FBA({status:'NOT_VERIFIED'})),'ESPERAR');
  assert.equal(g(FBA({status:'REQUIRES_APPROVAL'})),'ESPERAR','requiere aprobación → ESPERAR');
  assert.equal(g(FBA({status:'HAZMAT_REVIEW'})),'ESPERAR');
  assert.equal(g(FBA({status:'FBA_RESTRICTED'})),'DESCARTAR','no autorizado → DESCARTAR');
  assert.equal(g(FBA({status:'CUALQUIERA'})),'ESPERAR','estado desconocido nunca es favorable');
  // Debe corresponder al ASIN, marketplace, condición y modalidad
  assert.equal(g(FBA({asin:'B0OTROASIN'})),'ESPERAR');assert.equal(g(FBA({asin:''})),'ESPERAR');
  assert.equal(g(FBA({marketplace:'CA'})),'ESPERAR');assert.equal(g(FBA(),{...P,marketplace:'MX'}),'ESPERAR');
  assert.equal(g(FBA({condition:'USED'})),'ESPERAR');assert.equal(g(FBA({channel:'FBM'})),'ESPERAR');
  assert.equal(g(FBA({asin:ASIN.toLowerCase()})),'CONTINUAR','mayúsculas/minúsculas no importan');
  assert.match(FV.gate({product:P,fulfillment:FBA({marketplace:'CA',condition:'USED'})},now).reason,/marketplace, condición/);
  // Vigencia
  assert.equal(g(FBA({validUntil:iso(now-1000)})),'ESPERAR');assert.equal(g(FBA({validUntil:null})),'ESPERAR');
  const rec=FV.makeRecord({status:'FBA_ELIGIBLE',asin:'b0testfba1',marketplace:'us',condition:'new',checkedAt:iso(now)});
  assert.deepEqual([rec.asin,rec.marketplace,rec.condition,rec.channel],[ASIN,'US','NEW','FBA']);
  assert.equal(Date.parse(rec.validUntil)-now,72*3600e3);assert.equal(g(rec),'CONTINUAR');
  assert.equal(FV.makeRecord({status:'INVENTADO'}).status,'NOT_VERIFIED');
}

async function page(){
  const server=http.createServer((req,res)=>{try{const name=decodeURIComponent(req.url.split('?')[0]),file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root))throw 0;res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`,wins=[];
  async function mount(data){
    const errors=[],vc=new VirtualConsole();let nav=0;const alerts=[];
    vc.on('jsdomError',e=>{if(/Not implemented: navigation/.test(e.message))nav++;else errors.push(String(e))});
    const dom=await JSDOM.fromURL(url,{resources:'usable',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){for(const [k,v]of Object.entries(data))w.localStorage.setItem(k,v);w.alert=m=>alerts.push(m);w.confirm=()=>true}});
    const w=dom.window;wins.push(w);await wait(1100);assert.deepEqual(errors,[]);
    const st=w.MOTOR_SCORING_SELF_TEST;assert.equal(st.failed,0,JSON.stringify(st));
    return {w,nav:()=>nav,alerts};
  }
  const decide=async data=>{const {w}=await mount(data);const f=w.MOTOR_SCORING_ENGINE.final;const buy=w.document.getElementById('ops-buy');const r={decision:f.decision,reason:f.reason,buyDisabled:buy?buy.disabled:null};w.close();return r};
  try{
    // Control positivo: con permiso y FBA vigentes, este producto SÍ llega a COMPRAR PILOTO (la puerta es lo único que cambia abajo)
    const ok=await decide(pilot());assert.equal(ok.decision,'COMPRAR PILOTO',ok.reason);

    // Ningún producto sin elegibilidad y FBA verificados recibe COMPRAR PILOTO, REPONER ni ESCALAR
    const eligs=['AUTORIZADO','NO VERIFICADO','REQUIERE APROBACIÓN','NO AUTORIZADO'];
    const fbas={ninguno:undefined,vigente:FBA(),caducado:FBA({validUntil:iso(now-1000)}),otro_asin:FBA({asin:'B0OTROASIN'}),otro_marketplace:FBA({marketplace:'CA'}),
      otra_condicion:FBA({condition:'USED'}),requiere:FBA({status:'REQUIRES_APPROVAL'}),no_autorizado:FBA({status:'FBA_RESTRICTED'}),no_verificado:FBA({status:'NOT_VERIFIED'})};
    for(const e of eligs)for(const [name,f] of Object.entries(fbas)){
      if(e==='AUTORIZADO'&&name==='vigente')continue;
      const r=await decide(pilot({eligibility:{status:e,checkedAt:iso(now)},fulfillment:f}));
      assert(!BUY.includes(r.decision),`${e} + FBA ${name} no puede recomendar compra (salió ${r.decision})`);
      assert.equal(r.buyDisabled,true,`${e} + FBA ${name}: «Registrar compra» bloqueado`);
      if(e==='NO AUTORIZADO'||name==='no_autorizado')assert.equal(r.decision,'DESCARTAR',`${e} + ${name}`);else assert.equal(r.decision,'ESPERAR',`${e} + ${name}`);
    }

    // Registro manual en la ficha: queda ligado al ASIN, marketplace y condición actuales
    const noFba=pilot({fulfillment:undefined});let {w,nav,alerts}=await mount(noFba);
    const box=w.document.getElementById('fba-verification');assert(box,'panel de verificación FBA');assert.match(box.textContent,/ESPERAR/);
    assert.equal(w.MOTOR_SCORING_ENGINE.final.decision,'ESPERAR');
    w.document.getElementById('fba_status').value='FBA_ELIGIBLE';w.document.getElementById('fba_save').click();
    assert.equal(nav(),0);assert.match(alerts[0]||'',/Anota/,'sin nota no se registra');
    w.document.getElementById('fba_note').value='Add a Product: FBA sin restricción (prueba ficticia)';w.document.getElementById('fba_save').click();
    assert.equal(nav(),1,'recarga tras registrar');
    const saved=JSON.parse(w.localStorage.getItem(KEY)).fulfillment;
    assert.deepEqual([saved.status,saved.asin,saved.marketplace,saved.condition,saved.channel,saved.source],['FBA_ELIGIBLE',ASIN,'US','NEW','FBA','MANUAL']);
    assert(saved.checkedAt&&saved.validUntil);
    const data=Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)]));w.close();
    ({w}=await mount(data));assert.equal(w.MOTOR_SCORING_ENGINE.final.decision,'COMPRAR PILOTO');assert.match(w.document.getElementById('fba-verification').textContent,/FBA vigente/);w.close();

    // Decisiones guardadas no cambian retroactivamente; operaciones e históricos intactos
    const op={id:'OP-HIST',kind:'COMPRA',status:'ABIERTA',product:{asin:'B0HISTORIC1',brand:'TEST-H'},
      prediction:{decision:'COMPRAR PILOTO',units:2,investment:24,price:29.99,daysToCash:60,roi:.3,margin:.2},purchase:{units:2,investment:24},actual:{}};
    const an={id:'AN-HIST',kind:'ANÁLISIS',status:'ANALIZADA',product:{asin:'B0HISTORIC2'},prediction:{decision:'COMPRAR PILOTO',units:1,investment:12,price:19.99}};
    const hist={...noFba,[OPS]:JSON.stringify([op,an])};
    ({w}=await mount(hist));
    assert.equal(w.localStorage.getItem(OPS),hist[OPS],'operaciones y análisis guardados sin cambios');
    assert.match(w.document.body.textContent,/PREDICCIÓN:\s*COMPRAR PILOTO/,'la predicción histórica se muestra tal como se guardó');
    assert.equal(w.MOTOR_SCORING_ENGINE.final.decision,'ESPERAR','la decisión ACTUAL sí aplica la regla nueva');
    assert.equal(w.document.getElementById('ops-buy').disabled,true);w.close();
  }finally{wins.forEach(x=>{try{x.close()}catch{}});server.close()}
}

(async()=>{pure();await page();
  console.log('PASS: FBA mandatory for all products (manual/Scanner/Nepeto); verified+authorized continues, unverified/approval wait, not authorized discards; ASIN/marketplace/condition/FBA channel must match; 72 h validity; manual record panel with required note; no COMPRAR PILOTO/REPONER/ESCALAR across 35 eligibility×FBA combinations; purchase button blocked; saved predictions and operations unchanged.');
})().catch(e=>{console.error(e);process.exit(1)});
