(function(){
"use strict";
var KEY="amazon_compuesto_operations_v1",SELECTED_KEY="amazon_compuesto_selected_purchase_v1";

function load(){try{var x=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(x)?x:[]}catch(e){return []}}
function save(x){try{localStorage.setItem(KEY,JSON.stringify(x))}catch(e){}}
function esc(x){return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function money(x){return x==null||!isFinite(x)?"—":"$"+Number(x).toFixed(2)}
function num(x){var n=Number(x);return isFinite(n)?n:null}
function delta(actual,pred){return actual==null||pred==null?null:actual-pred}
function pct(x){return x==null||!isFinite(x)?"—":(Number(x)*100).toFixed(1)+"%"}

function readJevState(){try{var s=JSON.parse(localStorage.getItem("jev_v1")||"{}");return s&&typeof s==="object"?s:{}}catch(e){return {}}}
function domNumber(id){var el=document.getElementById(id);if(!el||el.value==="")return null;var n=Number(el.value);return isFinite(n)?n:null}
function domValue(id){var el=document.getElementById(id);return el?el.value:""}

function captureCostModel(){
 var s=readJevState(),costs=s.costs||{},checkout=costs.checkout||{},prep=costs.prep||{};
 var currency=domValue("p_moneda")||"USD";
 var rate=currency==="USD"?1:domNumber("p_tc");
 if(rate==null||rate<=0)rate=null;
 return {
  currency:currency,
  rate:rate,
  displayedUnit:checkout.displayedUnit==null?null:Number(checkout.displayedUnit),
  discountUnit:checkout.discountUnit==null?0:Number(checkout.discountUnit),
  taxUnit:checkout.taxUnit==null?null:Number(checkout.taxUnit),
  supplierToPrepLot:checkout.supplierToPrepLot==null?null:Number(checkout.supplierToPrepLot),
  prepUnit:prep.prepUnit==null?null:Number(prep.prepUnit),
  otherPrepLot:prep.otherPrepLot==null?0:Number(prep.otherPrepLot),
  prepToAmazonLot:prep.prepToAmazonLot==null?null:Number(prep.prepToAmazonLot)
 };
}

function costBreakdown(model,units){
 units=Number(units);
 if(!model||!isFinite(units)||units<1)return null;
 var rate=Number(model.rate);
 if(!isFinite(rate)||rate<=0)return null;
 var displayed=Number(model.displayedUnit),discount=Number(model.discountUnit||0),tax=Number(model.taxUnit);
 var supplier=Number(model.supplierToPrepLot),prepUnit=Number(model.prepUnit),other=Number(model.otherPrepLot||0),prepAmazon=Number(model.prepToAmazonLot);
 if(!isFinite(displayed)||!isFinite(discount)||!isFinite(tax)||!isFinite(supplier)||!isFinite(prepUnit)||!isFinite(other)||!isFinite(prepAmazon))return null;
 var checkoutPurchase=Math.max(0,displayed-discount+tax);
 var productUnitUSD=checkoutPurchase/rate;
 var supplierUSD=supplier/rate;
 var productTotal=productUnitUSD*units;
 var prepUnitTotal=prepUnit*units;
 var fixedLotTotal=supplierUSD+other+prepAmazon;
 var total=productTotal+prepUnitTotal+fixedLotTotal;
 return {
  units:units,
  productUnitUSD:productUnitUSD,
  productTotal:productTotal,
  prepUnit:prepUnit,
  prepUnitTotal:prepUnitTotal,
  supplierToPrepLotUSD:supplierUSD,
  otherPrepLot:other,
  prepToAmazonLot:prepAmazon,
  fixedLotTotal:fixedLotTotal,
  total:total
 };
}

function snapshot(kind){
 var e=window.MOTOR_SCORING_ENGINE;if(!e)return null;
 var s=readJevState();
 var p=s.product||{},f=e.financial||{},c=e.capital||{},d=e.final||{},r=window.MOTOR_SCORING_PHASE5&&window.MOTOR_SCORING_PHASE5.rotation,k=window.MOTOR_SCORING_PHASE5&&window.MOTOR_SCORING_PHASE5.risk,mk=window.MOTOR_SCORING_MARKET&&window.MOTOR_SCORING_MARKET.result;
 kind=kind==="COMPRA"?"COMPRA":"ANALISIS";
 return {
  id:"OP-"+Date.now(),
  createdAt:new Date().toISOString(),
  kind:kind,
  status:kind==="COMPRA"?"PENDIENTE_COMPRA":"ANALISIS",
  product:{asin:p.asin||"",upcEan:p.upcEan||"",brand:p.brand||"",marketplace:p.marketplace||""},
  prediction:{
   units:d.pilotUnits||c.pilotUnits||null,
   investment:d.pilotCapital||c.pilotCapital||null,
   roi:f.roi,
   margin:f.margin,
   price:Number(document.getElementById("p_precio")&&document.getElementById("p_precio").value)||null,
   daysToCash:r&&r.dtc!=null?r.dtc:null,
   financialScore:f.score,
   rotationScore:r&&r.score!=null?r.score:null,
   marketScore:mk&&mk.score!=null?mk.score:null,
   riskScore:k&&k.score!=null?k.score:null,
   capitalEfficiency:c.score,
   dataConfidence:e.confidence&&e.confidence.score,
   decision:d.decision,
   score:d.score,
   costModel:captureCostModel()
  },
  purchase:null,
  actual:{unitsSold:null,price:null,roi:null,margin:null,returns:null,daysToCash:null,profit:null}
 };
}

function styles(){
 if(document.getElementById("ops-style"))return;
 var x=document.createElement("style");x.id="ops-style";
 x.textContent=".ops-box{margin:14px 0;padding:14px;border:1px solid var(--line);background:#fff}.ops-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.ops-actions{display:flex;gap:8px;flex-wrap:wrap}.ops-btn{padding:9px 12px;border:1px solid var(--deep);background:#fff;cursor:pointer;font-weight:700}.ops-btn:disabled{opacity:.45;cursor:not-allowed}.ops-row{border-top:1px solid var(--line);padding:10px 0;font-size:12px;line-height:1.5}.ops-row .ops-actions{margin-top:9px}.ops-muted{color:var(--muted);font-size:11px}.ops-empty{color:var(--muted);padding-top:8px}.ops-close{margin-top:10px;padding:12px;border:1px solid var(--line);background:#fafafa}.ops-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}.ops-grid label{font-size:11px;color:var(--muted)}.ops-grid input{width:100%;box-sizing:border-box;padding:8px;margin-top:4px;border:1px solid var(--line);background:#fff;color:var(--ink)}.ops-override{display:block;clear:both;margin:8px 0 10px;padding:8px 10px;border-left:3px solid var(--warn);background:var(--warnBg);font-size:11px;line-height:1.45}.ops-costs{margin:10px 0;padding:10px;border:1px solid var(--line);background:#fff;font-size:11px;line-height:1.55}.ops-costs-row{display:flex;justify-content:space-between;gap:12px}.ops-costs-total{margin-top:6px;padding-top:6px;border-top:1px solid var(--line);font-weight:700}.ops-danger{border-color:var(--bad);color:var(--bad)}@media(max-width:620px){.ops-head{align-items:flex-start;flex-direction:column}.ops-grid{grid-template-columns:1fr}}";
 document.head.appendChild(x)
}

function overrideFor(q,units){var rec=q&&q.units!=null?Number(q.units):null;return {recommended:rec,isOverride:rec!=null&&units>rec}}

function projectedInvestment(q,units){
 var b=costBreakdown(q&&q.costModel,units);
 if(b)return b.total;
 var recUnits=q&&q.units!=null?Number(q.units):null,recInvestment=q&&q.investment!=null?Number(q.investment):null;
 if(recUnits==null||recUnits<=0||recInvestment==null||units==null||units<1)return recInvestment;
 return recInvestment/recUnits*units;
}

function costBreakdownHtml(q,units){
 var b=costBreakdown(q&&q.costModel,units);
 if(!b)return '<div class="ops-muted">Desglose no disponible para este registro anterior; se usa el cálculo compatible previo.</div>';
 return '<div class="ops-costs">'+
  '<div class="ops-muted"><b>Desglose de capital antes de vender</b> · “por unidad” se multiplica; “por lote” se suma una sola vez.</div>'+
  '<div class="ops-costs-row"><span>Producto / checkout</span><span>'+esc(Math.round(b.units))+' × '+money(b.productUnitUSD)+' = '+money(b.productTotal)+'</span></div>'+
  '<div class="ops-costs-row"><span>Prep Center por unidad</span><span>'+esc(Math.round(b.units))+' × '+money(b.prepUnit)+' = '+money(b.prepUnitTotal)+'</span></div>'+
  '<div class="ops-costs-row"><span>Flete proveedor → Prep · lote</span><span>'+money(b.supplierToPrepLotUSD)+'</span></div>'+
  '<div class="ops-costs-row"><span>Otros costos Prep · lote</span><span>'+money(b.otherPrepLot)+'</span></div>'+
  '<div class="ops-costs-row"><span>Flete Prep → Amazon · lote</span><span>'+money(b.prepToAmazonLot)+'</span></div>'+
  '<div class="ops-costs-row ops-costs-total"><span>Capital total comprometido</span><span>'+money(b.total)+'</span></div>'+
 '</div>';
}

function previewPurchase(q,units,investment){
 var b=costBreakdown(q.costModel,units);
 if(b&&units>0&&isFinite(investment)&&investment>=0){
  window.AMAZON_PURCHASE_PREVIEW={units:units,checkout:b.productUnitUSD,supplier:b.supplierToPrepLotUSD,prepUnit:b.prepUnit,other:b.otherPrepLot,prepAmazon:b.prepToAmazonLot,fixedLot:b.fixedLotTotal,total:investment,landed:investment/units};
 }else window.AMAZON_PURCHASE_PREVIEW=null;
 if(window.JEV_FINANCIAL_SYNC)window.JEV_FINANCIAL_SYNC.sync();
}
function purchaseEstimate(units,investment){var e=window.MOTOR_SCORING_ENGINE,f=e&&e.evaluatePurchaseFinancial&&e.evaluatePurchaseFinancial(units,investment);return f&&f.complete?{netUnit:f.net,netTotal:f.net*units,margin:f.margin,roi:f.roi,breakEven:f.breakEven}:null}
function clearPurchasePreview(){window.AMAZON_PURCHASE_PREVIEW=null;if(window.JEV_FINANCIAL_SYNC)window.JEV_FINANCIAL_SYNC.sync()}

function copy(x){return x==null?null:JSON.parse(JSON.stringify(x))}
function selected(){try{return JSON.parse(localStorage.getItem(SELECTED_KEY)||"null")}catch(e){return null}}
function freezePreview(id){
 var b=window.AMAZON_PURCHASE_PREVIEW,e=window.MOTOR_SCORING_ENGINE;if(!b||!e||!e.evaluatePurchaseFinancial)return null;
 var f=e.evaluatePurchaseFinancial(b.units,b.total);if(!f||!f.complete)return null;
 var x=copy(b);x.operationId=id;x.financial=copy(f);x.budget=domNumber("p_presu");x.inputs={};
 ["p_precio","p_ref","p_fba","p_almac","c_venta","p_ppc"].forEach(function(k){x.inputs[k]=domNumber(k)});
 return x;
}
function selectPurchase(o,summary){
 if(!o||o.status!=="ABIERTA"||!o.purchase)return;
 if(!summary)summary=o.purchase.summary;
 if(!summary){previewPurchase(o.prediction||{},o.purchase.units,o.purchase.investment);summary=freezePreview(o.id)}
 if(!summary){alert("Faltan datos para mostrar el resumen de esta compra. Revisa su edición y el análisis.");return}
 var x={id:o.id,summary:copy(summary)};try{localStorage.setItem(SELECTED_KEY,JSON.stringify(x))}catch(e){}
 window.AMAZON_PURCHASE_PREVIEW=copy(x.summary);if(window.JEV_FINANCIAL_SYNC)window.JEV_FINANCIAL_SYNC.sync();
}
function restoreSelected(){
 var x=selected();if(!x)return;
 var o=load().filter(function(o){return o.id===x.id&&o.status==="ABIERTA"&&o.purchase})[0];
 if(!o||!x.summary||!x.summary.financial||!x.summary.financial.complete){forgetSelected();return}
 window.AMAZON_PURCHASE_PREVIEW=copy(x.summary);if(window.JEV_FINANCIAL_SYNC)window.JEV_FINANCIAL_SYNC.sync();
}
function forgetSelected(){try{localStorage.removeItem(SELECTED_KEY)}catch(e){}clearPurchasePreview()}
function cancelPreview(){clearPurchasePreview();restoreSelected()}

function purchaseForm(o){
 var q=o.prediction||{},host=document.getElementById("ops-editor");if(!host)return;
 var initial=projectedInvestment(q,q.units);
 host.innerHTML='<div class="ops-close"><b>Registrar compra '+esc(o.id)+'</b><div class="ops-muted">La recomendación JEV queda congelada como predicción. La inversión se recalcula separando costos por unidad y costos por lote.</div><div class="ops-grid"><label>Unidades compradas<input id="op-buy-units" type="number" min="1" step="1" value="'+esc(q.units==null?"":q.units)+'"></label><label>Inversión real US$<input id="op-buy-investment" type="number" min="0" step="0.01" value="'+esc(initial==null?"":Number(initial).toFixed(2))+'"></label></div><div id="op-buy-breakdown"></div><div id="op-buy-warning"></div><button id="op-buy-confirm" class="ops-btn">Confirmar compra</button> <button id="op-buy-cancel" class="ops-btn">Cancelar</button></div>';
 function refreshPurchase(){
  var units=num(document.getElementById("op-buy-units").value),w=document.getElementById("op-buy-warning"),inv=document.getElementById("op-buy-investment"),bd=document.getElementById("op-buy-breakdown");
  if(inv&&units!=null&&units>=1){var projected=projectedInvestment(q,units);if(projected!=null&&isFinite(projected))inv.value=Number(projected).toFixed(2)}
  if(bd)bd.innerHTML=costBreakdownHtml(q,units);
  previewPurchase(q,units,inv&&inv.value!==""?Number(inv.value):NaN);
  if(!w)return;
  var z=overrideFor(q,units);
  w.innerHTML=(z.isOverride)?'<div class="ops-override"><b>Override:</b> JEV recomendó máximo '+esc(z.recommended)+' unidad'+(z.recommended===1?'':'es')+' y estás registrando '+esc(Math.round(units))+'. Si confirmas, la operación quedará marcada como override manual.</div>':''
 }
 var investmentInput=document.getElementById("op-buy-investment");if(investmentInput)investmentInput.addEventListener("input",function(){previewPurchase(q,num(document.getElementById("op-buy-units").value),this.value!==""?Number(this.value):NaN)});
 var ui=document.getElementById("op-buy-units");if(ui)ui.addEventListener("input",refreshPurchase);refreshPurchase();
 document.getElementById("op-buy-cancel").onclick=function(){host.innerHTML="";cancelPreview()};
 document.getElementById("op-buy-confirm").onclick=function(){
  var units=num(document.getElementById("op-buy-units").value),investment=num(document.getElementById("op-buy-investment").value);
  if(units==null||units<1||investment==null||investment<0){alert("Completa unidades e inversión real de la compra.");return}
  units=Math.round(units);var z=overrideFor(q,units),breakdown=costBreakdown(q.costModel,units);
  if(z.isOverride&&!confirm("JEV recomendó máximo "+z.recommended+" unidad"+(z.recommended===1?"":"es")+" y estás registrando "+units+". Esto excede la recomendación del motor. ¿Confirmas el override manual?"))return;
  o.purchase={units:units,investment:investment,estimate:purchaseEstimate(units,investment),costBreakdown:breakdown,registeredAt:new Date().toISOString(),override:z.isOverride?{manual:true,type:"UNIDADES_SOBRE_RECOMENDACION",recommendedUnits:z.recommended,actualUnits:units,confirmedAt:new Date().toISOString()}:null,editHistory:[]};
  o.status="ABIERTA";o.purchase.summary=freezePreview(o.id);var ops=load();ops.push(o);save(ops);selectPurchase(o,o.purchase.summary);render(true,true)
 };
}

function editPurchaseForm(id){
 var ops=load(),o=ops.filter(function(x){return x.id===id})[0];if(!o||o.status!=="ABIERTA"||!o.purchase)return;
 var q=o.prediction||{},buy=o.purchase,host=document.getElementById("ops-editor");if(!host)return;
 host.innerHTML='<div class="ops-close"><b>Editar compra '+esc(id)+'</b><div class="ops-muted">La predicción de JEV no cambia. Solo corriges la compra real registrada.</div><div class="ops-grid"><label>Unidades compradas<input id="op-edit-units" type="number" min="1" step="1" value="'+esc(buy.units)+'"></label><label>Inversión real US$<input id="op-edit-investment" type="number" min="0" step="0.01" value="'+esc(Number(buy.investment).toFixed(2))+'"></label></div><div id="op-edit-breakdown"></div><div id="op-edit-warning"></div><button id="op-edit-confirm" class="ops-btn">Guardar cambios</button> <button id="op-edit-cancel" class="ops-btn">Cancelar</button></div>';
 function refreshEdit(recalculate){
  var units=num(document.getElementById("op-edit-units").value),w=document.getElementById("op-edit-warning"),inv=document.getElementById("op-edit-investment"),bd=document.getElementById("op-edit-breakdown");
  if(recalculate!==false&&inv&&units!=null&&units>=1){var projected=projectedInvestment(q,units);if(projected!=null&&isFinite(projected))inv.value=Number(projected).toFixed(2)}
  if(bd)bd.innerHTML=costBreakdownHtml(q,units);
  previewPurchase(q,units,inv&&inv.value!==""?Number(inv.value):NaN);
  if(!w)return;
  var z=overrideFor(q,units);
  w.innerHTML=z.isOverride?'<div class="ops-override"><b>Override:</b> JEV recomendó máximo '+esc(z.recommended)+' unidad'+(z.recommended===1?'':'es')+' y estás editando la compra a '+esc(Math.round(units))+'.</div>':''
 }
 var investmentInput=document.getElementById("op-edit-investment");if(investmentInput)investmentInput.addEventListener("input",function(){previewPurchase(q,num(document.getElementById("op-edit-units").value),this.value!==""?Number(this.value):NaN)});
 var ui=document.getElementById("op-edit-units");if(ui)ui.addEventListener("input",refreshEdit);refreshEdit(false);
 document.getElementById("op-edit-cancel").onclick=function(){host.innerHTML="";cancelPreview()};
 document.getElementById("op-edit-confirm").onclick=function(){
  var units=num(document.getElementById("op-edit-units").value),investment=num(document.getElementById("op-edit-investment").value);
  if(units==null||units<1||investment==null||investment<0){alert("Completa unidades e inversión real.");return}
  units=Math.round(units);var z=overrideFor(q,units);
  if(z.isOverride&&!confirm("JEV recomendó máximo "+z.recommended+" unidad"+(z.recommended===1?"":"es")+" y estás dejando la compra en "+units+". ¿Confirmas el override manual?"))return;
  var old={units:buy.units,investment:buy.investment,costBreakdown:buy.costBreakdown||null,override:buy.override||null,changedAt:new Date().toISOString()};
  var history=Array.isArray(buy.editHistory)?buy.editHistory:[];history.push(old);
  buy.units=units;buy.investment=investment;buy.estimate=purchaseEstimate(units,investment);buy.costBreakdown=costBreakdown(q.costModel,units);
  buy.override=z.isOverride?{manual:true,type:"UNIDADES_SOBRE_RECOMENDACION",recommendedUnits:z.recommended,actualUnits:units,confirmedAt:new Date().toISOString()}:null;
  buy.summary=freezePreview(id);buy.editHistory=history;buy.lastEditedAt=new Date().toISOString();save(ops);selectPurchase(o,buy.summary);render(true,true)
 };
}

function deleteOperation(id){
 var ops=load(),o=ops.filter(function(x){return x.id===id})[0];if(!o)return;
 if(o.status!=="ABIERTA"){alert("Solo se pueden eliminar operaciones abiertas desde este control.");return}
 if(!confirm("¿Eliminar definitivamente "+id+" del historial local? Esta acción no se puede deshacer."))return;
 save(ops.filter(function(x){return x.id!==id}));render(true)
}

function closeForm(id){
 var ops=load(),o=ops.filter(function(x){return x.id===id})[0];if(!o)return;var q=o.prediction||{},a=o.actual||{};
 var html='<div class="ops-close"><b>Cerrar '+esc(id)+'</b><div class="ops-grid">'+
 '<label>Unidades vendidas<input id="op-units" type="number" min="0" value="'+esc(a.unitsSold==null?"":a.unitsSold)+'"></label>'+
 '<label>Precio real/u<input id="op-price" type="number" step="0.01" value="'+esc(a.price==null?"":a.price)+'"></label>'+
 '<label>ROI real %<input id="op-roi" type="number" step="0.1" value="'+esc(a.roi==null?"":(a.roi*100).toFixed(1))+'"></label>'+
 '<label>Margen real %<input id="op-margin" type="number" step="0.1" value="'+esc(a.margin==null?"":(a.margin*100).toFixed(1))+'"></label>'+
 '<label>Devoluciones<input id="op-returns" type="number" min="0" value="'+esc(a.returns==null?"":a.returns)+'"></label>'+
 '<label>Days to Cash real<input id="op-dtc" type="number" min="0" value="'+esc(a.daysToCash==null?"":a.daysToCash)+'"></label>'+
 '<label>Beneficio/pérdida total US$<input id="op-profit" type="number" step="0.01" value="'+esc(a.profit==null?"":a.profit)+'"></label></div><button id="op-confirm" class="ops-btn">Cerrar operación</button> <button id="op-cancel" class="ops-btn">Cancelar</button></div>';
 var host=document.getElementById("ops-editor");host.innerHTML=html;
 document.getElementById("op-cancel").onclick=function(){host.innerHTML="";cancelPreview()};
 document.getElementById("op-confirm").onclick=function(){
  var units=num(document.getElementById("op-units").value),price=num(document.getElementById("op-price").value),roi=num(document.getElementById("op-roi").value),margin=num(document.getElementById("op-margin").value),returns=num(document.getElementById("op-returns").value),dtc=num(document.getElementById("op-dtc").value),profit=num(document.getElementById("op-profit").value);
  if(units==null||price==null||roi==null||margin==null||returns==null||dtc==null||profit==null){alert("Completa todos los resultados reales antes de cerrar.");return}
  o.actual={unitsSold:units,price:price,roi:roi/100,margin:margin/100,returns:returns,daysToCash:dtc,profit:profit};
  o.status="CERRADA";o.closedAt=new Date().toISOString();
  o.variance={price:delta(o.actual.price,q.price),roi:delta(o.actual.roi,q.roi),margin:delta(o.actual.margin,q.margin),daysToCash:delta(o.actual.daysToCash,q.daysToCash)};
  save(ops);render(true)
 }
}

function render(resetEditor,keepPreview){
 if(resetEditor&&!keepPreview)forgetSelected();
 var root=document.getElementById("operations_history");if(!root)return;
 var editor=document.getElementById("ops-editor");
 if(!resetEditor&&editor&&editor.childElementCount){return}
 var ops=load(),engine=window.MOTOR_SCORING_ENGINE,canBuy=!!(engine&&engine.final&&engine.final.decision==="COMPRAR PILOTO");
 root.innerHTML='<div class="ops-head"><div><div class="cardtitle">Registro de análisis y operaciones · v1</div><div class="ops-muted">ANÁLISIS guarda lo que JEV pensó. COMPRA abre seguimiento real y permite comparar predicción vs resultado.</div></div><div class="ops-actions"><button id="ops-analysis" class="ops-btn">Guardar análisis</button><button id="ops-buy" class="ops-btn" '+(canBuy?'':'disabled')+'>Registrar compra</button></div></div><div id="ops-list">'+
 (ops.length?ops.slice().reverse().map(function(o){
  var q=o.prediction||{},a=o.actual||{},v=o.variance||{},kind=o.kind||(o.status==="ANALISIS"?"ANALISIS":"COMPRA"),buy=o.purchase||null,ov=buy&&buy.override&&buy.override.manual?buy.override:null;
  return '<div class="ops-row"><b>'+esc(o.id)+'</b> · '+esc(kind)+' · '+esc(o.status)+' · '+esc(o.product.asin||"SIN ASIN")+
   '<br><b>PREDICCIÓN:</b> '+esc(q.decision||"—")+' · '+(q.units==null?'u —':'u '+q.units)+' · inversión '+money(q.investment)+' · ROI '+pct(q.roi)+' · margen '+pct(q.margin)+' · DTC '+(q.daysToCash==null?"—":Math.round(q.daysToCash)+" días")+
   (buy?'<br><b>COMPRA REAL:</b> '+buy.units+' u · inversión '+money(buy.investment):'')+
   (buy&&buy.estimate?'<br><b>ESTIMACIÓN DEL LOTE:</b> ganancia '+money(buy.estimate.netTotal)+' · margen '+pct(buy.estimate.margin)+' · ROI '+pct(buy.estimate.roi):'')+
   (ov?'<div class="ops-override"><b>OVERRIDE MANUAL</b><br>Recomendación JEV: '+esc(ov.recommendedUnits)+' u · Compra registrada: '+esc(ov.actualUnits)+' u.</div>':'')+
   (o.status==="CERRADA"?'<b>RESULTADO REAL:</b> beneficio '+money(a.profit)+' · ROI '+pct(a.roi)+' · margen '+pct(a.margin)+' · DTC '+Math.round(a.daysToCash)+' días · devoluciones '+a.returns+'<br><span class="ops-muted">DESVIACIÓN: precio '+money(v.price)+' · ROI '+pct(v.roi)+' · margen '+pct(v.margin)+' · DTC '+(v.daysToCash==null?"—":(v.daysToCash>0?"+":"")+Math.round(v.daysToCash)+" días")+'</span>':
    (o.status==="ABIERTA"?'<div class="ops-actions"><button class="ops-btn ops-summary-btn" data-id="'+esc(o.id)+'">Ver resumen del lote</button><button class="ops-btn ops-close-btn" data-id="'+esc(o.id)+'">Registrar resultado real</button><button class="ops-btn ops-edit-btn" data-id="'+esc(o.id)+'">Editar compra</button><button class="ops-btn ops-delete-btn ops-danger" data-id="'+esc(o.id)+'">Eliminar operación</button></div>':''))+
   '<br><span class="ops-muted">Financial '+(q.financialScore==null?"—":q.financialScore)+' · Rotation '+(q.rotationScore==null?"—":q.rotationScore)+' · Market '+(q.marketScore==null?"—":q.marketScore)+' · Risk '+(q.riskScore==null?"—":q.riskScore)+' · Confidence '+(q.dataConfidence==null?"—":q.dataConfidence)+'</span></div>'
 }).join(""):'<div class="ops-empty">Todavía no hay análisis ni operaciones registradas.</div>')+
 '</div><div id="ops-editor"></div>';
 Array.prototype.forEach.call(document.querySelectorAll(".ops-close-btn"),function(x){x.onclick=function(){closeForm(this.getAttribute("data-id"))}});
 Array.prototype.forEach.call(document.querySelectorAll(".ops-edit-btn"),function(x){x.onclick=function(){editPurchaseForm(this.getAttribute("data-id"))}});
 Array.prototype.forEach.call(document.querySelectorAll(".ops-delete-btn"),function(x){x.onclick=function(){deleteOperation(this.getAttribute("data-id"))}});
 Array.prototype.forEach.call(document.querySelectorAll(".ops-summary-btn"),function(x){x.onclick=function(){var host=document.getElementById("ops-editor");if(host)host.innerHTML="";var o=load().filter(function(o){return o.id===x.getAttribute("data-id")})[0];selectPurchase(o)}});
 var a=document.getElementById("ops-analysis");if(a)a.onclick=function(){var o=snapshot("ANALISIS");if(!o){alert("El Motor Scoring todavía no está listo.");return}var list=load();list.push(o);save(list);render(true)};
 var b=document.getElementById("ops-buy");if(b)b.onclick=function(){var o=snapshot("COMPRA");if(!o||o.prediction.decision!=="COMPRAR PILOTO"){alert("JEV no recomienda compra con la decisión actual.");return}purchaseForm(o)};
}

function init(attempt){
 attempt=attempt||0;var anchor=document.getElementById("jev_final_decision");
 if(!anchor){if(attempt<80)setTimeout(function(){init(attempt+1)},100);return}
 if(document.getElementById("operations_history"))return;
 styles();var d=document.createElement("div");d.id="operations_history";d.className="ops-box";anchor.parentNode.insertBefore(d,anchor.nextSibling);render();restoreSelected();
 document.addEventListener("input",function(event){var target=event.target;if(target&&target.closest&&target.closest("#operations_history"))return;forgetSelected()},true);
 document.addEventListener("change",function(event){var target=event.target;if(target&&target.closest&&target.closest("#operations_history"))return;forgetSelected()},true);
 if(window.MutationObserver)new MutationObserver(function(){var b=document.getElementById("ops-buy"),e=window.MOTOR_SCORING_ENGINE;if(b)b.disabled=!(e&&e.final&&e.final.decision==="COMPRAR PILOTO")}).observe(anchor,{childList:true,subtree:true,characterData:true})
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(function(){init(0)},50)});else setTimeout(function(){init(0)},50);
window.AMAZON_COMPOUND_OPERATIONS={load:load,render:render,snapshot:snapshot,mount:function(){init(0)}};
})();