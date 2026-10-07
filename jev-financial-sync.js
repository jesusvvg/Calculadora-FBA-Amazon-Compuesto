(function(){
"use strict";
function $(id){return document.getElementById(id)}
function money(x){return x==null||!isFinite(x)?"—":"$"+Number(x).toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2})}
function pct(x){return x==null||!isFinite(x)?"—":(Number(x)*100).toFixed(1)+"%"}
function n(id){var e=$(id);if(!e||e.value==="")return 0;var v=Number(e.value);return isFinite(v)?v:0}
function readState(){try{var s=JSON.parse(localStorage.getItem("jev_v1")||"{}");return s&&typeof s==="object"?s:{}}catch(e){return {}}}
function setStat(node,label,value,sub,tone){if(!node)return;var l=node.querySelector(".l"),v=node.querySelector(".v"),s=node.querySelector(".s");if(l&&label)l.textContent=label;if(v){v.textContent=value;v.className="v "+(tone||"")}if(s&&sub!=null)s.textContent=sub}
function realCostBreakdown(){
 var s=readState(),c=s.costs&&s.costs.checkout,p=s.costs&&s.costs.prep;if(!c||!p)return null;
 var units=Math.max(0,Math.round(n("p_unid"))),currency=$("p_moneda")?$("p_moneda").value:"USD",rate=currency==="USD"?1:n("p_tc");
 if(!(units>0&&rate>0)||c.displayedUnit==null||c.taxUnit==null||c.supplierToPrepLot==null||p.prepUnit==null||p.prepToAmazonLot==null)return null;
 var checkout=Math.max(0,Number(c.displayedUnit)-Number(c.discountUnit||0)+Number(c.taxUnit))/rate;
 var supplier=Number(c.supplierToPrepLot)/rate,prepUnit=Number(p.prepUnit),other=Number(p.otherPrepLot||0),prepAmazon=Number(p.prepToAmazonLot);
 var fixedLot=supplier+other+prepAmazon,total=checkout*units+prepUnit*units+fixedLot,landed=total/units;
 return {units:units,checkout:checkout,supplier:supplier,prepUnit:prepUnit,other:other,prepAmazon:prepAmazon,fixedLot:fixedLot,total:total,landed:landed};
}
function sync(){
 var engine=window.MOTOR_SCORING_ENGINE,out=$("p_out");if(!engine||!out)return;
 var fin=engine.financial||{},cap=engine.capital||{},final=engine.final||{},b=realCostBreakdown();
 if(!fin.complete||!b)return;
 var stats=out.querySelectorAll(".stats");
 if(stats[0]){
  var a=stats[0].querySelectorAll(".stat");
  setStat(a[0],"Ganancia neta",money(fin.net),"Por unidad · costo real Motor Scoring",fin.net<=0?"bad":"");
  setStat(a[1],"Margen",pct(fin.margin),"Neta / precio · Motor Scoring",fin.margin<.08?"bad":(fin.margin<.15?"warn":""));
  setStat(a[2],"ROI",pct(fin.roi),"ROI / ciclo · Motor Scoring",fin.roi<.10?"bad":(fin.roi<.30?"warn":""));
 }
 if(stats[1]){
  var c=stats[1].querySelectorAll(".stat"),budget=n("p_presu"),capital=cap.requestedCapital!=null?cap.requestedCapital:b.total,free=budget-capital;
  setStat(c[0],"Capital comprometido",money(capital),budget>0?pct(capital/budget)+" del presupuesto · costo real":"Costo real",budget>0&&capital/budget>.6?"warn":"");
  setStat(c[1],"Capital libre",money(free),"Presupuesto − capital comprometido",free<0?"bad":"");
  setStat(c[2],"Costo real / unidad",money(b.landed),"Producto + Prep + fletes","");
  setStat(c[3],"Precio mínimo",money(fin.breakEven),"Bajo esto, pierdes · Motor Scoring","");
 }
 var verdict=out.querySelector(".verdict");
 if(verdict){var label=verdict.querySelector(".l"),value=verdict.querySelector(".v");if(label)label.textContent="Economía real · Motor Scoring";if(value)value.textContent=final.decision||"—";verdict.className="verdict "+(final.tone==="bad"?"bad":(final.tone==="good"?"good":"warn"))}
 var price=n("p_precio"),refp=Math.max(0,n("p_ref"))/100,referral=price>0?Math.max(price*refp,.30):0,fba=Math.max(0,n("p_fba")),storage=Math.max(0,n("p_almac"))*(Math.max(0,n("c_venta"))/30.4),ads=Math.max(0,n("p_ppc"));
 var cards=out.querySelectorAll(".card");
 Array.prototype.forEach.call(cards,function(card){var title=card.querySelector(".cardtitle");if(!title)return;var t=title.textContent||"";
  if(t.indexOf("Desglose de la unidad")===0||t.indexOf("Desglose de costo real")===0){
   title.textContent="Desglose financiero real · Motor Scoring";
   var tbody=card.querySelector("tbody");if(tbody)tbody.innerHTML=
    '<tr><td>Precio de venta</td><td class="n r">'+money(price)+'</td></tr>'+
    '<tr><td>Referral fee</td><td class="n r">−'+money(referral)+'</td></tr>'+
    '<tr><td>FBA fee</td><td class="n r">−'+money(fba)+'</td></tr>'+
    '<tr><td>Producto / checkout<div class="sub">por unidad</div></td><td class="n r">−'+money(b.checkout)+'</td></tr>'+
    '<tr><td>Prep Center<div class="sub">por unidad</div></td><td class="n r">−'+money(b.prepUnit)+'</td></tr>'+
    '<tr><td>Flete proveedor → Prep<div class="sub">lote ÷ '+b.units+' unidades</div></td><td class="n r">−'+money(b.supplier/b.units)+'</td></tr>'+
    '<tr><td>Otros costos Prep<div class="sub">lote ÷ '+b.units+' unidades</div></td><td class="n r">−'+money(b.other/b.units)+'</td></tr>'+
    '<tr><td>Flete Prep → Amazon<div class="sub">lote ÷ '+b.units+' unidades</div></td><td class="n r">−'+money(b.prepAmazon/b.units)+'</td></tr>'+
    '<tr><td>Almacenamiento esperado</td><td class="n r">−'+money(storage)+'</td></tr>'+
    '<tr><td>Publicidad</td><td class="n r">−'+money(ads)+'</td></tr>'+
    '<tr><td>Devoluciones esperadas<div class="sub">costo esperado por unidad</div></td><td class="n r">−'+money(fin.returnCost)+'</td></tr>'+
    '<tr><td style="font-weight:500">Costo real de entrada / unidad</td><td class="n r" style="font-weight:500">'+money(b.landed)+'</td></tr>'+
    '<tr><td style="font-weight:500;border-bottom:none">Ganancia neta / unidad</td><td class="n r" style="border-bottom:none;font-size:15px">'+money(fin.net)+'</td></tr>';
  }
  if(t.indexOf("Escenarios ·")===0||t.indexOf("Por qué este veredicto")===0){card.style.display="none"}
 });
 var feet=out.querySelectorAll(".foot");Array.prototype.forEach.call(feet,function(f){if(f.textContent.indexOf("Esta herramienta solo hace aritmética")>=0)f.innerHTML='Estas cifras usan la misma economía real que Motor Scoring. Los escenarios heredados permanecen ocultos hasta migrarlos al mismo modelo para evitar resultados contradictorios.'});
}
function schedule(){setTimeout(sync,0);setTimeout(sync,80);setTimeout(sync,300)}
function init(){schedule();var target=$("jev_final_decision");if(target&&window.MutationObserver)new MutationObserver(schedule).observe(target,{childList:true,subtree:true,characterData:true});document.addEventListener("input",schedule,true);document.addEventListener("change",schedule,true);window.addEventListener("motor-scoring-state-changed",schedule)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(init,250)});else setTimeout(init,250);
window.JEV_FINANCIAL_SYNC={sync:sync};
})();