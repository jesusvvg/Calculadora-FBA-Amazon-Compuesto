// Etapa 5 — integración Scanner → Calculador: candidatos en «Revisión económica».
// El fixture lo generó el EXPORTADOR REAL del Scanner (rama etapa5-revision-economica) con Amazon simulado:
// 1 prospecto (B0FAKE0001) + 2 en revisión económica (B0FAKE0002 piso de precio; B0FAKE0003 depende de la
// logística supuesta) + 1 inviable (B0FAKE0004) que el Scanner NO exporta. Datos 100 % ficticios.
'use strict';
const {JSDOM,VirtualConsole}=require('jsdom');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const SB=require('../scanner-bridge.js');
const root=path.resolve(__dirname,'..'),KEY='jev_v1',OPS='amazon_compuesto_operations_v1',CAT='motor_scoring_asin_v1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const clone=x=>JSON.parse(JSON.stringify(x));
const txt=x=>JSON.stringify(x);
const REAL=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','scanner-v23-export-econ-review.json'),'utf8'));
const REF=REAL.prospects[0].fba_verification.account_ref,MINE={trustedAccountRef:REF};   // huella registrada de TU cuenta

// Re-ancla las fechas del fixture a «ahora» (prospectos y candidatos, incluida la verificación FBA).
function fresh(doc,{hoursAgo=1,validHours=48}={}){
  const d=clone(doc),now=Date.now(),at=new Date(now-hoursAgo*3600e3).toISOString(),exp=new Date(now+validHours*3600e3).toISOString();
  d.exported_at=at;
  [...d.prospects,...(d.economic_review||[])].forEach(p=>{p.last_checked=at;p.expires_at=exp;if(p.amazon_fees)p.amazon_fees.fetched_at=at;
    if(p.fba_verification){p.fba_verification.checked_at=at;p.fba_verification.valid_until=new Date(Date.parse(at)+72*3600e3).toISOString()}});
  return d;
}
const rec=(parsed,asin)=>parsed.records.find(r=>r.asin===asin);

function core(){
  const now=Date.now(),doc=fresh(REAL),parsed=SB.parse(txt(doc));
  // 1. El archivo real trae las dos secciones; nada del inviable
  assert.equal(parsed.ok,true,parsed.error);
  assert.deepEqual([parsed.prospectCount,parsed.economicReviewCount],[1,2]);
  assert(parsed.records.every(r=>r.ok),JSON.stringify(parsed.records.map(r=>r.errors)));
  assert.equal(rec(parsed,'B0FAKE0004'),undefined,'un inviable del Scanner nunca llega');
  assert.match(parsed.economicReviewDisclaimer,/NO son prospectos ni autorización de compra/);

  // 2. La exportación de PROSPECTOS se conserva: el mismo registro con o sin la sección nueva
  const onlyProspects=clone(doc);delete onlyProspects.economic_review;delete onlyProspects.economic_review_count;delete onlyProspects.economic_review_limit;delete onlyProspects.economic_review_disclaimer;
  const legacy=SB.parse(txt(onlyProspects));
  assert.deepEqual(rec(legacy,'B0FAKE0001'),rec(parsed,'B0FAKE0001'));
  assert.equal(rec(parsed,'B0FAKE0001').candidateType,undefined);assert.equal(rec(parsed,'B0FAKE0001').data.candidateType,undefined);

  // 3. Candidatos secundarios: marcados, sin autorización y con motivos, faltantes y procedencia del archivo
  const a=rec(parsed,'B0FAKE0002'),c=rec(parsed,'B0FAKE0003'),srcA=doc.economic_review.find(p=>p.asin==='B0FAKE0002');
  for(const r of [a,c]){assert.equal(r.candidateType,'ECONOMIC_REVIEW');assert.equal(r.data.purchaseAuthorized,false);
    assert.match(r.warnings[0],/NO es autorización de compra/);}
  assert.deepEqual(a.data.economicReview.reasons,srcA.economic_review.reasons,'motivos originales intactos');
  assert.equal(a.data.statusReason,srcA.status_reason);
  assert(a.data.economicReview.flags.includes('ECONOMIC_FLOOR_WARNING'));
  assert(c.data.economicReview.flags.includes('LOGISTICS_DEPENDENT'));
  assert(c.data.economicReview.missingData.includes('LOGISTICS_COST_ASSUMED'));
  assert.deepEqual(a.data.economicReview.costBasis,{logistics:'ASSUMED',sourceTax:'ASSUMED',amazonFees:'SP_API_ESTIMATE'});
  assert.equal(c.data.netProfitEstimate,-1.14,'la ganancia preliminar negativa se conserva, no se maquilla');
  assert.equal(a.data.fbaVerification.method,'USER_DECLARED');

  // 4. Importar: candidato marcado, con la misma puerta FBA que cualquier producto
  const pl=SB.plan({catalog:{},active:{},inputs:{}},parsed,['B0FAKE0001','B0FAKE0002','B0FAKE0003'],{importedAt:'2026-10-24T00:00:00.000Z',...MINE});
  assert.match(pl.results.find(r=>r.asin==='B0FAKE0002').reason,/REVISIÓN ECONÓMICA \(no autoriza compra\)/);
  const st=pl.catalog.B0FAKE0002.state;
  assert.equal(st.scanner.candidateType,'ECONOMIC_REVIEW');assert.equal(st.scanner.purchaseAuthorized,false);
  assert.deepEqual(st.scanner.economicReview.reasons,srcA.economic_review.reasons);
  assert.equal(st.product.stage,'CANDIDATO','misma etapa del Motor Scoring: no se inventa una nueva');
  assert.equal(pl.catalog.B0FAKE0001.state.scanner.candidateType,'PROSPECT');assert.equal(pl.catalog.B0FAKE0001.state.scanner.economicReview,null);
  assert.equal(SB.fbaGate(st,now),null,'FBA vigente con procedencia: pasa la puerta (no es decisión de compra)');
  const noFba=SB.parse(txt((()=>{const d=fresh(REAL);delete d.economic_review[0].fba_verification;return d})()));
  const st2=SB.plan({catalog:{},active:{},inputs:{}},noFba,['B0FAKE0002'],MINE).catalog.B0FAKE0002.state;
  assert.equal(SB.fbaGate(st2,now).decision,'ESPERAR','sin procedencia FBA → ESPERAR');
  const restricted=clone(st);restricted.fulfillment.status='FBA_RESTRICTED';
  assert.equal(SB.fbaGate(restricted,now).decision,'DESCARTAR','restricción confirmada → DESCARTAR');

  // 5. Si un archivo posterior lo trae como PROSPECTO, la evidencia se actualiza (deja de ser secundario)
  const later=fresh(REAL,{hoursAgo:0.5});const promoted=clone(later.economic_review[0]);
  promoted.opportunity_status='PROSPECT';delete promoted.candidate_type;delete promoted.purchase_authorized;delete promoted.economic_review;
  later.prospects.push(promoted);later.count=2;later.economic_review=later.economic_review.slice(1);later.economic_review_count=1;
  const up=SB.plan({catalog:pl.catalog,active:{},inputs:{}},SB.parse(txt(later)),['B0FAKE0002'],MINE);
  assert.equal(up.results[0].action,'EVIDENCIA ACTUALIZADA');assert.equal(up.catalog.B0FAKE0002.state.scanner.candidateType,'PROSPECT');

  // 6. Manipulaciones: nunca un secundario como autorización ni mezclado con prospectos
  const tamper=f=>{const d=fresh(REAL);f(d);return SB.parse(txt(d))};
  assert.equal(rec(tamper(d=>{d.economic_review[0].purchase_authorized=true}),'B0FAKE0002').ok,false);
  assert.equal(rec(tamper(d=>{delete d.economic_review[0].purchase_authorized}),'B0FAKE0002').ok,false);
  assert.equal(rec(tamper(d=>{d.economic_review[0].candidate_type='PROSPECT'}),'B0FAKE0002').ok,false);
  assert.equal(rec(tamper(d=>{d.economic_review[0].opportunity_status='PROSPECT'}),'B0FAKE0002').ok,false);
  assert.equal(rec(tamper(d=>{d.economic_review[0].economic_review.reasons=[]}),'B0FAKE0002').ok,false,'sin motivos no entra');
  const mixed=tamper(d=>{d.prospects.push(clone(d.economic_review[0]));d.count=2});
  assert.equal(mixed.records.filter(r=>r.asin==='B0FAKE0002'&&!r.ok).length>=1,true,'un secundario dentro de «prospects» se rechaza');
  const discard=tamper(d=>{const x=clone(d.prospects[0]);x.asin='B0FAKE0009';x.opportunity_status='DISCARD';d.prospects.push(x);d.count=2});
  assert.equal(rec(discard,'B0FAKE0009').ok,false,'un descarte nunca entra como prospecto');
  const dup=tamper(d=>{const x=clone(d.economic_review[0]);x.asin='B0FAKE0001';d.economic_review.push(x);d.economic_review_count=3});
  assert(dup.records.some(r=>r.asin==='B0FAKE0001'&&r.duplicate),'el mismo ASIN en ambas secciones: manda el prospecto');
  // Límite de candidatos secundarios
  assert.equal(tamper(d=>{d.economic_review_count=5}).ok,false);
  assert.equal(tamper(d=>{d.economic_review_limit=1}).ok,false,'más candidatos que el límite del Scanner');
  assert.equal(tamper(d=>{d.economic_review=Array.from({length:51},(_,i)=>{const x=clone(d.economic_review[0]);x.asin='B0LIM'+String(i).padStart(5,'0');return x});d.economic_review_count=51;d.economic_review_limit=51}).ok,false,'tope duro del Calculador');
  assert.equal(tamper(d=>{d.economic_review='x'}).ok,false);

  // 7. Prioridad de bloqueos (revisión PR #4): alertas económicas + restricción definitiva → nunca candidato
  const blocked=[['fulfillment_eligibility','FBA_RESTRICTED'],['fulfillment_eligibility','HAZMAT_REVIEW'],['fulfillment_eligibility','NOT_VERIFIED'],
    ['listing_eligibility','NOT_AUTHORIZED'],['listing_eligibility','REQUIRES_APPROVAL'],['listing_eligibility','NOT_VERIFIED']];
  for(const [k,v] of blocked){
    const r=rec(tamper(d=>{d.economic_review[0][k]=v}),'B0FAKE0002');
    assert.equal(r.ok,false,k+'='+v+' con alertas económicas debe rechazarse');
    assert(r.data===null&&r.errors.some(e=>/sin (FBA|permiso para publicar) AUTORIZADO/.test(e)),k+'='+v);
    assert.equal(SB.plan({catalog:{},active:{},inputs:{}},tamper(d=>{d.economic_review[0][k]=v}),['B0FAKE0002'],MINE).results[0].action,'RECHAZADO');
  }
  // Con varias banderas económicas a la vez, la restricción sigue mandando
  const combo=rec(tamper(d=>{const x=d.economic_review[0];x.risk_flags.push('LOGISTICS_DEPENDENT','ECONOMIC_FLOOR_WARNING');x.fulfillment_eligibility='FBA_RESTRICTED'}),'B0FAKE0002');
  assert.equal(combo.ok,false);

  // 8. Importaciones sucesivas (revisión PR #4): verificaciones manuales y datos históricos intactos
  const H=3600e3,iso=t=>new Date(t).toISOString();
  const manual=(o={})=>({status:'FBA_ELIGIBLE',label:'FBA AUTORIZADO',asin:'B0FAKE0002',marketplace:'US',condition:'NEW',channel:'FBA',source:'MANUAL',
    checkedAt:iso(now-0.05*H),evidenceAt:iso(now-0.05*H),validUntil:iso(now+71*H),note:'Seller Central: revisado a mano',...o});
  // Estado con análisis manual, costos, capital y compra registrada: nada de esto puede cambiar
  const userState=()=>({product:{asin:'B0FAKE0002',marketplace:'US',condition:'NEW',stage:'CANDIDATO'},costs:{checkout:{displayedUnit:3,taxUnit:.21},prep:{prepUnit:1.1}},
    capital:{reserveTarget:50},purchase:{units:3,investment:12.5},verification:{match:'OK'},market:{priceMinRecent:13.99,source:'MANUAL'},
    eligibility:{status:'AUTORIZADO',source:'MANUAL',checkedAt:iso(now-0.5*H)},fulfillment:manual()});
  const asEcon=fresh(REAL),asProspect=(()=>{const d=fresh(REAL,{hoursAgo:0.1});const x=clone(d.economic_review[0]);
    x.opportunity_status='PROSPECT';delete x.candidate_type;delete x.purchase_authorized;delete x.economic_review;
    d.prospects.push(x);d.count=2;d.economic_review=d.economic_review.slice(1);d.economic_review_count=1;return d})();
  const protectedKeys=st=>{const c=clone(st);delete c.scanner;delete c.fulfillment;delete c.eligibility;return c};
  for(const [label,seq] of [['REVISIÓN→PROSPECTO',[asEcon,asProspect]],['PROSPECTO→REVISIÓN',[asProspect,asEcon]]]){
    // (a) en el catálogo  (b) como producto activo
    let cat={B0FAKE0002:{asin:'B0FAKE0002',updatedAt:'x',state:userState(),inputs:{p_cogs:'3',p_unid:'3'},origin:'MANUAL'},B0OTRO0001:{asin:'B0OTRO0001',state:{x:1},inputs:{y:2}}};
    let act=userState();act.product.asin='B0FAKE0002';
    const cat0=clone(cat),act0=clone(act);
    for(const d of seq){
      const pc=SB.plan({catalog:cat,active:{},inputs:{}},SB.parse(txt(d)),['B0FAKE0002'],MINE);cat=pc.catalog;
      const pa=SB.plan({catalog:{},active:act,inputs:{}},SB.parse(txt(d)),['B0FAKE0002'],MINE);act=pa.active||act;
      assert.equal('operations' in pc||'operations' in pa,false,'el plan nunca toca operaciones');
    }
    assert.deepEqual(cat.B0FAKE0002.state.fulfillment,cat0.B0FAKE0002.state.fulfillment,label+': la verificación manual más reciente se conserva (catálogo)');
    assert.deepEqual(act.fulfillment,act0.fulfillment,label+': la verificación manual más reciente se conserva (activo)');
    assert.deepEqual(cat.B0FAKE0002.state.eligibility,cat0.B0FAKE0002.state.eligibility,label+': permiso manual intacto');
    assert.deepEqual(protectedKeys(cat.B0FAKE0002.state),protectedKeys(cat0.B0FAKE0002.state),label+': análisis, costos, capital y compra intactos');
    assert.deepEqual(protectedKeys(act),protectedKeys(act0),label+': producto activo intacto salvo la evidencia');
    assert.deepEqual(cat.B0FAKE0002.inputs,cat0.B0FAKE0002.inputs);assert.deepEqual(cat.B0OTRO0001,cat0.B0OTRO0001,'otros productos intactos');
    assert.equal(cat.B0FAKE0002.state.scanner.candidateType,seq[1]===asProspect?'PROSPECT':'ECONOMIC_REVIEW',label+': la evidencia sí se actualiza');
  }
  // Una verificación manual MÁS ANTIGUA solo la reemplaza una del Scanner completa, de tu cuenta y más reciente
  const older=()=>({catalog:{B0FAKE0002:{asin:'B0FAKE0002',state:{...userState(),fulfillment:manual({checkedAt:iso(now-30*H),validUntil:iso(now+42*H)})},inputs:{}}},active:{},inputs:{}});
  const after=(d,o)=>SB.plan(older(),SB.parse(txt(d)),['B0FAKE0002'],o).catalog.B0FAKE0002.state.fulfillment;
  assert.equal(after(asEcon,MINE).source,'SCANNER','completa, propia y más reciente → reemplaza');
  assert.equal(after(asEcon,{}).source,'MANUAL','sin huella registrada → no pisa la manual');
  assert.equal(after(asEcon,{trustedAccountRef:'0123456789ab'}).source,'MANUAL','de otra cuenta → no pisa la manual');
  const noProv=fresh(REAL);delete noProv.economic_review[0].fba_verification;
  assert.equal(after(noProv,MINE).source,'MANUAL','sin procedencia → no pisa la manual');
  // Una restricción manual reciente nunca se convierte en autorización por una importación
  const restrictedManual={catalog:{B0FAKE0002:{asin:'B0FAKE0002',state:{...userState(),fulfillment:manual({status:'FBA_RESTRICTED',label:'FBA NO AUTORIZADO'})},inputs:{}}},active:{},inputs:{}};
  for(const d of [asEcon,asProspect]){
    const st=SB.plan(clone(restrictedManual),SB.parse(txt(d)),['B0FAKE0002'],MINE).catalog.B0FAKE0002.state;
    assert.equal(st.fulfillment.status,'FBA_RESTRICTED');assert.equal(SB.fbaGate(st,now).decision,'DESCARTAR');
  }
}

// ---------------------------------------------------------------- página completa (jsdom)
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
    const w=dom.window;wins.push(w);await wait(1200);assert.deepEqual(errors,[]);assert.equal(w.MOTOR_SCORING_SELF_TEST.failed,0,'autopruebas del Motor Scoring intactas');
    return {w,nav:()=>nav};
  }
  try{
    // Sin huella registrada: la vista previa lo avisa y permite registrarla (no importa nada)
    {const data=initial();delete data[SB.ACCOUNT_KEY];const {w}=await mount(data),h=w.document.getElementById('data-tools'),b=all(w);
      w.SCANNER_BRIDGE.renderPreview(h,w.SCANNER_BRIDGE.parse(txt(fresh(REAL))),w);
      assert.match(w.document.getElementById('sb-preview').textContent,/registra la huella de tu cuenta/);assert.match(w.document.getElementById('sb-preview').textContent,/HUELLA DE CUENTA NO REGISTRADA/);
      w.document.getElementById('sb-account').value='no-valida';w.document.getElementById('sb-account-save').click();assert.deepEqual(all(w),b,'huella inválida no se guarda');
      w.document.getElementById('sb-account').value=REF.toUpperCase();w.document.getElementById('sb-account-save').click();
      assert.equal(w.localStorage.getItem(SB.ACCOUNT_KEY),REF);assert.equal(w.document.getElementById('sb-account'),null,'ya registrada');
      const a2=all(w);delete a2[SB.ACCOUNT_KEY];assert.deepEqual(a2,b,'registrar la huella no cambia nada más');w.close();}
    let {w,nav}=await mount(initial());
    const host=w.document.getElementById('data-tools'),before=all(w),doc=fresh(REAL);
    w.SCANNER_BRIDGE.readFile(new w.File([txt(doc)],'prospectos.json',{type:'application/json'}),w,host);await wait(150);
    const box=w.document.getElementById('sb-preview');
    assert.match(box.textContent,/1 prospectos · 2 en revisión económica/);
    assert.match(box.textContent,/REVISIÓN ECONÓMICA · no autoriza compra/);assert.match(box.textContent,/no son autorización de compra/);
    assert.equal(box.querySelector('.sb-pick[value="B0FAKE0001"]').checked,true,'el prospecto viene marcado como siempre');
    assert.equal(box.querySelector('.sb-pick[value="B0FAKE0002"]').checked,false,'el secundario se elige a propósito');
    assert.equal(box.querySelector('.sb-pick[value="B0FAKE0003"]').checked,false);
    assert.deepEqual(all(w),before,'la vista previa no escribe nada');

    // Confirmar sin tocar nada: solo entra el prospecto
    w.document.getElementById('sb-confirm').click();await wait(50);
    const prevCat=JSON.parse(before[CAT]||'{}');
    assert.deepEqual(Object.keys(JSON.parse(all(w)[CAT])).filter(k=>!(k in prevCat)).sort(),['B0FAKE0001']);
    // Elegir un candidato en revisión económica y confirmarlo
    w.SCANNER_BRIDGE.renderPreview(host,w.SCANNER_BRIDGE.parse(txt(doc)),w);
    w.document.querySelector('#sb-preview .sb-pick[value="B0FAKE0002"]').checked=true;
    w.document.getElementById('sb-confirm').click();await wait(50);
    assert.match(w.document.getElementById('sb-results').textContent,/REVISIÓN ECONÓMICA \(no autoriza compra\)/);
    const after=all(w);for(const k of Object.keys(before))if(k!==CAT)assert.equal(after[k],before[k],'sin cambios en '+k);
    assert.equal(after[OPS],before[OPS],'operaciones históricas intactas');

    // Abrirlo en el Calculador y recargar: evidencia marcada y SIN recomendación de compra
    w.document.querySelector('.sb-open[data-asin="B0FAKE0002"]').click();await wait(50);assert.equal(nav(),1);
    const opened=all(w);assert.equal(JSON.parse(opened[KEY]).product.asin,'B0FAKE0002');assert.equal(opened[OPS],before[OPS]);
    assert.deepEqual(JSON.parse(opened[KEY]).capital,JSON.parse(before[KEY]).capital,'la reserva de capital no cambia al importar');
    w.close();
    ({w}=await mount(opened));
    const ev=w.document.getElementById('sb-evidence');assert(ev,'tarjeta Dato Scanner');
    assert.match(ev.textContent,/REVISIÓN ECONÓMICA · no es autorización de compra/);
    assert.match(ev.textContent,/Revisión económica: Precio Amazon/);assert.match(ev.textContent,/Datos faltantes: .*LOGISTICS_COST_ASSUMED/);
    const fin=w.MOTOR_SCORING_ENGINE.final;
    assert(!['COMPRAR PILOTO','REPONER','ESCALAR'].includes(fin.decision),'importar un secundario nunca produce una compra: '+fin.decision);
    w.close();
    // Con FBA restringido (restricción confirmada) el Motor Scoring lo descarta
    const restricted=clone(JSON.parse(opened[KEY]));restricted.fulfillment.status='FBA_RESTRICTED';
    ({w}=await mount({...opened,[KEY]:JSON.stringify(restricted)}));
    assert.equal(w.MOTOR_SCORING_ENGINE.final.decision,'DESCARTAR');w.close();
  }finally{wins.forEach(x=>{try{x.close()}catch{}});server.close()}
}

(async()=>{core();await page();
  console.log('PASS: Scanner→Calculator economic review (real exporter fixture): account ref must match the registered one; restrictions beat economic alerts; successive imports keep newer manual verifications, analysis, capital, purchases and operations; prospects export unchanged; secondary candidates separate, unchecked, never purchase authorization; original reasons, missing data and cost provenance kept; inviable never arrives; same FBA gate (provenance/restricted); promotion to PROSPECT on re-export; tampering, mixing, duplicates and limits rejected; operations/capital/Motor Scoring untouched.');
})().catch(e=>{console.error(e);process.exit(1)});
