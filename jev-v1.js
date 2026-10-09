(function(){
  "use strict";

  var KEY = "jev_v1";
  var CATALOG_KEY = "motor_scoring_asin_v1";
  var activeAsin = "";
  var DEFAULT_STATE = {
    version: 1,
    product: {
      asin: "",
      upcEan: "",
      brand: "",
      category: "",
      marketplace: "US",
      condition: "NEW",
      stage: "CANDIDATO"
    },
    eligibility: {
      status: "NO VERIFICADO",
      source: "MANUAL",
      checkedAt: null
    },
    financial: {},
    market: {},
    risk: {},
    rotation: {},
    capitalEfficiency: {},
    dataConfidence: {},
    decision: {}
  };

  function cloneDefault(){ return JSON.parse(JSON.stringify(DEFAULT_STATE)); }
  function $(id){ return document.getElementById(id); }

  function readCatalog(){try{var x=JSON.parse(localStorage.getItem(CATALOG_KEY)||"{}");return x&&typeof x==="object"?x:{}}catch(e){return {}}}
  function writeCatalog(x){try{localStorage.setItem(CATALOG_KEY,JSON.stringify(x));return true}catch(e){return false}}
  function normalizeAsin(v){return String(v||"").trim().toUpperCase()}
  // Product inputs travel with the ASIN; account capital and payment settings stay shared.
  var GLOBAL_INPUTS=["p_presu","p_plan","c_corte1","c_corte2","c_banco"];
  function financialInputs(){var values={};(window.IDS||[]).forEach(function(id){var field=$(id);if(field)values[id]=field.value});return values}
  function archiveActive(){var asin=normalizeAsin(activeAsin||state.product.asin);if(!asin)return true;try{var current=JSON.parse(localStorage.getItem(KEY)||"{}")||{};current.product=current.product||{};current.product.asin=asin;var cat=readCatalog();cat[asin]={asin:asin,updatedAt:new Date().toISOString(),state:current,inputs:financialInputs()};return writeCatalog(cat)}catch(e){return false}}
  function switchAsin(asin){
    asin=normalizeAsin(asin);
    if(!asin||asin===activeAsin){$("jev_asin").value=activeAsin;return}
    if(!archiveActive()){ $("jev_asin").value=activeAsin;alert("No se pudo guardar el producto actual. No se cambió de ASIN.");return }
    var previous=localStorage.getItem(KEY),previousInputs=localStorage.getItem("fba_v2"),current;
    try{
      current=JSON.parse(previous||"{}");
      var rec=readCatalog()[asin],next=rec&&rec.state?JSON.parse(JSON.stringify(rec.state)):cloneDefault();
      next.product=next.product||{};next.product.asin=asin;
      next.capital=JSON.parse(JSON.stringify(current.capital||{}));
      var inputs=Object.assign({},window.DEF||{}),shared=financialInputs();
      // Old catalog records have no input snapshot; never borrow the preceding ASIN's price.
      inputs.p_precio="";inputs.p_cogs="";inputs.p_flete="";inputs.p_unid="1";
      if(rec&&rec.inputs)Object.keys(inputs).forEach(function(id){if(GLOBAL_INPUTS.indexOf(id)<0&&rec.inputs[id]!==undefined)inputs[id]=rec.inputs[id]});
      GLOBAL_INPUTS.forEach(function(id){if(shared[id]!==undefined)inputs[id]=shared[id]});
      localStorage.setItem("fba_v2",JSON.stringify(inputs));
      localStorage.setItem(KEY,JSON.stringify(next));
    }catch(e){
      try{if(previousInputs===null)localStorage.removeItem("fba_v2");else localStorage.setItem("fba_v2",previousInputs);if(previous===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,previous)}catch(restoreError){}
      $("jev_asin").value=activeAsin;alert("No se pudo cargar el otro ASIN. Se conserva el producto actual.");return;
    }
    state=loadState();activeAsin=asin;window.location.reload();
  }

  function loadState(){
    var state = cloneDefault();
    try{
      var saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if(saved && typeof saved === "object"){
        state.version = saved.version || 1;
        if(saved.product) Object.assign(state.product, saved.product);
        if(saved.eligibility) Object.assign(state.eligibility, saved.eligibility);
        ["financial","market","risk","rotation","capitalEfficiency","dataConfidence","decision"].forEach(function(k){
          if(saved[k] && typeof saved[k] === "object") state[k] = saved[k];
        });
      }
    }catch(e){}
    return state;
  }

  var state = loadState();

  function saveState(){
    try{ var latest=JSON.parse(localStorage.getItem(KEY)||"{}")||{}; latest.version=state.version||1; latest.product=Object.assign({},latest.product||{},state.product||{}); latest.eligibility=Object.assign({},latest.eligibility||{},state.eligibility||{}); localStorage.setItem(KEY,JSON.stringify(latest)); }catch(e){}
  }

  function injectStyles(){
    if($("jev-style")) return;
    var style = document.createElement("style");
    style.id = "jev-style";
    style.textContent =
      ".jev-block{margin-bottom:18px}"+
      ".jev-summary{margin-top:2px;margin-bottom:18px;border-width:1.5px}"+
      ".jev-summary.good{background:var(--goodBg);border-color:var(--good);color:var(--good)}"+
      ".jev-summary.warn{background:var(--warnBg);border-color:var(--warn);color:var(--warn)}"+
      ".jev-summary.bad{background:var(--badBg);border-color:var(--bad);color:var(--bad)}"+
      ".jev-summary strong{font-family:var(--mono);font-weight:600}"+
      ".jev-gate .jev-sub{font-size:12.5px;line-height:1.5;margin-top:7px;font-family:var(--sans);letter-spacing:0}"+
      ".jev-gate .jev-meta{font-size:11px;margin-top:5px;opacity:.82;font-family:var(--sans)}"+
      ".jev-right{min-width:0}"+
      ".jev-disabled-note{font-size:12.5px;color:var(--ink2);margin:-5px 0 14px;padding:9px 11px;border-left:3px solid var(--warn);background:var(--warnBg)}";
    document.head.appendChild(style);
  }

  function buildIdentityUI(){
    var left = document.querySelector("#p-prod .grid > div:first-child");
    if(!left || $("jev_identity")) return;

    var block = document.createElement("div");
    block.id = "jev_identity";
    block.className = "jev-block";
    block.innerHTML =
      '<div class="sect">Identificación y elegibilidad</div>'+
      '<label class="f"><div class="flabel">ASIN</div><div class="fbox"><input id="jev_asin" type="text" autocomplete="off" placeholder="Ej. B0XXXXXXXX"></div></label>'+
      '<label class="f"><div class="flabel">UPC / EAN</div><div class="fbox"><input id="jev_upc" type="text" inputmode="numeric" autocomplete="off"></div></label>'+
      '<div class="two">'+
        '<label class="f"><div class="flabel">Marca</div><div class="fbox"><input id="jev_brand" type="text" autocomplete="off"></div></label>'+
        '<label class="f"><div class="flabel">Categoría</div><div class="fbox"><input id="jev_category" type="text" autocomplete="off"></div></label>'+
      '</div>'+
      '<div class="two">'+
        '<label class="f"><div class="flabel">Marketplace</div><select id="jev_marketplace"><option value="US">Amazon.com · US</option><option value="CA">Amazon.ca · CA</option><option value="MX">Amazon.com.mx · MX</option></select></label>'+
        '<label class="f"><div class="flabel">Condición</div><select id="jev_condition"><option value="NEW">Nuevo</option><option value="USED">Usado</option></select></label>'+
      '</div>'+
      '<label class="f"><div class="flabel">Elegibilidad Amazon</div><select id="jev_eligibility">'+
        '<option value="NO VERIFICADO">NO VERIFICADO</option>'+
        '<option value="AUTORIZADO">AUTORIZADO</option>'+
        '<option value="REQUIERE APROBACIÓN">REQUIERE APROBACIÓN</option>'+
        '<option value="NO AUTORIZADO">NO AUTORIZADO</option>'+
      '</select><div class="hint">Debe reflejar el estado real de tu cuenta de vendedor para este producto.</div></label>'+
      '<div id="jev_summary" class="note jev-summary"></div>';

    left.insertBefore(block, left.firstChild);
  }

  function buildGateUI(){
    var out = $("p_out");
    if(!out || $("jev_gate")) return;
    var parent = out.parentNode;
    var wrapper = document.createElement("div");
    wrapper.className = "jev-right";
    wrapper.id = "jev_right";
    parent.insertBefore(wrapper, out);
    var purchases=$("p-purchases");
    if(purchases)purchases.appendChild(out);else wrapper.appendChild(out);

    var gate = document.createElement("div");
    gate.id = "jev_gate";
    gate.className = "jev-gate";
    wrapper.insertBefore(gate, wrapper.firstChild);
  }

  function hydrateFields(){
    $("jev_asin").value = state.product.asin || "";
    $("jev_upc").value = state.product.upcEan || "";
    $("jev_brand").value = state.product.brand || "";
    $("jev_category").value = state.product.category || "";
    $("jev_marketplace").value = state.product.marketplace || "US";
    $("jev_condition").value = state.product.condition || "NEW";
    $("jev_eligibility").value = state.eligibility.status || "NO VERIFICADO";
  }

  function bindFields(){
    ["jev_upc","jev_brand","jev_category","jev_marketplace","jev_condition"].forEach(function(id){
      $(id).addEventListener("input", persistProduct);
      $(id).addEventListener("change", persistProduct);
    });
    $("jev_asin").addEventListener("change",function(){switchAsin(this.value)});
    $("jev_asin").addEventListener("blur",function(){switchAsin(this.value)});
    $("jev_eligibility").addEventListener("change", function(){
      state.eligibility.status = this.value;
      state.eligibility.source = "MANUAL";
      state.eligibility.checkedAt = this.value === "NO VERIFICADO" ? null : new Date().toISOString();
      saveState();
      archiveActive();
      renderEligibility();
      window.dispatchEvent(new CustomEvent("motor-scoring-state-changed",{detail:{field:"eligibility",status:this.value}}));
    });
  }

  function persistProduct(){
    state.product.asin = activeAsin;
    state.product.upcEan = $("jev_upc").value.trim();
    state.product.brand = $("jev_brand").value.trim();
    state.product.category = $("jev_category").value.trim();
    state.product.marketplace = $("jev_marketplace").value;
    state.product.condition = $("jev_condition").value;
    if(!state.product.stage) state.product.stage = "CANDIDATO";
    saveState();
    activeAsin=normalizeAsin(state.product.asin);
    archiveActive();
  }

  function eligibilityInfo(status){
    if(status === "AUTORIZADO") return {
      tone:"good", decision:"AUTORIZADO",
      summary:"Puede continuar al análisis.",
      detail:"La puerta de elegibilidad está superada. Esto no significa que el Motor Scoring recomiende comprar: aún faltan mercado, riesgo y capital."
    };
    if(status === "NO AUTORIZADO") return {
      tone:"bad", decision:"DESCARTAR",
      summary:"No comprar este producto.",
      detail:"Amazon no autoriza la venta de este producto en tu cuenta. La elegibilidad prevalece aunque los números financieros sean atractivos."
    };
    if(status === "REQUIERE APROBACIÓN") return {
      tone:"warn", decision:"ESPERAR",
      summary:"Esperar aprobación antes de comprar.",
      detail:"No comprar inventario mientras la aprobación esté pendiente. Si Amazon aprueba, cambia el estado a AUTORIZADO."
    };
    return {
      tone:"warn", decision:"ESPERAR",
      summary:"Verificar elegibilidad antes de comprar.",
      detail:"Todavía no sabemos si tu cuenta puede vender este producto. El Motor Scoring no emitirá una recomendación de compra con este dato sin verificar."
    };
  }

  function renderEligibility(){
    var status = state.eligibility.status || "NO VERIFICADO";
    var info = eligibilityInfo(status);
    var summary = $("jev_summary");
    var gate = $("jev_gate");
    if(summary){
      summary.className = "note jev-summary "+info.tone;
      summary.innerHTML = '<strong>'+status+'</strong> · '+info.summary;
    }
    if(gate){
      var checked = state.eligibility.checkedAt ? new Date(state.eligibility.checkedAt).toLocaleString("es-CL") : "sin verificar";
      gate.innerHTML =
        '<div class="verdict '+info.tone+'">'+
          '<div class="l">Puerta obligatoria · Elegibilidad Amazon</div>'+
          '<div class="v">'+info.decision+'</div>'+
          '<div class="jev-sub">'+info.detail+'</div>'+
          '<div class="jev-meta">Estado: '+status+' · Fuente: MANUAL · '+checked+'</div>'+
        '</div>'+
        (status === "AUTORIZADO" ? "" : '<div class="jev-disabled-note">El análisis financiero puede consultarse, pero no habilita una compra mientras esta puerta esté bloqueada.</div>');
    }
    decorateArithmetic();
  }

  function decorateArithmetic(){
    var out = $("p_out");
    if(!out) return;
    var verdict = out.querySelector(".verdict");
    if(!verdict) return;
    if($("p-purchases")){verdict.style.display="none";return}
    var label = verdict.querySelector(".l");
    var value = verdict.querySelector(".v");
    var status = state.eligibility.status || "NO VERIFICADO";

    if(!verdict.dataset.jevOriginalClass) verdict.dataset.jevOriginalClass = verdict.className;
    if(value && !verdict.dataset.jevOriginalValue) verdict.dataset.jevOriginalValue = value.textContent;

    if(status !== "AUTORIZADO"){
      verdict.className = "verdict warn";
      if(label && label.textContent !== "Análisis financiero · solo informativo"){
        label.textContent = "Análisis financiero · solo informativo";
      }
      if(value && value.textContent !== "SIN DECISIÓN") value.textContent = "SIN DECISIÓN";
    }else{
      verdict.className = verdict.dataset.jevOriginalClass || verdict.className;
      if(label && label.textContent !== "Resultado aritmético · aún no es decisión JEV"){
        label.textContent = "Resultado aritmético · aún no es decisión JEV";
      }
      if(value && verdict.dataset.jevOriginalValue && value.textContent !== verdict.dataset.jevOriginalValue){
        value.textContent = verdict.dataset.jevOriginalValue;
      }
    }
  }

  function observeFinancialOutput(){
    var out = $("p_out");
    if(!out || !window.MutationObserver) return;
    var observer = new MutationObserver(function(){
      decorateArithmetic();
    });
    observer.observe(out, {childList:true, subtree:true});
  }

  function loadFinancialSync(){
    if(document.getElementById("jev-financial-sync-loader")) return;
    var s=document.createElement("script");
    s.id="jev-financial-sync-loader";
    s.src="jev-financial-sync.js?v=55";
    s.async=true;
    document.body.appendChild(s);
  }

  function init(){
    if(!document.querySelector("#p-prod .grid")) return;
    injectStyles();
    buildIdentityUI();
    buildGateUI();
    hydrateFields();
    activeAsin=normalizeAsin(state.product.asin);
    archiveActive();
    bindFields();
    renderEligibility();
    observeFinancialOutput();
    loadFinancialSync();

    var eyebrow = document.querySelector(".eyebrow");
    if(eyebrow) eyebrow.textContent = "CALCULADOR AMAZON COMPUESTO · MOTOR SCORING v1 · FASE 1";
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
