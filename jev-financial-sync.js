(function(){
"use strict";
function $(id){return document.getElementById(id)}
function money(x){return x==null||!isFinite(x)?"—":"$"+Number(x).toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2})}
function pct(x){return x==null||!isFinite(x)?"—":(Number(x)*100).toFixed(1)+"%"}
function n(id){var e=$(id);if(!e||e.value==="")return 0;var v=Number(e.value);return isFinite(v)?v:0}
function readState(){try{var s=JSON.parse(localStorage.getItem("jev_v1")||"{}");return s&&typeof s==="object"?s:{}}catch(e){return {}}}
function setText(node,value){if(node&&node.textContent!==value)node.textContent=value}
function setStat(node,label,value,sub,tone){if(!node)return;var l=node.querySelector(".l"),v=node.querySelector(".v"),s=node.querySelector(".s");if(l&&label)setText(l,label);if(v){setText(v,value);var cls="v "+(tone||"");if(v.className!==cls)v.className=cls}if(s&&sub!=null)setText(s,sub)}
function realCostBreakdown(){
 var s=readState(),c=s.costs&&s.costs.checkout,p=s.costs&&s.costs.prep;if(!c||!p)return null;
 var units=Math.max(0,Math.round(n("p_unid"))),currency=$("p_moneda")?$("p_moneda").value:"USD",rate=currency==="USD"?1:n("p_tc");
 if(!(units>0&&rate>0)||c.displayedUnit==null||c.taxUnit==null||c.supplierToPrepLot==null||p.prepUnit==null||p.prepToAmazonLot==null)return null;
 var checkout=Math.max(0,Number(c.displayedUnit)-Number(c.discountUnit||0)+Number(c.taxUnit))/rate;
 var supplier=Number(c.supplierToPrepLot)/rate,prepUnit=Number(p.prepUnit),other=Number(p.otherPrepLot||0),prepAmazon=Number(p.prepToAmazonLot);
 var fixedLot=supplier+other+prepAmazon,total=checkout*units+prepUnit*units+fixedLot,landed=total/units;
 return {units:units,checkout:checkout,supplier:supplier,prepUnit:prepUnit,other:other,prepAmazon:prepAmazon,fixedLot:fixedLot,total:total,landed:landed};
}

function globalTotals(){
 var ops;try{ops=JSON.parse(localStorage.getItem("amazon_compuesto_operations_v1")||"[]");if(!Array.isArray(ops))throw new Error("history")}catch(e){return {count:0,invalid:true}}
 var t={count:0,closedCount:0,realized:0,realizedGains:0,realizedLosses:0,realizedComplete:true,units:0,investment:0,net:0,sales:0,referral:0,fba:0,product:0,prep:0,supplier:0,other:0,shipping:0,storage:0,ads:0,returns:0,complete:true,breakdownComplete:true};
 function number(v){return v!==null&&v!==undefined&&v!==""&&isFinite(Number(v))?Number(v):null}
 ops.forEach(function(o){
  if(!o)return;
  if(o.status==="CERRADA"&&o.purchase){t.closedCount++;var profit=o.actual&&number(o.actual.profit);if(profit===null||profit===undefined)t.realizedComplete=false;else {t.realized+=profit;if(profit>0)t.realizedGains+=profit;else if(profit<0)t.realizedLosses+=profit;}}
  if(o.status!=="ABIERTA")return;t.count++;
  var buy=o.purchase||{},b=buy.summary,f=b&&b.financial,inputs=b&&b.inputs,u=number(buy.units),investment=number(buy.investment);
  if(u===null||u<=0||investment===null||investment<0){t.complete=false;t.breakdownComplete=false;return}
  t.units+=u;t.investment+=investment;
  var price=inputs&&number(inputs.p_precio),net=f&&number(f.net);
  if(price===null||price===undefined||net===null||net===undefined){t.complete=false;t.breakdownComplete=false;return}
  t.sales+=price*u;t.net+=net*u;
  var ref=number(inputs.p_ref),fba=number(inputs.p_fba),alm=number(inputs.p_almac),days=number(inputs.c_venta),ads=number(inputs.p_ppc),returns=number(f.returnCost);
  var parts=["checkout","prepUnit","supplier","other","prepAmazon"].map(function(k){return number(b[k])});
  if(ref===null||fba===null||alm===null||days===null||ads===null||returns===null||parts.some(function(x){return x===null})){t.breakdownComplete=false;return}
  t.referral+=(price>0?Math.max(price*Math.max(0,ref)/100,.30):0)*u;t.fba+=Math.max(0,fba)*u;
  t.product+=parts[0]*u;t.prep+=parts[1]*u;t.supplier+=parts[2];t.other+=parts[3];t.shipping+=parts[4];
  t.storage+=Math.max(0,alm)*Math.max(0,days)/30.4*u;t.ads+=Math.max(0,ads)*u;t.returns+=returns*u;
 });
 t.margin=t.complete&&t.sales>0?t.net/t.sales:null;t.roi=t.complete&&t.investment>0?t.net/t.investment:null;
 return t;
}
function syncGlobal(out){
 var t=globalTotals();if(!$("p-purchases")&&!t.count&&!t.closedCount&&!t.invalid){var previous=$("closed-operations-summary");if(previous)previous.remove();return false;}
 var balance=window.AMAZON_CAPITAL_BALANCE&&window.AMAZON_CAPITAL_BALANCE(),context=$("purchase-summary-context");
 if(!context){context=document.createElement("div");context.id="purchase-summary-context";context.className="note";out.insertBefore(context,out.firstChild)}
 setText(context,"Resumen general · "+t.count+" compras abiertas · "+(t.closedCount||0)+" cerradas. Las estimaciones corresponden solo a compras abiertas.");
 var real=$("closed-operations-summary");
 if(t.closedCount){
  if(!real){real=document.createElement("div");real.id="closed-operations-summary";real.className="card";out.appendChild(real);}
  var realHtml='<div class="cardtitle">Resultados reales · operaciones cerradas</div><div class="stats">'+
   '<div id="global-realized-gains" class="stat"><div class="l">Ganancias reales acumuladas</div><div class="v">'+money(t.realizedComplete?t.realizedGains:null)+'</div><div class="s">Suma de resultados positivos de lotes cerrados</div></div>'+
   '<div id="global-realized-losses" class="stat"><div class="l">Pérdidas reales acumuladas</div><div class="v '+(t.realizedLosses<0?'bad':'')+'">'+money(t.realizedComplete?t.realizedLosses:null)+'</div><div class="s">Suma de resultados negativos de lotes cerrados</div></div>'+
   '<div id="global-realized-net" class="stat"><div class="l">Ganancia/pérdida neta real</div><div class="v '+(t.realized<0?'bad':'')+'">'+money(t.realizedComplete?t.realized:null)+'</div><div class="s">Ganancias + pérdidas · '+t.closedCount+' lotes cerrados</div></div><div class="stat"><div class="l">Resultado incorporado al capital</div><div class="v">'+money(balance&&balance.complete?balance.realized:null)+'</div><div class="s">Solo cierres con liquidación confirmada</div></div><div id="global-total-capital" class="stat"><div class="l">Capital total actualizado</div><div class="v '+(balance&&balance.totalCapital<0?'bad':'')+'">'+money(balance&&balance.complete?balance.totalCapital:null)+'</div><div class="s">'+(balance&&balance.complete?'Presupuesto base: '+money(balance.budget)+' · Ganancia/pérdida real incorporada: '+money(balance.realized):'Balance de capital incompleto')+'</div></div></div>';
  if(real._motorScoringHtml!==realHtml){real.innerHTML=realHtml;real._motorScoringHtml=realHtml;}
 }else if(real)real.remove();
 var stats=out.querySelectorAll(".stats"),a=stats[0]&&stats[0].querySelectorAll(".stat"),c=stats[1]&&stats[1].querySelectorAll(".stat");
 if(a){
  setStat(a[0],"Ganancia neta total estimada",money(t.complete&&!t.invalid?t.net:null),"Suma de compras abiertas · todavía no realizada",t.net<0?"bad":"");
  setStat(a[1],"Margen global estimado",pct(t.margin),"Ganancia total / ventas totales","");
  setStat(a[2],"ROI global estimado",pct(t.roi),"Ganancia total / inversión total","");
 }
 if(c){
  setStat(c[0],"Capital comprometido total",money(balance&&balance.complete?balance.committed:null),"Todas las compras abiertas","");
  setStat(c[1],"Capital disponible",money(balance&&balance.complete?balance.available:null),"Capital actualizado − compras abiertas − reserva",balance&&balance.available<0?"bad":"");
  setStat(c[2],"Reserva de liquidez",money(balance&&balance.complete?balance.reserve:null),"Apartada para proteger capital","");
  setStat(c[3],"Unidades registradas",t.invalid?"—":String(t.units),t.count+" compras abiertas","");
 }
 var cards=out.querySelectorAll(".card");
 Array.prototype.forEach.call(cards,function(card){
  var title=card.querySelector(".cardtitle");if(!title)return;var text=title.textContent||"";
  if(text.indexOf("Desglose")===0){
   setText(title,"Desglose general estimado · compras abiertas");
   var rows=[];
   function row(label,value){rows.push('<tr><td>'+label+'</td><td class="n r">'+money(value)+'</td></tr>')}
   if(!t.invalid&&t.complete&&t.breakdownComplete){
    row("Ventas totales estimadas",t.sales);row("Referral fee", -t.referral);row("FBA fee",-t.fba);
    row("Producto / checkout",-t.product);row("Prep Center",-t.prep);row("Flete proveedor → Prep",-t.supplier);
    row("Otros costos Prep",-t.other);row("Flete Prep → Amazon",-t.shipping);
    var adjustment=t.investment-(t.product+t.prep+t.supplier+t.other+t.shipping);
    if(Math.abs(adjustment)>.005)row("Ajuste de inversión registrada",-adjustment);
    row("Almacenamiento esperado",-t.storage);row("Publicidad",-t.ads);row("Devoluciones esperadas",-t.returns);
    row("Capital comprometido total",t.investment);row("Ganancia neta total estimada",t.net);
   }else rows.push('<tr><td colspan="2">Faltan estimaciones guardadas para completar el resumen general. No se usan los datos del análisis actual para rellenarlas.</td></tr>');
   var body=card.querySelector("tbody"),html=rows.join("");if(body&&body._motorScoringHtml!==html){body.innerHTML=html;body._motorScoringHtml=html}
  }
  if(text.indexOf("Escenarios ·")===0||text.indexOf("Por qué este veredicto")===0)card.style.display="none";
 });
 Array.prototype.forEach.call(out.querySelectorAll(".foot"),function(f){setText(f,"Resumen de compras abiertas. Cada operación conserva su detalle. Las ganancias estimadas no aumentan el capital disponible.")});
 return true;
}

function sync(){
 var engine=window.MOTOR_SCORING_ENGINE,out=$("p_out");if(!out)return;if(syncGlobal(out))return;if(!engine)return;
 var fin=engine.financial||{},cap=engine.capital||{},final=engine.final||{},b=realCostBreakdown();
 var preview=window.AMAZON_PURCHASE_PREVIEW;
 if(preview&&typeof engine.evaluatePurchaseFinancial==="function"){b=preview;fin=preview.financial||engine.evaluatePurchaseFinancial(b.units,b.total);}
 if(!fin.complete||!b)return;
 var context=$("purchase-summary-context");if(preview&&!context){context=document.createElement("div");context.id="purchase-summary-context";context.className="note";out.insertBefore(context,out.firstChild)}
 if(context){if(preview)setText(context,(preview.operationId?"Compra "+preview.operationId+" · estimación guardada: ":"Estimación de tu compra: ")+b.units+" unidades · la recomendación original del motor se conserva.");else context.remove();}
 var stats=out.querySelectorAll(".stats");
 if(stats[0]){
  var a=stats[0].querySelectorAll(".stat");
  setStat(a[0],preview?"Ganancia neta del lote":"Ganancia neta",money(preview?fin.net*b.units:fin.net),preview?money(fin.net)+" por unidad · "+b.units+" unidades":"Por unidad · costo real Motor Scoring",fin.net<=0?"bad":"");
  setStat(a[1],"Margen",pct(fin.margin),"Neta / precio · Motor Scoring",fin.margin<.08?"bad":(fin.margin<.15?"warn":""));
  setStat(a[2],"ROI",pct(fin.roi),"ROI / ciclo · Motor Scoring",fin.roi<.10?"bad":(fin.roi<.30?"warn":""));
 }
 if(stats[1]){
  var c=stats[1].querySelectorAll(".stat"),budget=preview&&preview.budget!=null?preview.budget:n("p_presu"),capital=preview?b.total:(cap.requestedCapital!=null?cap.requestedCapital:b.total),free=budget-capital;
  var balance=window.AMAZON_CAPITAL_BALANCE&&window.AMAZON_CAPITAL_BALANCE(preview&&preview.operationId,capital);
  if(balance&&balance.complete){budget=balance.budget;free=balance.afterPurchase;}else free=null;
  setStat(c[0],"Capital comprometido",money(capital),budget>0?pct(capital/budget)+" del presupuesto · costo real":"Costo real",budget>0&&capital/budget>.6?"warn":"");
  setStat(c[1],"Disponible tras este lote",money(free),balance&&balance.complete?"Descuenta otras compras y reserva de "+money(balance.reserve):"Balance global incompleto",free!=null&&free<0?"bad":"");
  setStat(c[2],"Costo real / unidad",money(b.landed),"Producto + Prep + fletes","");
  setStat(c[3],"Precio mínimo",money(fin.breakEven),"Bajo esto, pierdes · Motor Scoring","");
 }
 function input(id){return preview&&preview.inputs&&preview.inputs[id]!=null?Number(preview.inputs[id]):n(id)}
 var price=input("p_precio"),refp=Math.max(0,input("p_ref"))/100,referral=price>0?Math.max(price*refp,.30):0,fba=Math.max(0,input("p_fba")),storage=Math.max(0,input("p_almac"))*(Math.max(0,input("c_venta"))/30.4),ads=Math.max(0,input("p_ppc"));
 var factor=preview?b.units:1;
 var cards=out.querySelectorAll(".card");
 Array.prototype.forEach.call(cards,function(card){var title=card.querySelector(".cardtitle");if(!title)return;var t=title.textContent||"";
  if(t.indexOf("Desglose de la unidad")===0||t.indexOf("Desglose de costo real")===0||t.indexOf("Desglose financiero real")===0||t.indexOf("Desglose general estimado")===0){
   setText(title,"Desglose financiero real · Motor Scoring"+(preview?" · lote de "+b.units+" unidades":""));
   var tbody=card.querySelector("tbody");var html=
    '<tr><td>Precio de venta</td><td class="n r">'+money(price*factor)+'</td></tr>'+
    '<tr><td>Referral fee</td><td class="n r">−'+money(referral*factor)+'</td></tr>'+
    '<tr><td>FBA fee</td><td class="n r">−'+money(fba*factor)+'</td></tr>'+
    '<tr><td>Producto / checkout<div class="sub">por unidad</div></td><td class="n r">−'+money(b.checkout*factor)+'</td></tr>'+
    '<tr><td>Prep Center<div class="sub">por unidad</div></td><td class="n r">−'+money(b.prepUnit*factor)+'</td></tr>'+
    '<tr><td>Flete proveedor → Prep<div class="sub">lote ÷ '+b.units+' unidades</div></td><td class="n r">−'+money(b.supplier/b.units*factor)+'</td></tr>'+
    '<tr><td>Otros costos Prep<div class="sub">lote ÷ '+b.units+' unidades</div></td><td class="n r">−'+money(b.other/b.units*factor)+'</td></tr>'+
    '<tr><td>Flete Prep → Amazon<div class="sub">lote ÷ '+b.units+' unidades</div></td><td class="n r">−'+money(b.prepAmazon/b.units*factor)+'</td></tr>'+
    '<tr><td>Almacenamiento esperado</td><td class="n r">−'+money(storage*factor)+'</td></tr>'+
    '<tr><td>Publicidad</td><td class="n r">−'+money(ads*factor)+'</td></tr>'+
    '<tr><td>Devoluciones esperadas<div class="sub">costo esperado por unidad</div></td><td class="n r">−'+money(fin.returnCost*factor)+'</td></tr>'+
    '<tr><td style="font-weight:500">Costo real de entrada / unidad</td><td class="n r" style="font-weight:500">'+money(b.landed*factor)+'</td></tr>'+
    '<tr><td style="font-weight:500;border-bottom:none">Ganancia neta / unidad</td><td class="n r" style="border-bottom:none;font-size:15px">'+money(fin.net*factor)+'</td></tr>';
   if(preview)html=html.replace(/por unidad/g,'total del lote').replace(/lote ÷ [0-9]+ unidades/g,'total del lote').replace('Costo real de entrada / unidad','Capital total de entrada').replace('Ganancia neta / unidad','Ganancia neta del lote');
   if(tbody&&tbody._motorScoringHtml!==html){tbody.innerHTML=html;tbody._motorScoringHtml=html;}
  }
  if(t.indexOf("Escenarios ·")===0||t.indexOf("Por qué este veredicto")===0){card.style.display="none"}
 });
 var feet=out.querySelectorAll(".foot");Array.prototype.forEach.call(feet,function(f){if(f.textContent.indexOf("Esta herramienta solo hace aritmética")>=0)f.textContent='Estas cifras usan la misma economía real que Motor Scoring. Los escenarios heredados permanecen ocultos hasta migrarlos al mismo modelo para evitar resultados contradictorios.'});
}
function schedule(){setTimeout(sync,0);setTimeout(sync,80);setTimeout(sync,300)}
function init(){schedule();var target=$("jev_final_decision");if(target&&window.MutationObserver)new MutationObserver(schedule).observe(target,{childList:true,subtree:true,characterData:true});document.addEventListener("input",schedule,true);document.addEventListener("change",schedule,true);window.addEventListener("motor-scoring-state-changed",schedule);window.addEventListener("motor-scoring-operations-changed",schedule)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(init,250)});else setTimeout(init,250);
window.JEV_FINANCIAL_SYNC={sync:sync,globalTotals:globalTotals};
})();
