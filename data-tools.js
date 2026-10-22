(function(){
  "use strict";
  var BACKUP_SCHEMA="calculador-amazon-compuesto-backup-v1",SCANNER_SCHEMA="amazon-sourcing-scanner-prospect-v1";
  var JEVI_KEY="jev_v1",CATALOG_KEY="motor_scoring_asin_v1",FBA_KEY="fba_v2";
  var ALLOWED_EXACT=[FBA_KEY,JEVI_KEY,CATALOG_KEY,"amazon_compuesto_operations_v1"],ALLOWED_PREFIXES=["fba_","jev_","motor_scoring_","amazon_"];
  var GLOBAL_INPUTS=["p_presu","p_plan","c_corte1","c_corte2","c_banco"];
  function $(id){return document.getElementById(id)}
  function allowed(k){return ALLOWED_EXACT.indexOf(k)>=0||ALLOWED_PREFIXES.some(function(p){return k.indexOf(p)===0})}
  function parse(raw,fallback){try{var v=JSON.parse(raw||"");return v===null?fallback:v}catch(e){return fallback}}
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function obj(v){return v&&typeof v==="object"&&!Array.isArray(v)?v:{}}
  function first(){for(var i=0;i<arguments.length;i++){var v=arguments[i];if(v!==undefined&&v!==null&&v!=="")return v}return null}
  function num(v){if(v===null||v===undefined||v==="")return null;var n=Number(v);return isFinite(n)?n:null}
  function text(v){return v===null||v===undefined?"":String(v).trim()}
  function upper(v){return text(v).toUpperCase()}
  function now(){return new Date().toISOString()}
  function status(msg,tone){var e=$("data-tools-status");if(!e)return;e.textContent=msg;e.style.color=tone==="bad"?"var(--bad)":tone==="good"?"var(--good)":"var(--ink2)"}
  function download(name,payload){var b=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},0)}

  function storageSnapshot(){var out={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(allowed(k))out[k]=localStorage.getItem(k)}return out}
  function exportBackup(){var p={schema:BACKUP_SCHEMA,version:1,app:"Calculador Amazon Compuesto",exportedAt:now(),storage:storageSnapshot()},stamp=p.exportedAt.slice(0,19).replace(/[:T]/g,"-");download("calculador-amazon-compuesto-backup-"+stamp+".json",p);status("Respaldo exportado. Guárdalo fuera del navegador.","good")}
  function restoreBackup(file){var r=new FileReader();r.onload=function(){try{var p=JSON.parse(String(r.result||""));if(p.schema!==BACKUP_SCHEMA||p.version!==1||!p.storage||typeof p.storage!=="object")throw new Error("El archivo no es un respaldo compatible del Calculador.");var keys=Object.keys(p.storage).filter(allowed);if(!keys.length)throw new Error("El respaldo no contiene datos reconocidos de la aplicación.");if(!confirm("Restaurar reemplazará los datos actuales de la Calculadora en este navegador. ¿Continuar?"))return;var old=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(allowed(k))old.push(k)}old.forEach(function(k){localStorage.removeItem(k)});keys.forEach(function(k){if(typeof p.storage[k]==="string")localStorage.setItem(k,p.storage[k])});status("Respaldo restaurado. Recargando la Calculadora…","good");setTimeout(function(){location.reload()},250)}catch(e){status(e.message||"No se pudo restaurar el respaldo.","bad")}};r.onerror=function(){status("No se pudo leer el archivo de respaldo.","bad")};r.readAsText(file)}

  // Importación del Scanner: la hace scanner-bridge.js (validar → vista previa → confirmar).
  // El importador anterior (un prospecto, activo inmediato, fechas = ahora) se retiró: escribía 3 claves
  // sin vista previa y atribuía una frescura inexistente al dato importado.
  function importFile(file){var host=$("data-tools");if(!window.SCANNER_BRIDGE||!host){status("El módulo de importación del Scanner no está cargado. Recarga la página.","bad");return}window.SCANNER_BRIDGE.readFile(file,window,host);status("Vista previa lista abajo: revisa y confirma. Todavía no se guardó nada.","")}
  function buildUI(){if($("data-tools"))return;var host=$("p-purchases")||document.querySelector(".wrap");if(!host)return;var card=document.createElement("div");card.id="data-tools";card.className="card";card.innerHTML='<div class="cardtitle">Datos · respaldo e importación</div><div class="note" style="margin-bottom:10px">Los datos operativos viven en este navegador. Exporta un respaldo periódicamente y guárdalo fuera del equipo.</div><div style="display:flex;flex-wrap:wrap;gap:10px"><button type="button" class="linkbtn" id="data-backup-export">Exportar respaldo</button><button type="button" class="linkbtn" id="data-backup-restore">Restaurar respaldo</button><button type="button" class="linkbtn" id="data-scanner-import">Importar prospectos del Scanner</button></div><input id="data-backup-file" type="file" accept="application/json,.json" hidden><input id="data-scanner-file" type="file" accept="application/json,.json" hidden><div id="data-tools-status" class="foot" style="margin-top:4px">Scanner: exportación JSON v2.3 (también lee el formato antiguo v1). Primero verás una vista previa; nada se guarda hasta que confirmes.</div>';host.appendChild(card);$("data-backup-export").addEventListener("click",exportBackup);$("data-backup-restore").addEventListener("click",function(){$("data-backup-file").click()});$("data-scanner-import").addEventListener("click",function(){$("data-scanner-file").click()});$("data-backup-file").addEventListener("change",function(){if(this.files&&this.files[0])restoreBackup(this.files[0]);this.value=""});$("data-scanner-file").addEventListener("change",function(){if(this.files&&this.files[0])importFile(this.files[0]);this.value=""})}
  window.CALCULADOR_DATA_TOOLS={exportBackup:exportBackup,importScannerFile:importFile,backupSchema:BACKUP_SCHEMA,scannerSchema:SCANNER_SCHEMA};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(buildUI,0)});else setTimeout(buildUI,0);
})();
