(function(){
  "use strict";
  var KEY="jev_v1";
  function $(id){return document.getElementById(id)}
  function load(){
    var s={}; try{s=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){s={}}
    if(!s||typeof s!=="object")s={};
    if(!s.costs)s.costs={};
    if(!s.costs.checkout)s.costs.checkout={displayedUnit:null,discountUnit:0,taxUnit:null,supplierToPrepLot:null};
    if(!s.costs.prep)s.costs.prep={prepUnit:null,otherPrepLot:0,prepToAmazonLot:null};
    if(!s.returns)s.returns={returnRateExpected:null,resellablePct:null,removalCostUnit:null,prepReturnCostUnit:null,resendCostUnit:null};
    if(!s.product)s.product={stage:"CANDIDATO"};
    return s;
  }
  var state=load();
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
  function n(id){var el=$(id);if(!el||el.value==="")return null;var x=Number(el.value);return isFinite(x)?x:null}
  function val(id){var el=$(id);return el?el.value:""}
  function set(id,v){var el=$(id);if(el)el.value=(v===null||v===undefined)?"":String(v)}
  function money(n){return isFinite(n)?"$"+Number(n).toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"}
  function pct(n){return isFinite(n)?(n*100).toFixed(1)+"%":"—"}

  function injectStyles(){
    if($("jev-phase3-style"))return;
    var st=document.createElement("style");st.id="jev-phase3-style";
    st.textContent=
      ".jev-phase3-summary{margin:0 0 14px;padding-bottom:8px}"+
      ".jev-phase3-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px}"+
      ".jev-phase3-metric{border:1px solid var(--line);padding:9px 10px;background:#fff}"+
      ".jev-phase3-metric .k{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}"+
      ".jev-phase3-metric .v{font-family:var(--mono);font-size:17px;margin-top:3px}"+
      ".jev-phase3-warning{font-size:11.5px;line-height:1.5;padding:8px 10px;margin-top:6px;background:var(--warnBg);border-left:3px solid var(--warn)}"+
      ".jev-phase3-bad{background:var(--badBg);border-left-color:var(--bad)}"+
      "@media(max-width:520px){.jev-phase3-grid{grid-template-columns:1fr}}";
    document.head.appendChild(st);
  }

  function fnum(id,label,suffix,hint){
    return '<label class="f"><div class="flabel">'+label+'</div><div class="fbox"><input id="'+id+'" type="number" inputmode="decimal" step="0.01">'+(suffix?'<span class="fix">'+suffix+'</span>':'')+'</div>'+(hint?'<div class="hint">'+hint+'</div>':'')+'</label>';
  }

  function buildUI(){
    var p2=$("jev_phase2"); if(!p2||$("jev_phase3"))return;
    var box=document.createElement("div");box.id="jev_phase3";
    box.innerHTML=
      '<details class="jev-details" id="jev_costs"><summary>Costo real y Prep Center</summary><div class="jev-details-body">'+
        '<div class="sect">Checkout · moneda de compra</div>'+
        fnum("jev_displayed","Precio mostrado por unidad","","Precio de etiqueta antes de cupón e impuestos.")+
        '<div class="two">'+fnum("jev_discount","Descuento/cupón por unidad","","")+fnum("jev_tax","Impuesto por unidad","","")+'</div>'+
        fnum("jev_supplier_prep","Flete proveedor → Prep Center · lote","","En la moneda de compra.")+
        '<div class="sect">Prep Center · USD</div>'+
        fnum("jev_prep_unit","Prep Center por unidad","US$","")+
        '<div class="two">'+fnum("jev_prep_other","Otros costos Prep · lote","US$","")+fnum("jev_prep_amazon","Flete Prep → Amazon · lote","US$","")+'</div>'+
        '<div class="hint">El checkout se convierte a USD con el tipo de cambio de la calculadora. Prep Center y Prep→Amazon se registran en USD.</div>'+
      '</div></details>'+
      '<details class="jev-details" id="jev_returns"><summary>Devoluciones Amazon</summary><div class="jev-details-body">'+
        '<div class="two">'+fnum("jev_return_rate","Tasa esperada de devolución","%","No asumir 0% si no está verificado.")+fnum("jev_resellable","% esperado revendible","%","")+'</div>'+
        fnum("jev_removal","Removal cost por unidad","US$","")+
        '<div class="two">'+fnum("jev_return_prep","Prep de devolución por unidad","US$","")+fnum("jev_resend","Reenvío a Amazon por unidad","US$","")+'</div>'+
        '<div class="hint">Estos datos quedan preparados para Financial/Risk Score. Todavía no inventamos una pérdida total por devolución.</div>'+
      '</div></details>';
    p2.parentNode.insertBefore(box,p2.nextSibling);

    var pre=$("jev_precheck");
    if(pre&&!$("jev_capital_summary")){
      var card=document.createElement("div");card.id="jev_capital_summary";card.className="card jev-phase3-summary";
      pre.parentNode.insertBefore(card,pre.nextSibling);
    }
  }

  function hydrate(){
    var c=state.costs.checkout,p=state.costs.prep,r=state.returns;
    set("jev_displayed",c.displayedUnit);set("jev_discount",c.discountUnit);set("jev_tax",c.taxUnit);set("jev_supplier_prep",c.supplierToPrepLot);
    set("jev_prep_unit",p.prepUnit);set("jev_prep_other",p.otherPrepLot);set("jev_prep_amazon",p.prepToAmazonLot);
    set("jev_return_rate",r.returnRateExpected);set("jev_resellable",r.resellablePct);set("jev_removal",r.removalCostUnit);set("jev_return_prep",r.prepReturnCostUnit);set("jev_resend",r.resendCostUnit);
  }

  function persist(){
    var c=state.costs.checkout,p=state.costs.prep,r=state.returns;
    c.displayedUnit=n("jev_displayed");c.discountUnit=n("jev_discount");if(c.discountUnit===null)c.discountUnit=0;
    c.taxUnit=n("jev_tax");c.supplierToPrepLot=n("jev_supplier_prep");
    p.prepUnit=n("jev_prep_unit");p.otherPrepLot=n("jev_prep_other");if(p.otherPrepLot===null)p.otherPrepLot=0;p.prepToAmazonLot=n("jev_prep_amazon");
    r.returnRateExpected=n("jev_return_rate");r.resellablePct=n("jev_resellable");r.removalCostUnit=n("jev_removal");r.prepReturnCostUnit=n("jev_return_prep");r.resendCostUnit=n("jev_resend");
    save();render();
  }

  function bind(){
    ["jev_displayed","jev_discount","jev_tax","jev_supplier_prep","jev_prep_unit","jev_prep_other","jev_prep_amazon","jev_return_rate","jev_resellable","jev_removal","jev_return_prep","jev_resend"].forEach(function(id){
      var el=$(id);if(!el)return;el.addEventListener("input",persist);el.addEventListener("change",persist);
    });
    ["p_unid","p_presu","p_moneda","p_tc"].forEach(function(id){var el=$(id);if(el){el.addEventListener("input",render);el.addEventListener("change",render)}});
  }

  function calc(){
    var c=state.costs.checkout,p=state.costs.prep;
    var units=Math.max(0,Math.round(Number(val("p_unid"))||0));
    var budget=Number(val("p_presu"))||0;
    var currency=val("p_moneda")||"USD";
    var rate=currency==="USD"?1:(Number(val("p_tc"))||0);
    var missing=[];
    if(c.displayedUnit===null)missing.push("precio mostrado");
    if(c.taxUnit===null)missing.push("impuesto");
    if(c.supplierToPrepLot===null)missing.push("flete proveedor→Prep");
    if(p.prepUnit===null)missing.push("Prep Center/u");
    if(p.prepToAmazonLot===null)missing.push("flete Prep→Amazon");
    if(units<=0)missing.push("unidades");
    if(rate<=0)missing.push("tipo de cambio");

    var checkoutPurchase=null,checkoutUSD=null,landed=null,pilot=null,exposure=null;
    if(c.displayedUnit!==null&&c.taxUnit!==null&&rate>0){
      checkoutPurchase=Math.max(0,Number(c.displayedUnit)-Number(c.discountUnit||0)+Number(c.taxUnit));
      checkoutUSD=checkoutPurchase/rate;
    }
    if(checkoutUSD!==null&&units>0&&c.supplierToPrepLot!==null&&p.prepUnit!==null&&p.prepToAmazonLot!==null){
      landed=checkoutUSD+(Number(c.supplierToPrepLot)/rate/units)+Number(p.prepUnit)+(Number(p.otherPrepLot||0)/units)+(Number(p.prepToAmazonLot)/units);
      pilot=landed*units;
      exposure=budget>0?pilot/budget:null;
    }
    return {units:units,budget:budget,currency:currency,rate:rate,missing:missing,checkoutPurchase:checkoutPurchase,checkoutUSD:checkoutUSD,landed:landed,pilot:pilot,exposure:exposure};
  }

  function returnsStatus(){
    var r=state.returns;
    var vals=[r.returnRateExpected,r.resellablePct,r.removalCostUnit,r.prepReturnCostUnit,r.resendCostUnit];
    var filled=vals.filter(function(x){return x!==null&&x!==undefined}).length;
    return filled===0?"NO VERIFICADO":(filled===vals.length?"COMPLETO":"PARCIAL");
  }

  function render(){
    var card=$("jev_capital_summary");if(!card)return;
    var x=calc(),stage=state.product&&state.product.stage||"CANDIDATO",warnings=[];
    if(x.units>5&&stage==="CANDIDATO")warnings.push("Producto nuevo: "+x.units+" unidades exceden el piloto inicial máximo de 5.");
    if(x.exposure!==null&&x.exposure>1)warnings.push("El capital del lote supera el presupuesto disponible.");
    else if(x.exposure!==null&&x.exposure>0.35)warnings.push("Exposición alta para un producto todavía no validado; el Motor Scoring la evaluará con Capital Efficiency.");
    if(x.missing.length)warnings.push("Costo real incompleto: falta "+x.missing.join(", ")+".");
    var rs=returnsStatus();if(rs!=="COMPLETO")warnings.push("Datos de devoluciones Amazon: "+rs+".");

    card.innerHTML='<div class="cardtitle">Capital antes de vender · JEV</div>'+
      '<div class="jev-phase3-grid">'+
        '<div class="jev-phase3-metric"><div class="k">Checkout / unidad</div><div class="v">'+(x.checkoutUSD===null?'INCOMPLETO':money(x.checkoutUSD))+'</div></div>'+
        '<div class="jev-phase3-metric"><div class="k">Landed cost / unidad</div><div class="v">'+(x.landed===null?'INCOMPLETO':money(x.landed))+'</div></div>'+
        '<div class="jev-phase3-metric"><div class="k">Capital lote</div><div class="v">'+(x.pilot===null?'INCOMPLETO':money(x.pilot))+'</div></div>'+
        '<div class="jev-phase3-metric"><div class="k">Exposición presupuesto</div><div class="v">'+(x.exposure===null?'—':pct(x.exposure))+'</div></div>'+
      '</div>'+
      '<div class="hint">Checkout en '+x.currency+' convertido a USD · Prep y envío a Amazon en USD · devoluciones: '+rs+'</div>'+
      warnings.map(function(w,i){return '<div class="jev-phase3-warning'+(x.exposure!==null&&x.exposure>1&&i===0?' jev-phase3-bad':'')+'">'+w+'</div>'}).join("");
  }

  function loadPhase4(){if($("jev-phase4-script"))return;var s=document.createElement("script");s.id="jev-phase4-script";s.src="jev-phase4-market.js";document.body.appendChild(s)}
  function init(){
    if(!$("jev_phase2"))return;
    injectStyles();buildUI();hydrate();bind();render();
    var eyebrow=document.querySelector(".eyebrow");if(eyebrow)eyebrow.textContent="CALCULADOR AMAZON COMPUESTO · MOTOR SCORING v1 · FASE 3";
    loadPhase4();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(init,0)});else setTimeout(init,0);
})();
