(function(){
  "use strict";
  var KEY="jev_v1";
  function $(id){return document.getElementById(id)}
  function load(){
    var s={};try{s=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){s={}}
    if(!s||typeof s!=="object")s={};
    if(!s.verification)s.verification={};
    if(!s.verification.productMatch)s.verification.productMatch={status:"NO VERIFICADO",checkedAt:null,note:""};
    if(!s.verification.brandPolicy)s.verification.brandPolicy={status:"NO VERIFICADA",source:"",checkedAt:null};
    if(!s.verification.supply)s.verification.supply={type:"RETAILER",supplierName:"",purchaseUrl:"",authenticity:"NO VERIFICADA",documentType:"RECIBO RETAIL"};
    if(!s.verification.exitPlan)s.verification.exitPlan={returnAllowed:"NO VERIFICADO",returnWindowDays:null,restockingFeePct:0,returnShippingPaidBy:"NO VERIFICADO",finalSale:"NO VERIFICADO",notes:""};
    if(!s.returns)s.returns={returnRateExpected:null,resellablePct:null,removalCostUnit:null,prepReturnCostUnit:null,resendCostUnit:null};
    return s;
  }
  var state=load();
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}

  function injectStyles(){
    if($("jev-phase2-style"))return;
    var st=document.createElement("style");st.id="jev-phase2-style";
    st.textContent=
      ".jev-details{border:1px solid var(--lineStrong);background:#fff;margin:0 0 12px}"+
      ".jev-details summary{cursor:pointer;padding:11px 12px;font-size:12.5px;color:var(--deep);font-weight:600;list-style:none}"+
      ".jev-details summary::-webkit-details-marker{display:none}"+
      ".jev-details summary:after{content:'+';float:right;font-family:var(--mono)}"+
      ".jev-details[open] summary:after{content:'−'}"+
      ".jev-details-body{padding:2px 12px 12px;border-top:1px solid var(--line)}"+
      ".jev-precheck{margin:0 0 14px;padding-bottom:8px}"+
      ".jev-precheck-row{display:grid;grid-template-columns:minmax(115px,.8fr) 1.4fr;gap:12px;padding:7px 0;border-bottom:1px solid var(--line);font-size:12.5px}"+
      ".jev-precheck-row .k{color:var(--muted)}.jev-precheck-row .v{font-family:var(--mono);font-size:12px}"+
      ".jev-precheck-result{margin-top:10px;padding:10px 11px;border-left:4px solid var(--deep);background:#f6f8f8}"+
      ".jev-precheck-result.good{border-left-color:var(--good);background:var(--goodBg)}"+
      ".jev-precheck-result.warn{border-left-color:var(--warn);background:var(--warnBg)}"+
      ".jev-precheck-result.bad{border-left-color:var(--bad);background:var(--badBg)}"+
      ".jev-precheck-result .d{font-family:var(--mono);font-size:16px;font-weight:600}"+
      ".jev-precheck-result .r{font-size:12px;margin-top:4px;color:var(--ink2)}"+
      ".jev-warnings{font-size:11.5px;color:var(--ink2);margin-top:8px;line-height:1.55}"+
      ".jev-financial-reference{font-size:11.5px;color:var(--muted);margin:-2px 0 12px;line-height:1.5}"+
      "@media(max-width:520px){.jev-precheck-row{grid-template-columns:1fr;gap:2px}}";
    document.head.appendChild(st);
  }

  function sel(id,label,opts,hint){return '<label class="f"><div class="flabel">'+label+'</div><select id="'+id+'">'+opts.map(function(o){return '<option value="'+o+'">'+o+'</option>'}).join("")+'</select>'+(hint?'<div class="hint">'+hint+'</div>':'')+'</label>'}
  function txt(id,label,ph){return '<label class="f"><div class="flabel">'+label+'</div><div class="fbox"><input id="'+id+'" type="text" autocomplete="off"'+(ph?' placeholder="'+ph+'"':'')+'></div></label>'}
  function numf(id,label,suffix){return '<label class="f"><div class="flabel">'+label+'</div><div class="fbox"><input id="'+id+'" type="number" inputmode="decimal" step="0.01">'+(suffix?'<span class="fix">'+suffix+'</span>':'')+'</div></label>'}

  function buildUI(){
    var identity=$("jev_identity");if(!identity||$("jev_phase2"))return;
    var box=document.createElement("div");box.id="jev_phase2";
    box.innerHTML=
      '<details class="jev-details" id="jev_brand_source"><summary>Marca y fuente</summary><div class="jev-details-body">'+
        '<div class="sect">Match exacto producto ↔ ASIN</div>'+sel("jev_match","Estado del match",["NO VERIFICADO","MATCH CONFIRMADO","MATCH DUDOSO","NO COINCIDE"],"Confirma UPC/EAN, marca, modelo, tamaño, variante y pack.")+txt("jev_match_note","Nota del match","Ej. pack de 2 confirmado")+
        '<div class="sect">Política de marca</div>'+sel("jev_brand_policy","Estado",["NO VERIFICADA","SIN PROHIBICIÓN ENCONTRADA","AUTORIZACIÓN EXPLÍCITA","RESTRICCIÓN EXPLÍCITA AMAZON"],"Sin prohibición encontrada no equivale a autorización.")+txt("jev_brand_source_note","Fuente / URL / nota de verificación","Página oficial, correo, política, etc.")+
        '<div class="sect">Fuente / supply chain</div>'+sel("jev_supply_type","Tipo de fuente",["RETAILER","DISTRIBUIDOR","MARCA DIRECTA","OTRO"],"")+txt("jev_supplier_name","Proveedor / retailer","Ej. Costco")+txt("jev_purchase_url","URL / referencia de compra","")+sel("jev_authenticity","Autenticidad / trazabilidad",["NO VERIFICADA","RAZONABLE","VERIFICADA","DUDOSA"],"Retailer conocido no significa automáticamente documento aceptado por Amazon.")+sel("jev_document","Documento disponible",["RECIBO RETAIL","FACTURA COMERCIAL","ORDEN / COMPROBANTE","OTRO","NINGUNO"],"")+
      '</div></details>'+
      '<details class="jev-details" id="jev_exit"><summary>Plan de salida</summary><div class="jev-details-body">'+
        sel("jev_return_allowed","¿Permite devolución?",["NO VERIFICADO","SÍ","NO"],"")+
        '<div class="two">'+numf("jev_return_window","Ventana de devolución","días")+numf("jev_restock","Restocking fee","%")+'</div>'+
        sel("jev_return_shipping","¿Quién paga retorno?",["NO VERIFICADO","PROVEEDOR","NOSOTROS","NO APLICA"],"")+sel("jev_final_sale","¿Final sale?",["NO VERIFICADO","NO","SÍ"],"Final sale aumenta riesgo, pero no descarta automáticamente.")+txt("jev_exit_notes","Notas del plan de salida","")+
      '</div></details>';
    identity.parentNode.insertBefore(box,identity.nextSibling);
    var gate=$("jev_gate");if(gate&&!$("jev_precheck")){var pre=document.createElement("div");pre.id="jev_precheck";pre.className="card jev-precheck";gate.parentNode.insertBefore(pre,gate.nextSibling)}
  }

  function setv(id,v){var el=$(id);if(el)el.value=(v===null||v===undefined)?"":String(v)}
  function hydrate(){
    var v=state.verification;
    setv("jev_match",v.productMatch.status);setv("jev_match_note",v.productMatch.note);setv("jev_brand_policy",v.brandPolicy.status);setv("jev_brand_source_note",v.brandPolicy.source);
    setv("jev_supply_type",v.supply.type);setv("jev_supplier_name",v.supply.supplierName);setv("jev_purchase_url",v.supply.purchaseUrl);setv("jev_authenticity",v.supply.authenticity);setv("jev_document",v.supply.documentType);
    setv("jev_return_allowed",v.exitPlan.returnAllowed);setv("jev_return_window",v.exitPlan.returnWindowDays);setv("jev_restock",v.exitPlan.restockingFeePct);setv("jev_return_shipping",v.exitPlan.returnShippingPaidBy);setv("jev_final_sale",v.exitPlan.finalSale);setv("jev_exit_notes",v.exitPlan.notes);
  }
  function value(id){var el=$(id);return el?el.value:""} function nvalue(id){var v=value(id);return v===""?null:Number(v)}
  function persist(){
    state=load();
    var v=state.verification;
    v.productMatch.status=value("jev_match")||"NO VERIFICADO";v.productMatch.note=value("jev_match_note").trim();v.productMatch.checkedAt=v.productMatch.status==="NO VERIFICADO"?null:new Date().toISOString();
    v.brandPolicy.status=value("jev_brand_policy")||"NO VERIFICADA";v.brandPolicy.source=value("jev_brand_source_note").trim();v.brandPolicy.checkedAt=v.brandPolicy.status==="NO VERIFICADA"?null:new Date().toISOString();
    v.supply.type=value("jev_supply_type")||"RETAILER";v.supply.supplierName=value("jev_supplier_name").trim();v.supply.purchaseUrl=value("jev_purchase_url").trim();v.supply.authenticity=value("jev_authenticity")||"NO VERIFICADA";v.supply.documentType=value("jev_document")||"RECIBO RETAIL";
    v.exitPlan.returnAllowed=value("jev_return_allowed")||"NO VERIFICADO";v.exitPlan.returnWindowDays=nvalue("jev_return_window");v.exitPlan.restockingFeePct=nvalue("jev_restock");if(v.exitPlan.restockingFeePct===null)v.exitPlan.restockingFeePct=0;v.exitPlan.returnShippingPaidBy=value("jev_return_shipping")||"NO VERIFICADO";v.exitPlan.finalSale=value("jev_final_sale")||"NO VERIFICADO";v.exitPlan.notes=value("jev_exit_notes").trim();
    save();render();
  }
  function bind(){
    ["jev_match","jev_match_note","jev_brand_policy","jev_brand_source_note","jev_supply_type","jev_supplier_name","jev_purchase_url","jev_authenticity","jev_document","jev_return_allowed","jev_return_window","jev_restock","jev_return_shipping","jev_final_sale","jev_exit_notes"].forEach(function(id){var el=$(id);if(el){el.addEventListener("input",persist);el.addEventListener("change",persist)}});
    var elig=$("jev_eligibility");if(elig)elig.addEventListener("change",function(){setTimeout(render,0)});
  }
  function eligibility(){var el=$("jev_eligibility");if(el)return el.value;try{var s=JSON.parse(localStorage.getItem(KEY)||"{}");return s.eligibility&&s.eligibility.status||"NO VERIFICADO"}catch(e){return "NO VERIFICADO"}}

  function evaluate(){
    var v=state.verification,e=eligibility(),w=[],r={decision:"PUEDE CONTINUAR",tone:"good",reason:"Pre-check suficiente para continuar al análisis."};
    if(e==="NO AUTORIZADO")return{decision:"DESCARTAR",tone:"bad",reason:"Amazon no autoriza la venta en tu cuenta.",warnings:w};
    if(e==="NO VERIFICADO")return{decision:"ESPERAR",tone:"warn",reason:"Falta verificar elegibilidad Amazon.",warnings:w};
    if(e==="REQUIERE APROBACIÓN")return{decision:"ESPERAR",tone:"warn",reason:"La aprobación de Amazon sigue pendiente.",warnings:w};
    if(v.productMatch.status==="NO COINCIDE")return{decision:"DESCARTAR",tone:"bad",reason:"El producto no coincide con este ASIN/listing.",warnings:w};
    if(v.productMatch.status==="MATCH DUDOSO"||v.productMatch.status==="NO VERIFICADO")return{decision:"ESPERAR",tone:"warn",reason:"Confirma el match exacto del producto antes de comprar.",warnings:w};
    if(v.brandPolicy.status==="RESTRICCIÓN EXPLÍCITA AMAZON")return{decision:"DESCARTAR",tone:"bad",reason:"La marca restringe explícitamente la venta en Amazon.",warnings:w};
    if(v.supply.authenticity==="DUDOSA")return{decision:"ESPERAR",tone:"warn",reason:"La autenticidad o el origen requieren aclaración.",warnings:w};
    if(v.brandPolicy.status==="NO VERIFICADA")w.push("Política de marca no verificada.");
    if(v.brandPolicy.status==="SIN PROHIBICIÓN ENCONTRADA")w.push("No se encontró prohibición, pero eso no equivale a autorización de la marca.");
    if(v.supply.authenticity==="NO VERIFICADA")w.push("Origen/documentación todavía no verificados.");
    if(v.supply.documentType==="NINGUNO")w.push("No hay documento de compra registrado.");
    if(v.exitPlan.returnAllowed==="NO")w.push("El proveedor no admite devolución.");
    if(v.exitPlan.finalSale==="SÍ")w.push("Compra marcada como final sale.");
    if(v.exitPlan.returnAllowed==="NO VERIFICADO")w.push("Política de devolución no verificada.");
    if(v.exitPlan.finalSale==="NO VERIFICADO")w.push("Estado final sale no verificado.");
    if(w.length){r.decision="PUEDE CONTINUAR CON ADVERTENCIAS";r.tone="warn";r.reason="No hay un bloqueo estructural, pero estas incertidumbres reducirán Data Confidence y/o el tamaño del piloto."}r.warnings=w;return r;
  }
  function exitSummary(){var e=state.verification.exitPlan;if(e.returnAllowed==="SÍ"){var s=e.returnWindowDays!==null?e.returnWindowDays+" días":"devolución permitida";s+=Number(e.restockingFeePct)>0?" · restocking "+Number(e.restockingFeePct).toFixed(1)+"%":" · sin restocking registrado";return s}if(e.returnAllowed==="NO")return "SIN DEVOLUCIÓN"+(e.finalSale==="SÍ"?" · FINAL SALE":"");return "NO VERIFICADO"}

  function syncFinancialDisplay(r){
    var out=$("p_out");if(!out)return;var verdict=out.querySelector(".verdict"),blocked=r.decision==="ESPERAR"||r.decision==="DESCARTAR";if(verdict)verdict.style.display=blocked?"none":"";
    var note=$("jev_financial_reference");if(blocked&&!note){note=document.createElement("div");note.id="jev_financial_reference";note.className="jev-financial-reference";note.textContent="Métricas financieras visibles solo como referencia. El PRE-CHECK debe superarse antes de interpretar un veredicto económico.";out.insertBefore(note,out.firstChild)}else if(!blocked&&note)note.remove();
  }
  function render(){
    var pre=$("jev_precheck");if(!pre)return;var v=state.verification,r=evaluate(),supply=v.supply.type+" · "+v.supply.authenticity;
    pre.innerHTML='<div class="cardtitle">Pre-check · antes del análisis económico</div>'+['Elegibilidad|'+eligibility(),'Match ASIN|'+v.productMatch.status,'Marca|'+v.brandPolicy.status,'Fuente|'+supply,'Plan de salida|'+exitSummary()].map(function(x){var p=x.split('|');return '<div class="jev-precheck-row"><div class="k">'+p[0]+'</div><div class="v">'+p.slice(1).join('|')+'</div></div>'}).join("")+'<div class="jev-precheck-result '+r.tone+'"><div class="d">'+r.decision+'</div><div class="r">'+r.reason+'</div></div>'+(r.warnings&&r.warnings.length?'<div class="jev-warnings">• '+r.warnings.join('<br>• ')+'</div>':'');syncFinancialDisplay(r);
  }

  function loadPhase3(){if($("jev-phase3-script"))return;var s=document.createElement("script");s.id="jev-phase3-script";s.src="jev-phase3.js";document.body.appendChild(s)}
  function init(){
    if(!$("jev_identity"))return;injectStyles();buildUI();hydrate();bind();render();
    var out=$("p_out");if(out&&window.MutationObserver)new MutationObserver(function(){syncFinancialDisplay(evaluate())}).observe(out,{childList:true,subtree:true});
    var eyebrow=document.querySelector(".eyebrow");if(eyebrow)eyebrow.textContent="CALCULADOR AMAZON COMPUESTO · MOTOR SCORING v1 · FASE 2";
    loadPhase3();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(init,0)});else setTimeout(init,0);
})();
