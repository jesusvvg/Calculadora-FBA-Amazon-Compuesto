(function(){
  "use strict";

  var BACKUP_SCHEMA="calculador-amazon-compuesto-backup-v1";
  var SCANNER_SCHEMA="amazon-sourcing-scanner-prospect-v1";
  var JEVI_KEY="jev_v1";
  var CATALOG_KEY="motor_scoring_asin_v1";
  var FBA_KEY="fba_v2";
  var ALLOWED_EXACT=[FBA_KEY,JEVI_KEY,CATALOG_KEY,"amazon_compuesto_operations_v1"];
  var ALLOWED_PREFIXES=["fba_","jev_","motor_scoring_","amazon_"];

  function $(id){return document.getElementById(id)}
  function isAllowedKey(key){return ALLOWED_EXACT.indexOf(key)>=0||ALLOWED_PREFIXES.some(function(p){return key.indexOf(p)===0})}
  function parseJSON(raw){try{return JSON.parse(raw)}catch(e){throw new Error("El archivo no contiene JSON válido.")}}
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function object(v){return v&&typeof v==="object"&&!Array.isArray(v)?v:{}}
  function first(){for(var i=0;i<arguments.length;i++){var v=arguments[i];if(v!==undefined&&v!==null&&v!=="")return v}return null}
  function numberOrNull(v){if(v===null||v===undefined||v==="")return null;var n=Number(v);return isFinite(n)?n:null}
  function text(v){return v===null||v===undefined?"":String(v).trim()}
  function upper(v){return text(v).toUpperCase()}
  function now(){return new Date().toISOString()}

  function appStorageSnapshot(){
    var data={};
    for(var i=0;i<localStorage.length;i++){
      var key=localStorage.key(i);
      if(isAllowedKey(key))data[key]=localStorage.getItem(key);
    }
    return data;
  }

  function downloadJSON(name,payload){
    var blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    var url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},0);
  }

  function exportBackup(){
    var payload={schema:BACKUP_SCHEMA,version:1,app:"Calculador Amazon Compuesto",exportedAt:now(),storage:appStorageSnapshot()};
    var stamp=payload.exportedAt.slice(0,19).replace(/[:T]/g,"-");
    downloadJSON("calculador-amazon-compuesto-backup-"+stamp+".json",payload);
    setStatus("Respaldo exportado. Guárdalo fuera del navegador.","good");
  }

  function restoreBackup(file){
    var r=new FileReader();
    r.onload=function(){
      try{
        var payload=parseJSON(String(r.result||""));
        if(payload.schema!==BACKUP_SCHEMA||payload.version!==1||!payload.storage||typeof payload.storage!=="object")throw new Error("El archivo no es un respaldo compatible del Calculador.");
        var keys=Object.keys(payload.storage).filter(isAllowedKey);
        if(!keys.length)throw new Error("El respaldo no contiene datos reconocidos de la aplicación.");
        if(!window.confirm("Restaurar reemplazará los datos actuales de la Calculadora en este navegador. ¿Continuar?"))return;
        var existing=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(isAllowedKey(k))existing.push(k)}
        existing.forEach(function(k){localStorage.removeItem(k)});
        keys.forEach(function(k){var v=payload.storage[k];if(typeof v==="string")localStorage.setItem(k,v)});
        setStatus("Respaldo restaurado. Recargando la Calculadora…","good");
        setTimeout(function(){location.reload()},250);
      }catch(e){setStatus(e.message||"No se pudo restaurar el respaldo.","bad")}
    };
    r.onerror=function(){setStatus("No se pudo leer el archivo de respaldo.","bad")};
    r.readAsText(file);
  }

  function normalizeEligibility(v){
    var x=upper(v).replace(/_/g," ");
    if(x==="AUTORIZADO"||x==="AUTHORIZED"||x==="ELIGIBLE")return "AUTORIZADO";
    if(x==="REQUIERE APROBACIÓN"||x==="REQUIERE APROBACION"||x==="APPROVAL REQUIRED"||x==="REQUIRES APPROVAL")return "REQUIERE APROBACIÓN";
    if(x==="NO AUTORIZADO"||x==="NOT AUTHORIZED"||x==="INELIGIBLE")return "NO AUTORIZADO";
    return "NO VERIFICADO";
  }
  function normalizeAmazonSeller(v){
    if(v===true)return "SÍ";if(v===false)return "NO";
    var x=upper(v);
    if(x==="SI"||x==="SÍ"||x==="YES"||x==="TRUE")return "SÍ";
    if(x==="NO"||x==="FALSE")return "NO";
    if(x==="INTERMITENTE"||x==="INTERMITTENT")return "INTERMITENTE";
    return "NO VERIFICADO";
  }
  function normalizeMarketplace(v){var x=upper(v);if(x.indexOf("CA")>=0)return "CA";if(x.indexOf("MX")>=0)return "MX";return "US"}
  function normalizeCondition(v){var x=upper(v);return x==="USED"||x==="USADO"?"USED":"NEW"}

  function unwrapProspect(payload){
    if(Array.isArray(payload)){if(payload.length!==1)throw new Error("El archivo contiene varios prospectos. Exporta o selecciona uno para importarlo.");return object(payload[0])}
    if(payload&&payload.prospect)return object(payload.prospect);
    if(payload&&Array.isArray(payload.prospects)){if(payload.prospects.length!==1)throw new Error("El archivo contiene varios prospectos. Exporta o selecciona uno para importarlo.");return object(payload.prospects[0])}
    return object(payload);
  }

  function archiveCurrent(catalog){
    var current=object(parseSafe(localStorage.getItem(JEVI_KEY),{}));
    var asin=upper(current.product&&current.product.asin);
    if(!asin)return;
    catalog[asin]={asin:asin,updatedAt:now(),state:clone(current),inputs:object(parseSafe(localStorage.getItem(FBA_KEY),{}))};
  }
  function parseSafe(raw,fallback){try{var v=JSON.parse(raw||"");return v===null?fallback:v}catch(e){return fallback}}

  function importProspect(payload){
    var p=unwrapProspect(payload),product=object(p.product),market=object(p.market),elig=object(p.eligibility),financial=object(p.financial);
    var asin=upper(first(p.asin,product.asin,p.ASIN));
    if(!asin)throw new Error("El prospecto no contiene ASIN.");

    var current=object(parseSafe(localStorage.getItem(JEVI_KEY),{}));
    var state=clone(current);
    state.version=state.version||1;
    state.product=object(state.product);state.eligibility=object(state.eligibility);state.market=object(state.market);
    state.product.asin=asin;
    state.product.upcEan=text(first(p.upcEan,p.upc,p.ean,product.upcEan,product.upc,product.ean));
    state.product.brand=text(first(p.brand,product.brand));
    state.product.category=text(first(p.category,product.category));
    state.product.marketplace=normalizeMarketplace(first(p.marketplace,product.marketplace,"US"));
    state.product.condition=normalizeCondition(first(p.condition,product.condition,"NEW"));
    state.product.stage="CANDIDATO";

    state.eligibility.status=normalizeEligibility(first(p.eligibilityStatus,elig.status,p.eligibility));
    state.eligibility.source=text(first(elig.source,p.eligibilitySource,"SCANNER"))||"SCANNER";
    state.eligibility.checkedAt=state.eligibility.status==="NO VERIFICADO"?null:first(elig.checkedAt,p.eligibilityCheckedAt,now());

    var fieldMap={
      bsrCurrent:first(p.bsrCurrent,p.bsr,market.bsrCurrent,market.bsr),
      bsrTrend:first(p.bsrTrend,market.bsrTrend),
      salesEstimatedMonthly:first(p.salesEstimatedMonthly,p.monthlySales,market.salesEstimatedMonthly,market.monthlySales),
      sellersFbaCurrent:first(p.sellersFbaCurrent,p.sellers,market.sellersFbaCurrent,market.sellers),
      sellersFba30:first(p.sellersFba30,market.sellersFba30),
      priceAvg30:first(p.priceAvg30,market.priceAvg30),
      priceAvg90:first(p.priceAvg90,market.priceAvg90),
      priceAvg180:first(p.priceAvg180,market.priceAvg180),
      priceMinRecent:first(p.priceMinRecent,p.priceMin,market.priceMinRecent,market.priceMin),
      priceStability:first(p.priceStability,market.priceStability),
      buyBox:first(p.buyBox,market.buyBox),
      amazonSeller:first(p.amazonSeller,market.amazonSeller),
      seasonality:first(p.seasonality,market.seasonality)
    };
    ["bsrCurrent","salesEstimatedMonthly","sellersFbaCurrent","sellersFba30","priceAvg30","priceAvg90","priceAvg180","priceMinRecent"].forEach(function(k){var v=numberOrNull(fieldMap[k]);if(v!==null)state.market[k]=v});
    if(fieldMap.bsrTrend!==null)state.market.bsrTrend=upper(fieldMap.bsrTrend);
    if(fieldMap.priceStability!==null)state.market.priceStability=upper(fieldMap.priceStability);
    if(fieldMap.buyBox!==null)state.market.buyBox=upper(fieldMap.buyBox);
    state.market.amazonSeller=normalizeAmazonSeller(fieldMap.amazonSeller);
    if(fieldMap.seasonality!==null)state.market.seasonality=upper(fieldMap.seasonality);
    state.market.source="SCANNER";state.market.checkedAt=now();

    var inputs=object(parseSafe(localStorage.getItem(FBA_KEY),{}));
    var currentPrice=numberOrNull(first(p.priceCurrent,p.price,market.priceCurrent,market.price,financial.salePrice));
    if(currentPrice!==null)inputs.p_precio=String(currentPrice);
    localStorage.setItem(FBA_KEY,JSON.stringify(inputs));
    localStorage.setItem(JEVI_KEY,JSON.stringify(state));

    var catalog=object(parseSafe(localStorage.getItem(CATALOG_KEY),{}));
    archiveCurrent(catalog);
    catalog[asin]={asin:asin,updatedAt:now(),state:clone(state),inputs:clone(inputs)};
    localStorage.setItem(CATALOG_KEY,JSON.stringify(catalog));
    return {asin:asin,eligibility:state.eligibility.status,amazonSeller:state.market.amazonSeller,price:currentPrice};
  }

  function importScannerFile(file){
    var r=new FileReader();
    r.onload=function(){
      try{
        var payload=parseJSON(String(r.result||""));
        var result=importProspect(payload);
        setStatus("Prospecto "+result.asin+" importado. Elegibilidad: "+result.eligibility+". Amazon seller: "+result.amazonSeller+". Recargando…","good");
        setTimeout(function(){location.reload()},300);
      }catch(e){setStatus(e.message||"No se pudo importar el prospecto.","bad")}
    };
    r.onerror=function(){setStatus("No se pudo leer el JSON del Scanner.","bad")};
    r.readAsText(file);
  }

  function setStatus(message,tone){
    var el=$("data-tools-status");if(!el)return;
    el.textContent=message;el.style.color=tone==="bad"?"var(--bad)":(tone==="good"?"var(--good)":"var(--ink2)");
  }

  function buildUI(){
    if($("data-tools"))return;
    var host=$("p-purchases")||document.querySelector(".wrap");if(!host)return;
    var card=document.createElement("div");card.id="data-tools";card.className="card";
    card.innerHTML='<div class="cardtitle">Datos · respaldo e importación</div>'+
      '<div class="note" style="margin-bottom:10px">Los datos operativos viven en este navegador. Exporta un respaldo periódicamente y guárdalo fuera del equipo.</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:10px">'+
        '<button type="button" class="linkbtn" id="data-backup-export">Exportar respaldo</button>'+
        '<button type="button" class="linkbtn" id="data-backup-restore">Restaurar respaldo</button>'+
        '<button type="button" class="linkbtn" id="data-scanner-import">Importar prospecto Scanner</button>'+
      '</div>'+
      '<input id="data-backup-file" type="file" accept="application/json,.json" hidden>'+
      '<input id="data-scanner-file" type="file" accept="application/json,.json" hidden>'+
      '<div id="data-tools-status" class="foot" style="margin-top:4px">Formato Scanner soportado: '+SCANNER_SCHEMA+'. La presencia de Amazon se importa como dato de riesgo; no se convierte en bloqueo automático.</div>';
    host.appendChild(card);
    $("data-backup-export").addEventListener("click",exportBackup);
    $("data-backup-restore").addEventListener("click",function(){$("data-backup-file").click()});
    $("data-scanner-import").addEventListener("click",function(){$("data-scanner-file").click()});
    $("data-backup-file").addEventListener("change",function(){if(this.files&&this.files[0])restoreBackup(this.files[0]);this.value=""});
    $("data-scanner-file").addEventListener("change",function(){if(this.files&&this.files[0])importScannerFile(this.files[0]);this.value=""});
  }

  window.CALCULADOR_DATA_TOOLS={exportBackup:exportBackup,importProspect:importProspect,backupSchema:BACKUP_SCHEMA,scannerSchema:SCANNER_SCHEMA};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(buildUI,0)});else setTimeout(buildUI,0);
})();
