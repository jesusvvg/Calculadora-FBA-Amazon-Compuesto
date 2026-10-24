// Puente Scanner JSON v2.3 → Calculador. Pruebas del núcleo puro y de la página completa (jsdom).
// Datos 100 % ficticios. El fixture «real» lo generó el exportador del Scanner (rama prefiltro-economico, 2026-10-24) con Amazon simulado:
// trae logistics_status y la procedencia de la verificación FBA (fba_verification).
'use strict';
const {JSDOM,VirtualConsole}=require('jsdom');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const SB=require('../scanner-bridge.js');
const root=path.resolve(__dirname,'..'),KEY='jev_v1',OPS='amazon_compuesto_operations_v1',CAT='motor_scoring_asin_v1',PLAN='amazon_compuesto_plan_expenses_v1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const clone=x=>JSON.parse(JSON.stringify(x));
const REAL=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','scanner-v23-export-real-3.json'),'utf8'));
const REF=REAL.prospects[0].fba_verification.account_ref,MINE={trustedAccountRef:REF};   // huella registrada de TU cuenta

// Re-ancla las fechas del fixture a «ahora» para que la prueba no caduque con el calendario.
function fresh(doc,{hoursAgo=1,validHours=48}={}){
  const d=clone(doc),now=Date.now(),at=new Date(now-hoursAgo*3600e3).toISOString(),exp=new Date(now+validHours*3600e3).toISOString();
  d.exported_at=at;d.prospects.forEach(p=>{p.last_checked=at;p.expires_at=exp;if(p.amazon_fees)p.amazon_fees.fetched_at=at;
    if(p.fba_verification){p.fba_verification.checked_at=at;p.fba_verification.valid_until=new Date(Date.parse(at)+72*3600e3).toISOString()}});return d;
}
const txt=x=>JSON.stringify(x);
function memLS(init={},failOn){const m=new Map(Object.entries(init));let n=0;return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{n++;if(failOn&&failOn(k,n))throw Object.assign(new Error('quota'),{name:'QuotaExceededError'});m.set(k,String(v))},removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)}}

// ---------------------------------------------------------------- núcleo puro
function core(){
  // 1 y 2. Export real v2.3 con 3 prospectos; GTIN con ceros como texto
  const doc=fresh(REAL),parsed=SB.parse(txt(doc));
  assert.equal(parsed.ok,true,parsed.error);assert.equal(parsed.kind,'v2.3');assert.equal(parsed.records.length,3);
  assert(parsed.records.every(r=>r.ok),JSON.stringify(parsed.records.map(r=>r.errors)));
  const r0=parsed.records.find(r=>r.asin==='B0FAKE0003').data;
  assert.equal(r0.gtin,'00000000000031');assert.equal(typeof r0.gtin,'string');
  // 3. Publicar y FBA separados
  assert.equal(r0.listingStatus,'AUTORIZADO');assert.equal(r0.fbaStatus,'FBA_ELIGIBLE');assert.equal(r0.marketplace,'US');
  // 4 y 5. Precio de venta ≠ costo; comisiones en USD → % solo con el mismo denominador
  const c=SB.newCandidate(r0,'v2.3','2026-01-01T00:00:00.000Z',{p_ref:'15',p_fba:'5.50',p_cogs:'18',p_flete:'10',p_presu:'999'},{p_presu:'300',p_plan:'pro'},'US',MINE);
  assert.equal(c.inputs.p_precio,String(r0.salePrice));assert.notEqual(c.inputs.p_precio,String(r0.acquisitionCost));
  assert.equal(c.inputs.p_ref,String(Math.round(r0.fees.referral/r0.salePrice*10000)/100));
  assert.equal(c.inputs.p_fba,String(Math.round((r0.fees.fba+r0.fees.other)*100)/100));
  assert.equal(c.inputs.p_cogs,'');assert.equal(c.inputs.p_flete,'');assert.equal(c.inputs.p_unid,'1');assert.equal(c.inputs.p_presu,'300');
  // 6 y 7. Nada desconocido se vuelve favorable; no se fabrican fechas
  assert.equal(c.state.market.amazonSeller,'NO VERIFICADO');assert.equal(c.state.market.checkedAt,r0.lastChecked);
  assert.equal(c.state.eligibility.checkedAt,null);assert.equal(c.state.eligibility.evidenceAt,doc.exported_at.replace(/\+00:00$/,'Z').replace(/(\.\d{3})\d*Z$/,'$1Z'));
  // La fecha del chequeo FBA es la REAL que registró el Scanner (no la de exportación) y trae su procedencia
  assert.equal(c.state.fulfillment.checkedAt,new Date(doc.prospects[0].fba_verification.checked_at).toISOString());
  assert.deepEqual([c.state.fulfillment.method,c.state.fulfillment.origin,c.state.fulfillment.source],['USER_DECLARED','SELLER_CENTRAL_MANUAL','SCANNER']);
  assert.match(c.state.fulfillment.accountRef,/^[0-9a-f]{12}$/);assert(c.state.fulfillment.note);
  assert.equal(r0.logisticsStatus,'ASSUMED');assert.equal(c.state.product.stage,'CANDIDATO');
  assert.equal(c.state.verification,undefined,'el match del Scanner no marca tu verificación manual');
  assert.equal(c.state.market.salesEstimatedMonthly,undefined);assert.equal(c.state.market.buyBox,undefined);

  // 8. Puerta FBA
  const now=Date.now(),soon=new Date(now+3600e3).toISOString(),past=new Date(now-60e3).toISOString();
  // Regla vigente: FBA obligatorio para todos los productos (detalle en tests/fba-verification.cjs)
  const P={asin:'B0FAKE0003',marketplace:'US',condition:'NEW'},F=o=>({status:'FBA_ELIGIBLE',asin:'B0FAKE0003',marketplace:'US',condition:'NEW',channel:'FBA',checkedAt:past,validUntil:soon,...o});
  assert.equal(SB.fbaGate({product:P},now).decision,'ESPERAR','sin verificación FBA → ESPERAR');
  assert.equal(SB.fbaGate({product:P,fulfillment:F({status:'FBA_RESTRICTED'})},now).decision,'DESCARTAR');
  assert.equal(SB.fbaGate({product:P,fulfillment:F({status:'NOT_VERIFIED'})},now).decision,'ESPERAR');
  assert.equal(SB.fbaGate({product:P,fulfillment:F({status:'HAZMAT_REVIEW'})},now).decision,'ESPERAR');
  assert.equal(SB.fbaGate({product:P,fulfillment:F(),eligibility:{source:'SCANNER',validUntil:soon}},now),null);
  assert.equal(SB.fbaGate({product:P,fulfillment:F({validUntil:past})},now).decision,'ESPERAR');
  assert.equal(SB.fbaGate({product:P,fulfillment:F({validUntil:undefined})},now).decision,'ESPERAR','sin fecha de vigencia no se inventa una');
  assert.equal(SB.fbaGate({product:P,fulfillment:F(),eligibility:{source:'SCANNER',validUntil:past}},now).decision,'ESPERAR');
  // El registro importado queda ligado a ASIN, marketplace, condición y modalidad
  assert.deepEqual([c.state.fulfillment.asin,c.state.fulfillment.marketplace,c.state.fulfillment.condition,c.state.fulfillment.channel],['B0FAKE0003','US','NEW','FBA']);
  assert.equal(SB.fbaGate(c.state,now),null,'candidato del Scanner con FBA vigente y del mismo producto pasa la puerta FBA');
  // Archivo caducado
  const old=SB.parse(txt(fresh(REAL,{hoursAgo:100,validHours:-1})));
  assert(old.records.every(r=>r.ok&&r.expired));
  const oc=SB.newCandidate(old.records[0].data,'v2.3','x',{},{},'US');assert.equal(SB.fbaGate(oc.state,now).decision,'ESPERAR');
  // 9. Procedencia FBA (2026-10-24): un JSON que solo DECLARA FBA_ELIGIBLE no basta
  const strip=f=>{const d=fresh(REAL);d.prospects.forEach(f);return SB.parse(txt(d)).records.find(r=>r.asin==='B0FAKE0003')};
  const cand=(r,o=MINE)=>SB.newCandidate(r.data,'v2.3','x',{},{},'US',o).state;
  const bare=strip(p=>{delete p.fba_verification});
  assert(bare.ok&&bare.warnings.some(w=>/sin procedencia/.test(w)));
  assert.equal(cand(bare).fulfillment.checkedAt,null);assert.match(SB.fbaGate(cand(bare),now).reason,/procedencia/);
  const noAcct=strip(p=>{p.fba_verification.account_ref=null});assert.match(SB.fbaGate(cand(noAcct),now).reason,/ligada a tu cuenta/);
  // Cuenta (revisión PR #4): un hash cualquiera no prueba que sea TU cuenta
  const good=strip(()=>{});assert.equal(SB.fbaGate(cand(good),now),null,'misma huella que la registrada → pasa');
  const unreg=cand(good,{});assert.equal(unreg.fulfillment.accountCheck,'NOT_REGISTERED');assert.equal(unreg.fulfillment.accountRef,null);
  assert.match(SB.fbaGate(unreg,now).reason,/ligada a tu cuenta/,'sin huella registrada → ESPERAR');
  const other=cand(good,{trustedAccountRef:'0123456789ab'});assert.equal(other.fulfillment.accountCheck,'OTHER_ACCOUNT');
  assert.equal(SB.fbaGate(other,now).decision,'ESPERAR','huella de otra cuenta → ESPERAR');
  assert.equal(cand(good,{trustedAccountRef:'no-es-huella'}).fulfillment.accountCheck,'NOT_REGISTERED','huella mal formada = no registrada');
  const forged=strip(p=>{p.fba_verification.account_ref='ffffffffffff'});assert.equal(SB.fbaGate(cand(forged),now).decision,'ESPERAR','hash inventado → ESPERAR');
  assert.equal(JSON.stringify(cand(good)).includes('FAKESELLER01'),false,'nunca el Seller ID');
  const noNote=strip(p=>{p.fba_verification.note=''});assert.equal(SB.fbaGate(cand(noNote),now).decision,'ESPERAR');
  const badMethod=strip(p=>{p.fba_verification.method='JSON'});assert(badMethod.warnings.some(w=>/método desconocido/.test(w)));
  assert.equal(SB.fbaGate(cand(badMethod),now).decision,'ESPERAR');
  const otherAsin=strip(p=>{p.fba_verification.asin='B0OTROASIN'});assert.equal(SB.fbaGate(cand(otherAsin),now).decision,'ESPERAR');
  const mism=strip(p=>{p.fba_verification.status='FBA_RESTRICTED'});assert(mism.warnings.some(w=>/estado distinto/.test(w)));
  const future=strip(p=>{p.fba_verification.checked_at=new Date(now+3600e3).toISOString()});assert.match(SB.fbaGate(cand(future),now).reason,/procedencia/);
  // Vigencia = la menor entre valid_until, expires_at y chequeo + 72 h
  const longV=strip(p=>{const t=new Date(now-80*3600e3).toISOString();p.fba_verification.checked_at=t;p.fba_verification.valid_until=new Date(now+999*3600e3).toISOString()});
  assert.match(SB.fbaGate(cand(longV),now).reason,/caducó/,'un valid_until generoso no extiende las 72 h');
  const shortV=strip(p=>{p.fba_verification.valid_until=new Date(now-1000).toISOString()});assert.match(SB.fbaGate(cand(shortV),now).reason,/caducó/);
  const quoted=strip(p=>{p.logistics_status='QUOTED'});assert.equal(quoted.data.logisticsStatus,'QUOTED');
  assert.equal(strip(p=>{p.logistics_status='INVENTADO'}).data.logisticsStatus,'ASSUMED','estado desconocido = supuesto');

  // 11. Archivos y registros inválidos: rechazo comprensible, sin escribir
  const bad=(t,re)=>{const p=SB.parse(t);assert.equal(p.ok,false,t.slice(0,60));assert.match(p.error,re)};
  bad('{no json',/JSON válido/);bad(txt({generator:'Otro',schema_version:'2.3',prospects:[]}),/Amazon Sourcing Scanner/);
  bad(txt({...doc,schema_version:'2.4'}),/no soportada/);bad(txt({...doc,count:5}),/incompleto o alterado/);
  bad(txt({...doc,exported_at:'ayer'}),/exportación inválida/);bad('x'.repeat(2*1024*1024+1),/demasiado grande/);
  bad(txt({...doc,count:501,prospects:Array(501).fill(doc.prospects[0])}),/Demasiados/);bad(txt([1,2]),/Amazon Sourcing Scanner/);
  const empty=SB.parse(txt({...doc,count:0,prospects:[]}));assert.equal(empty.ok,true);assert.equal(empty.records.length,0);
  const mk=(over)=>{const d=fresh(REAL);Object.assign(d.prospects[0],over);return SB.parse(txt(d)).records[0]};
  assert.match(mk({asin:'B0<script>'}).errors.join(),/ASIN inválido/);
  assert.match(mk({gtin:36000291452}).errors.join(),/texto/);
  assert.match(mk({condition:'USED'}).errors.join(),/solo NEW/);
  assert.match(mk({source_price:-1}).errors.join(),/fuera de rango/);
  assert.match(mk({amazon_price:'17.99',amazon_sale_price_conservative:null}).errors.join(),/no es un número/);
  assert.match(mk({amazon_fees:{total:'5'}}).errors.join(),/amazon_fees/);
  const js=mk({source_url:'javascript:alert(1)'});assert.equal(js.ok,true);assert.equal(js.data.sourceUrl,null);assert.match(js.warnings.join(),/descartado/);
  const unk=mk({listing_eligibility:'MAYBE',fulfillment_eligibility:'SURE'});assert.equal(unk.data.listingStatus,'NO VERIFICADO');assert.equal(unk.data.fbaStatus,'NOT_VERIFIED');
  const dupDoc=fresh(REAL);dupDoc.prospects[1].asin=dupDoc.prospects[0].asin;const dup=SB.parse(txt(dupDoc));
  assert.equal(dup.records[1].duplicate,true);assert.equal(dup.records[1].ok,false);
  const nomk=fresh(REAL);nomk.prospects.forEach(p=>delete p.amazon_url);const pn=SB.parse(txt(nomk));
  assert.equal(SB.plan({},pn,['B0FAKE0003']).results[0].action,'RECHAZADO','marketplace desconocido no se asume');
  assert.equal(SB.plan({},pn,['B0FAKE0003'],{marketplace:'US'}).results[0].action,'NUEVO');

  // 9 y 10. Plan: candidatos sin tocar el activo; existentes conservan su análisis; reimportar no duplica
  const activeState={product:{asin:'B0ACTIVE01',brand:'MIO'},eligibility:{status:'AUTORIZADO',source:'MANUAL',checkedAt:'2026-10-12T00:00:00Z'},costs:{checkout:{displayedUnit:9}}};
  const existing={asin:'B0FAKE0001',updatedAt:'x',inputs:{p_precio:'21',p_cogs:'7.5'},state:{product:{asin:'B0FAKE0001',brand:'Acme'},eligibility:{status:'REQUIERE APROBACIÓN',source:'MANUAL',checkedAt:'2026-10-01T00:00:00Z'},verification:{productMatch:{status:'MATCH CONFIRMADO'}},costs:{checkout:{displayedUnit:5}}}};
  const store={catalog:{B0FAKE0001:existing},active:activeState,inputs:{p_presu:'300'}};
  const before=clone(store),pl=SB.plan(store,parsed,['B0FAKE0001','B0FAKE0002','B0FAKE0003']);
  assert.deepEqual(store,before,'el plan es puro');assert.equal(pl.active,null,'el producto activo no se toca');
  assert.deepEqual(pl.results.map(r=>r.action).sort(),['EVIDENCIA ACTUALIZADA','NUEVO','NUEVO']);
  const kept=pl.catalog.B0FAKE0001;assert.deepEqual(kept.inputs,existing.inputs);assert.deepEqual(kept.state.costs,existing.state.costs);
  assert.deepEqual(kept.state.verification,existing.state.verification);assert.equal(kept.state.eligibility.status,'REQUIERE APROBACIÓN','eligibilidad manual se respeta');
  assert.equal(kept.state.scanner.exportedAt,r0.exportedAt);assert.equal(kept.state.fulfillment.status,'FBA_ELIGIBLE');
  const again=SB.plan({catalog:pl.catalog,active:activeState,inputs:{}},parsed,['B0FAKE0001','B0FAKE0002','B0FAKE0003']);
  assert(again.results.every(r=>r.action==='SIN CAMBIOS'));assert.equal(Object.keys(again.catalog).length,3);
  const onlyOne=SB.plan(store,parsed,['B0FAKE0002']);assert.deepEqual(Object.keys(onlyOne.catalog).sort(),['B0FAKE0001','B0FAKE0002']);
  const act=SB.plan({catalog:{},active:{product:{asin:'B0FAKE0003'},eligibility:{status:'AUTORIZADO',source:'MANUAL',checkedAt:'x'},costs:{a:1}},inputs:{}},parsed,['B0FAKE0003']);
  assert.equal(act.results[0].action,'EVIDENCIA ACTUALIZADA');assert.deepEqual(act.active.costs,{a:1});assert.equal(act.active.eligibility.source,'MANUAL');
  assert.equal(act.catalog.B0FAKE0003,undefined,'el activo vive en jev_v1, no se duplica en el catálogo');

  // 11. Falla de almacenamiento: nada queda a medias
  const ls=memLS({[CAT]:'{"prev":1}',[KEY]:'{"product":{"asin":"B0FAKE0003"}}'},(k)=>k===KEY);
  const res=SB.apply(ls,act.catalog?{...act,results:[{action:'NUEVO'}]}:act);
  assert.equal(res.ok,false);assert.match(res.error,/No se guardó nada/);assert.deepEqual(ls.dump(),{[CAT]:'{"prev":1}',[KEY]:'{"product":{"asin":"B0FAKE0003"}}'});
  const ls2=memLS({},()=>true);assert.equal(SB.apply(ls2,pl).ok,false);assert.deepEqual(ls2.dump(),{});

  // Contrato antiguo v1: legible, sin inventar frescura ni FBA
  const legacy=SB.parse(txt({schema:'amazon-sourcing-scanner-prospect-v1',prospect:{asin:'b0legacy01',upcEan:'012345678905',marketplace:'US',priceCurrent:24.99,eligibility:{status:'AUTORIZADO'}}}));
  assert.equal(legacy.kind,'legacy-v1');const lr=legacy.records[0];assert.equal(lr.ok,true);assert.equal(lr.data.fbaStatus,'NOT_VERIFIED');assert.equal(lr.expired,true);
  const lc=SB.newCandidate(lr.data,'legacy-v1','x',{},{},'US');assert.equal(lc.state.market.checkedAt,null);assert.equal(SB.fbaGate(lc.state,now).decision,'ESPERAR');
}

// ---------------------------------------------------------------- página completa
function initial(){
  const inputs={p_presu:'300',p_plan:'pro',p_unid:'2',p_precio:'29.99',p_ref:'15',p_fba:'4.10',p_cogs:'9',p_flete:'3'};
  const state={product:{asin:'B0ACTIVEC1',brand:'TEST-C',stage:'CANDIDATO'},eligibility:{status:'AUTORIZADO',source:'MANUAL',checkedAt:'2026-10-12T00:00:00.000Z'},market:{priceMinRecent:29.99},capital:{reserveTarget:50}};
  const op={id:'OP-C',kind:'COMPRA',status:'ABIERTA',product:{asin:'B0ACTIVEC1',brand:'TEST-C'},prediction:{units:2,investment:24,price:29.99,daysToCash:60,roi:.3,margin:.2},purchase:{units:2,investment:24},actual:{}};
  return {[KEY]:JSON.stringify(state),fba_v2:JSON.stringify(inputs),[OPS]:JSON.stringify([op]),[SB.ACCOUNT_KEY]:REF};
}
const all=w=>Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)]));
async function page(){
  const server=http.createServer((req,res)=>{try{const name=decodeURIComponent(req.url.split('?')[0]),file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root))throw 0;res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`,wins=[];
  async function mount(data){
    const errors=[],vc=new VirtualConsole();let nav=0;
    vc.on('jsdomError',e=>{if(/Not implemented: navigation/.test(e.message))nav++;else errors.push(String(e))});
    const dom=await JSDOM.fromURL(url,{resources:'usable',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){for(const [k,v]of Object.entries(data))w.localStorage.setItem(k,v);w.alert=()=>{};w.confirm=()=>true}});
    const w=dom.window;wins.push(w);await wait(1200);assert.deepEqual(errors,[]);assert.equal(w.MOTOR_SCORING_SELF_TEST.failed,0);
    return {w,errors,nav:()=>nav};
  }
  try{
    let {w,nav}=await mount(initial());
    assert(w.SCANNER_BRIDGE&&w.document.getElementById('data-tools'),'tarjeta de datos y puente cargados');
    assert.match(w.document.getElementById('data-scanner-import').textContent,/Importar prospectos del Scanner/);
    const host=w.document.getElementById('data-tools'),before=all(w);

    // 1 y 11. Vista previa con varios prospectos y un registro malicioso: no escribe nada, no ejecuta HTML
    const doc=fresh(REAL);doc.prospects[2].source='<img src=x onerror="window.__pwned=1">Walmart';doc.prospects[2].status_reason='=HYPERLINK("x")';
    const evil=clone(doc.prospects[0]);evil.asin='NOTANASIN!';doc.prospects.push(evil);doc.count=4;
    w.SCANNER_BRIDGE.readFile(new w.File([txt(doc)],'prospectos.json',{type:'application/json'}),w,host);await wait(150);
    const box=w.document.getElementById('sb-preview');assert(box,'vista previa');
    assert.equal(box.querySelectorAll('.sb-pick').length,3,'solo los válidos se pueden elegir');
    assert.match(box.textContent,/RECHAZADO/);assert.match(box.textContent,/todavía no se guardó nada/);
    assert.equal(box.querySelectorAll('img').length,0,'HTML del archivo no se interpreta');assert.equal(w.__pwned,undefined);
    assert.match(box.textContent,/00000000000031/,'GTIN con ceros visible');
    assert.deepEqual(all(w),before,'la vista previa no escribe nada');

    // Seleccionar 2 de 3 y confirmar: solo cambia el catálogo
    box.querySelector('.sb-pick[value="B0FAKE0002"]').checked=false;
    w.document.getElementById('sb-confirm').click();await wait(50);
    const after=all(w);
    for(const k of Object.keys(before))if(k!==CAT)assert.equal(after[k],before[k],'sin cambios en '+k);
    const prevCat=JSON.parse(before[CAT]||'{}'),cat=JSON.parse(after[CAT]);
    assert.deepEqual(Object.keys(cat).filter(k=>!(k in prevCat)).sort(),['B0FAKE0001','B0FAKE0003']);
    for(const k of Object.keys(prevCat))assert.deepEqual(cat[k],prevCat[k],'registro previo intacto: '+k);
    assert.equal(JSON.parse(after[KEY]).product.asin,'B0ACTIVEC1','el producto activo sigue siendo el mismo');
    assert.equal(nav(),0,'no recarga cuando no toca el activo');
    assert.match(box.querySelector('#sb-results').textContent,/2 nuevos/);

    // 10. Reimportar el mismo archivo: sin duplicados ni cambios
    const snap=all(w);w.SCANNER_BRIDGE.renderPreview(host,w.SCANNER_BRIDGE.parse(txt(doc)),w);
    w.document.querySelector('#sb-preview .sb-pick[value="B0FAKE0002"]').checked=false;
    assert.match(w.document.getElementById('sb-preview').textContent,/YA EN CATÁLOGO/);
    w.document.getElementById('sb-confirm').click();await wait(50);
    assert(all(w)[CAT]===snap[CAT],'reimportar no cambia el catálogo');assert.match(w.document.getElementById('sb-results').textContent,/2 sin cambios/);

    // Abrir uno en el Calculador: usa el cambio de ASIN existente (archiva C, carga el candidato)
    w.document.querySelector('.sb-open[data-asin="B0FAKE0003"]').click();await wait(50);assert.equal(nav(),1);
    const opened=all(w),cat2=JSON.parse(opened[CAT]);
    assert.equal(JSON.parse(opened[KEY]).product.asin,'B0FAKE0003');assert.equal(cat2.B0ACTIVEC1.inputs.p_precio,'29.99','el anterior queda archivado con su precio');assert.equal(cat2.B0ACTIVEC1.state.capital.reserveTarget,50);
    const inp=JSON.parse(opened.fba_v2);assert.equal(inp.p_precio,'16.99');assert.equal(inp.p_cogs,'');assert.equal(inp.p_presu,'300');
    assert.equal(opened[OPS],before[OPS],'operaciones intactas');
    w.close();

    // Recargar: evidencia visible y decisión conservadora
    ({w,nav}=await mount(opened));
    const ev=w.document.getElementById('sb-evidence');assert(ev,'tarjeta Dato Scanner');
    assert.match(ev.textContent,/FBA AUTORIZADO/);assert.match(ev.textContent,/Amazon Retail: NO VERIFICADO/);assert.match(ev.textContent,/estimado SP-API/);
    assert.equal(ev.querySelectorAll('img').length,0);
    const fin=w.MOTOR_SCORING_ENGINE.final;assert.notEqual(fin.decision,'COMPRAR PILOTO');assert.notEqual(fin.decision,'REPONER');
    assert.match(fin.reason,/match|Match|costo|Costo|incomplet|Falta/,'sin match manual ni costos no hay recomendación');
    w.close();

    // FBA restringido importado → DESCARTAR en el Motor Scoring
    const restricted=clone(JSON.parse(opened[KEY]));restricted.fulfillment.status='FBA_RESTRICTED';
    ({w}=await mount({...opened,[KEY]:JSON.stringify(restricted)}));
    assert.equal(w.MOTOR_SCORING_ENGINE.final.decision,'DESCARTAR');assert.match(w.MOTOR_SCORING_ENGINE.final.reason,/FBA no autorizado/);w.close();

    // FBA caducado → ESPERAR
    const stale=clone(JSON.parse(opened[KEY]));stale.fulfillment.validUntil=new Date(Date.now()-60e3).toISOString();
    ({w}=await mount({...opened,[KEY]:JSON.stringify(stale)}));
    assert.equal(w.MOTOR_SCORING_ENGINE.final.decision,'ESPERAR');assert.match(w.MOTOR_SCORING_ENGINE.final.reason,/caducó/);w.close();

    // Producto manual sin verificación FBA: ESPERAR (regla FBA obligatoria para todos)
    ({w}=await mount(initial()));assert.equal(w.document.getElementById('sb-evidence'),null);
    assert.equal(w.MOTOR_SCORING_ENGINE.final.decision,'ESPERAR');assert.match(w.MOTOR_SCORING_ENGINE.final.reason,/FBA/,'FBA obligatorio también para productos manuales');w.close();

    // Falla de cuota al importar: nada cambia
    ({w}=await mount(initial()));const h2=w.document.getElementById('data-tools'),b2=all(w);
    const realSet=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(k===CAT)throw new w.DOMException('full','QuotaExceededError');return realSet.call(this,k,v)};
    w.SCANNER_BRIDGE.renderPreview(h2,w.SCANNER_BRIDGE.parse(txt(fresh(REAL))),w);w.document.getElementById('sb-confirm').click();await wait(30);
    w.Storage.prototype.setItem=realSet;assert.deepEqual(all(w),b2);assert.match(w.document.getElementById('sb-results').textContent,/No se guardó nada/);w.close();
  }finally{wins.forEach(x=>{try{x.close()}catch{}});server.close()}
}

(async()=>{core();await page();
  console.log('PASS: real v2.3 export (3 prospects); GTIN zeros; listing/FBA separated; conservative price ≠ cost; fees USD→% tested; unknowns stay unknown; no fabricated dates; FBA gate (restricted/unverified/expired); preview without writes; select subset; only catalog written; active/operations/capital untouched; reimport without duplicates; manual analysis preserved; open via existing ASIN switch; XSS/formula-safe; invalid/huge/malformed files rejected; storage failure rollback; legacy v1 read safely.');
})().catch(e=>{console.error(e);process.exit(1)});
