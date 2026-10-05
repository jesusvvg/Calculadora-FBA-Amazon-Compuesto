(function(){
  "use strict";
  var KEY="jev_v1";
  function $(id){return document.getElementById(id)}
  function read(){var s={};try{s=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){s={}};if(!s||typeof s!=="object")s={};if(!s.rotation)s.rotation={};if(!s.risk)s.risk={};if(!s.rotation.sellThrough90)s.rotation.sellThrough90="NO VERIFICADO";if(!s.risk.priceWar)s.risk.priceWar="NO VERIFICADA";return s}
  var state=read();
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
  function val(id){var e=$(id);return e?e.value:""}
  function setv(id,v){var e=$(id);if(e)e.value=(v===null||v===undefined)?"":String(v)}
  function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
  function round5(x){return Math.round(x/5)*5}
  function pct(x){return isFinite(x)?(x*100).toFixed(1)+"%":"—"}
  function num1(x){return isFinite(x)?Number(x).toLocaleString("es-CL",{maximumFractionDigits:1}):"—"}

  function injectStyles(){
    if($("jev-phase5-style"))return;
    var st=document.createElement("style");st.id="jev-phase5-style";
    st.textContent=
      ".jev-score-card{margin:0 0 14px;padding-bottom:10px}"+
      ".jev-score-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}"+
      ".jev-score-big{font-family:var(--mono);font-size:23px;line-height:1}"+
      ".jev-score-band{font-size:11px;color:var(--muted);margin-top:4px;text-align:right}"+
      ".jev-score-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}"+
      ".jev-score-mini{border:1px solid var(--line);padding:8px 9px;background:#fff}"+
      ".jev-score-mini .k{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}"+
      ".jev-score-mini .v{font-family:var(--mono);font-size:14px;margin-top:2px}"+
      ".jev-score-note{font-size:11px;color:var(--muted);line-height:1.5;margin-top:6px}"+
      ".jev-score-warn{font-size:11.5px;line-height:1.5;margin-top:7px;padding:7px 9px;background:var(--warnBg);border-left:3px solid var(--warn)}"+
      ".jev-score-bad{background:var(--badBg);border-left-color:var(--bad)}"+
      "@media(max-width:620px){.jev-score-grid{grid-template-columns:1fr 1fr}.jev-score-head{display:block}.jev-score-band{text-align:left}}";
    document.head.appendChild(st);
  }
  function fsel(id,label,opts,hint){return '<label class="f"><div class="flabel">'+label+'</div><select id="'+id+'">'+opts.map(function(o){return '<option value="'+o+'">'+o+'</option>'}).join("")+'</select>'+(hint?'<div class="hint">'+hint+'</div>':'')+'</label>'}

  function buildUI(){
    var market=$("jev_market_block");if(!market||$("jev_rotation_risk_block"))return;
    var box=document.createElement("div");box.id="jev_rotation_risk_block";
    box.innerHTML='<details class="jev-details"><summary>Rotación y riesgo · datos manuales</summary><div class="jev-details-body">'+
      '<div class="sect">Rotación</div>'+fsel("jev_sellthrough90","Sell-through esperado a 90 días",["NO VERIFICADO","ALTO ≥80%","MEDIO 50–79%","BAJO <50%"],"Estimación conservadora del lote, no una promesa de ventas.")+
      '<div class="sect">Riesgo competitivo</div>'+fsel("jev_pricewar","Guerra de precios observada",["NO VERIFICADA","BAJA","MEDIA","ALTA"],"Úsalo solo si observaste recortes/agresividad de precio en el historial.")+
      '<div class="hint">Los demás factores se reutilizan de Ciclo de caja, Mercado, Devoluciones, Plan de salida y Capital.</div>'+
    '</div></details>';
    market.parentNode.insertBefore(box,market.nextSibling);

    var ms=$("jev_market_summary");
    if(ms&&!$("jev_rotation_summary")){
      var r=document.createElement("div");r.id="jev_rotation_summary";r.className="card jev-score-card";ms.parentNode.insertBefore(r,ms.nextSibling);
      var k=document.createElement("div");k.id="jev_risk_summary";k.className="card jev-score-card";r.parentNode.insertBefore(k,r.nextSibling);
    }
  }

  function hydrate(){state=read();setv("jev_sellthrough90",state.rotation.sellThrough90);setv("jev_pricewar",state.risk.priceWar)}
  function persist(){state=read();state.rotation.sellThrough90=val("jev_sellthrough90")||"NO VERIFICADO";state.risk.priceWar=val("jev_pricewar")||"NO VERIFICADA";save();render()}
  function bind(){["jev_sellthrough90","jev_pricewar"].forEach(function(id){var e=$(id);if(e){e.addEventListener("change",persist);e.addEventListener("input",persist)}});["p_dias","c_compra","c_activ","c_venta","c_envio","c_corte1","c_corte2","c_banco","p_unid","p_presu","p_precio","p_ref","p_fba","p_moneda","p_tc"].forEach(function(id){var e=$(id);if(e){e.addEventListener("input",render);e.addEventListener("change",render)}})}

  function daysToCash(){var manual=val("p_dias");if(manual!==""&&isFinite(Number(manual)))return Math.max(0,Number(manual));try{if(typeof window.calcCiclo==="function"){var c=window.calcCiclo();if(c&&isFinite(c.total))return c.total}}catch(e){}return null}
  function capitalExposure(s){
    var c=s.costs&&s.costs.checkout,p=s.costs&&s.costs.prep;if(!c||!p)return null;
    var units=Math.max(0,Math.round(Number(val("p_unid"))||0)),budget=Number(val("p_presu"))||0,currency=val("p_moneda")||"USD",rate=currency==="USD"?1:(Number(val("p_tc"))||0);
    if(!(units>0&&budget>0&&rate>0&&c.displayedUnit!==null&&c.displayedUnit!==undefined&&c.taxUnit!==null&&c.taxUnit!==undefined&&c.supplierToPrepLot!==null&&c.supplierToPrepLot!==undefined&&p.prepUnit!==null&&p.prepUnit!==undefined&&p.prepToAmazonLot!==null&&p.prepToAmazonLot!==undefined))return null;
    var checkout=Math.max(0,Number(c.displayedUnit)-Number(c.discountUnit||0)+Number(c.taxUnit))/rate;
    var landed=checkout+Number(c.supplierToPrepLot)/rate/units+Number(p.prepUnit)+Number(p.otherPrepLot||0)/units+Number(p.prepToAmazonLot)/units;
    return landed*units/budget;
  }

  function scoreDTC(d){if(d===null)return null;if(d<=30)return 100;if(d<=45)return 85;if(d<=60)return 65;if(d<=75)return 45;if(d<=90)return 25;if(d<=120)return 10;return 0}
  function scorePressure(m){if(!m||m.salesEstimatedMonthly===null||m.salesEstimatedMonthly===undefined||m.sellersFbaCurrent===null||m.sellersFbaCurrent===undefined||!(m.sellersFbaCurrent>0))return {score:null,pressure:null};var p=m.salesEstimatedMonthly/m.sellersFbaCurrent;var sc=p>=25?90:(p>=15?80:(p>=8?65:(p>=4?50:30)));return {score:sc,pressure:p}}
  function scoreBuyBox(m){if(!m||!m.buyBox||m.buyBox==="NO VERIFICADA")return null;return m.buyBox==="ESTABLE"?90:(m.buyBox==="VARIABLE"?60:35)}
  function scoreStability(m){if(!m)return null;var vals=[];if(m.bsrTrend&&m.bsrTrend!=="NO VERIFICADO")vals.push(m.bsrTrend==="MEJORA"?90:(m.bsrTrend==="ESTABLE"?75:35));if(m.priceStability&&m.priceStability!=="NO VERIFICADA")vals.push(m.priceStability==="ALTA"?90:(m.priceStability==="MEDIA"?65:30));if(m.seasonality&&m.seasonality!=="NO VERIFICADA")vals.push(m.seasonality==="BAJA"?90:(m.seasonality==="MEDIA"?65:35));if(!vals.length)return null;return vals.reduce(function(a,b){return a+b},0)/vals.length}
  function scoreSellThrough(x){if(!x||x==="NO VERIFICADO")return null;return x.indexOf("ALTO")===0?90:(x.indexOf("MEDIO")===0?60:25)}

  function evaluateRotation(){
    var s=read(),m=s.market||{},dtc=daysToCash(),press=scorePressure(m),comps=[
      {k:"Days to Cash",w:30,score:scoreDTC(dtc),detail:dtc===null?"sin datos":Math.round(dtc)+" días"},
      {k:"Demanda",w:25,score:press.score,detail:press.pressure===null?"sin datos":num1(press.pressure)+" u/seller teóricas"},
      {k:"Buy Box",w:15,score:scoreBuyBox(m),detail:m.buyBox||"sin verificar"},
      {k:"Estabilidad",w:15,score:scoreStability(m),detail:"BSR/precio/estacionalidad"},
      {k:"Sell-through",w:15,score:scoreSellThrough(s.rotation&&s.rotation.sellThrough90),detail:s.rotation&&s.rotation.sellThrough90||"NO VERIFICADO"}
    ];
    var num=0,den=0;comps.forEach(function(c){if(c.score!==null){num+=c.score*c.w;den+=c.w}});var score=den?round5(num/den):null,coverage=den/100,band=coverage<0.55?"INCOMPLETO":(score>=80?"RÁPIDA":(score>=65?"BUENA":(score>=50?"ACEPTABLE":(score>=35?"LENTA":"MUY LENTA"))));var w=[];
    if(dtc!==null&&dtc>90)w.push("Days to Cash superior a 90 días: demasiado lento para capital limitado.");
    if(dtc!==null&&dtc>120)w.push("Days to Cash superior a 120 días: señal fuerte para ESPERAR salvo caso excepcional.");
    if(s.rotation&&s.rotation.sellThrough90==="BAJO <50%")w.push("Sell-through esperado bajo: alto riesgo de inventario residual.");
    if(press.pressure!==null&&press.pressure<4)w.push("Presión de demanda baja frente al número de sellers.");
    if(m.buyBox==="CONCENTRADA")w.push("Buy Box concentrada puede dificultar la rotación de un seller nuevo.");
    if(coverage<0.55)w.push("Faltan datos para interpretar Rotation Score con confianza.");
    return {score:score,coverage:coverage,band:band,components:comps,warnings:w,dtc:dtc};
  }

  function riskCapital(exposure){if(exposure===null)return null;if(exposure<=0.10)return 10;if(exposure<=0.20)return 25;if(exposure<=0.35)return 45;if(exposure<=0.50)return 65;if(exposure<=0.75)return 85;return 100}
  function riskPrice(m,current){if(!m)return null;var parts=[];if(m.priceStability&&m.priceStability!=="NO VERIFICADA")parts.push(m.priceStability==="ALTA"?15:(m.priceStability==="MEDIA"?45:85));if(current>0&&m.priceMinRecent>0){var drop=(current-m.priceMinRecent)/current;parts.push(drop<=0.10?20:(drop<=0.20?40:(drop<=0.30?65:90)))}if(current>0&&m.priceAvg90>0&&current/m.priceAvg90>1.15)parts.push(75);if(!parts.length)return null;return parts.reduce(function(a,b){return a+b},0)/parts.length}
  function riskCompetition(s){var m=s.market||{},parts=[];if(m.sellersFbaCurrent!==null&&m.sellersFbaCurrent!==undefined&&m.sellersFba30>0){var g=(m.sellersFbaCurrent-m.sellersFba30)/m.sellersFba30;parts.push(g<=0.10?20:(g<=0.25?45:(g<=0.50?70:90)))}if(m.amazonSeller&&m.amazonSeller!=="NO VERIFICADO")parts.push(m.amazonSeller==="NO"?10:(m.amazonSeller==="INTERMITENTE"?55:90));if(s.risk&&s.risk.priceWar&&s.risk.priceWar!=="NO VERIFICADA")parts.push(s.risk.priceWar==="BAJA"?20:(s.risk.priceWar==="MEDIA"?55:90));if(m.buyBox==="CONCENTRADA")parts.push(75);if(!parts.length)return null;return parts.reduce(function(a,b){return a+b},0)/parts.length}
  function riskSeason(m){if(!m||!m.seasonality||m.seasonality==="NO VERIFICADA")return null;return m.seasonality==="BAJA"?15:(m.seasonality==="MEDIA"?45:80)}
  function riskReturns(s){var r=s.returns||{},parts=[];if(r.returnRateExpected!==null&&r.returnRateExpected!==undefined){var x=Number(r.returnRateExpected);parts.push(x<5?20:(x<10?40:(x<15?65:90)))}if(r.resellablePct!==null&&r.resellablePct!==undefined){var y=Number(r.resellablePct);parts.push(y>=90?15:(y>=75?35:(y>=50?65:90)))}if(!parts.length)return null;return parts.reduce(function(a,b){return a+b},0)/parts.length}
  function riskExit(s){var v=s.verification||{},e=v.exitPlan||{},parts=[];if(e.returnAllowed&&e.returnAllowed!=="NO VERIFICADO")parts.push(e.returnAllowed==="SÍ"?15:75);if(e.finalSale&&e.finalSale!=="NO VERIFICADO")parts.push(e.finalSale==="NO"?10:90);if(v.brandPolicy&&v.brandPolicy.status==="SIN PROHIBICIÓN ENCONTRADA")parts.push(35);if(v.supply&&v.supply.authenticity==="RAZONABLE")parts.push(30);if(v.supply&&v.supply.authenticity==="VERIFICADA")parts.push(10);if(v.supply&&v.supply.authenticity==="DUDOSA")parts.push(90);if(!parts.length)return null;return parts.reduce(function(a,b){return a+b},0)/parts.length}
  function riskInventory(rot){if(rot.dtc===null&&rot.score===null)return null;var parts=[];if(rot.dtc!==null)parts.push(rot.dtc<=45?15:(rot.dtc<=60?30:(rot.dtc<=75?50:(rot.dtc<=90?70:90))));var st=read().rotation&&read().rotation.sellThrough90;if(st&&st!=="NO VERIFICADO")parts.push(st.indexOf("ALTO")===0?15:(st.indexOf("MEDIO")===0?50:90));return parts.length?parts.reduce(function(a,b){return a+b},0)/parts.length:null}

  function evaluateRisk(){
    var s=read(),m=s.market||{},rot=evaluateRotation(),exposure=capitalExposure(s),current=Number(val("p_precio"))||0,comps=[
      {k:"Capital",w:20,score:riskCapital(exposure),detail:exposure===null?"sin datos":pct(exposure)},
      {k:"Precio",w:20,score:riskPrice(m,current),detail:"caída/estabilidad"},
      {k:"Competencia",w:15,score:riskCompetition(s),detail:s.risk&&s.risk.priceWar||"NO VERIFICADA"},
      {k:"Estacionalidad",w:10,score:riskSeason(m),detail:m.seasonality||"NO VERIFICADA"},
      {k:"Devoluciones",w:15,score:riskReturns(s),detail:s.returns&&s.returns.returnRateExpected!==null&&s.returns.returnRateExpected!==undefined?Number(s.returns.returnRateExpected).toFixed(1)+"%":"sin datos"},
      {k:"Salida/origen",w:10,score:riskExit(s),detail:"retorno/marca/fuente"},
      {k:"Inventario",w:10,score:riskInventory(rot),detail:rot.dtc===null?"sin datos":Math.round(rot.dtc)+" d DTC"}
    ];
    var num=0,den=0;comps.forEach(function(c){if(c.score!==null){num+=c.score*c.w;den+=c.w}});var score=den?round5(num/den):null,coverage=den/100,band=coverage<0.55?"INCOMPLETO":(score<=25?"BAJO":(score<=45?"MODERADO":(score<=65?"ALTO":"MUY ALTO"))),w=[];
    if(exposure!==null&&exposure>0.35)w.push("Concentración de capital elevada para un producto no validado.");
    if(m.amazonSeller==="SÍ")w.push("Amazon compite directamente en el listing.");
    if(s.risk&&s.risk.priceWar==="ALTA")w.push("Guerra de precios alta observada.");
    if(s.returns&&s.returns.returnRateExpected!==null&&Number(s.returns.returnRateExpected)>=10)w.push("Tasa de devoluciones esperada de 10% o más.");
    if(s.verification&&s.verification.exitPlan&&s.verification.exitPlan.returnAllowed==="NO")w.push("No existe devolución al proveedor como plan B.");
    if(rot.dtc!==null&&rot.dtc>90)w.push("Inventario/capital podría quedar inmovilizado demasiado tiempo.");
    if(coverage<0.55)w.push("Cobertura de riesgo insuficiente: lo desconocido no se considera seguro.");
    return {score:score,coverage:coverage,band:band,components:comps,warnings:w,exposure:exposure};
  }

  function renderCard(id,title,r,highIsGood){var card=$(id);if(!card)return;card.innerHTML='<div class="jev-score-head"><div><div class="cardtitle">'+title+'</div><div class="jev-score-note">'+(highIsGood?'100 = rotación más favorable.':'0 = menor riesgo; 100 = mayor riesgo.')+'</div></div><div><div class="jev-score-big">'+(r.score===null?'—':r.score+'/100')+'</div><div class="jev-score-band">'+r.band+' · cobertura '+Math.round(r.coverage*100)+'%</div></div></div><div class="jev-score-grid">'+r.components.map(function(c){return '<div class="jev-score-mini"><div class="k">'+c.k+'</div><div class="v">'+(c.score===null?'—':round5(c.score))+'</div><div class="jev-score-note">'+c.detail+'</div></div>'}).join("")+'</div>'+(r.warnings.length?r.warnings.map(function(w){return '<div class="jev-score-warn">'+w+'</div>'}).join(""):'<div class="jev-score-note">Sin alertas fuertes con los datos cargados.</div>')+'<div class="jev-score-note">Score heurístico redondeado en bloques de 5; no representa probabilidad de éxito.</div>'}
  function render(){state=read();var rot=evaluateRotation(),risk=evaluateRisk();renderCard("jev_rotation_summary","Rotation Score v1 · heurístico",rot,true);renderCard("jev_risk_summary","Risk Score v1 · heurístico",risk,false);window.JEV_PHASE5={rotation:rot,risk:risk,evaluateRotation:evaluateRotation,evaluateRisk:evaluateRisk}}

  function init(){if(!$("jev_market_block"))return;injectStyles();buildUI();hydrate();bind();render();var eyebrow=document.querySelector(".eyebrow");if(eyebrow)eyebrow.textContent="CALCULADOR AMAZON COMPUESTO · JEV v1 · FASE 5"}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(init,0)});else setTimeout(init,0);
})();
