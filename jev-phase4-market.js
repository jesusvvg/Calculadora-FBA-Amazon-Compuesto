(function(){
  "use strict";
  var KEY="jev_v1";
  function $(id){return document.getElementById(id)}
  function load(){
    var s={};try{s=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){s={}}
    if(!s||typeof s!=="object")s={};
    if(!s.market)s.market={};
    var m=s.market;
    if(m.bsrCurrent===undefined)m.bsrCurrent=null;
    if(!m.bsrTrend)m.bsrTrend="NO VERIFICADO";
    if(m.salesEstimatedMonthly===undefined)m.salesEstimatedMonthly=null;
    if(m.sellersFbaCurrent===undefined)m.sellersFbaCurrent=null;
    if(m.sellersFba30===undefined)m.sellersFba30=null;
    if(m.priceAvg30===undefined)m.priceAvg30=null;
    if(m.priceAvg90===undefined)m.priceAvg90=null;
    if(m.priceAvg180===undefined)m.priceAvg180=null;
    if(m.priceMinRecent===undefined)m.priceMinRecent=null;
    if(!m.priceStability)m.priceStability="NO VERIFICADA";
    if(!m.buyBox)m.buyBox="NO VERIFICADA";
    if(!m.amazonSeller)m.amazonSeller="NO VERIFICADO";
    if(!m.seasonality)m.seasonality="NO VERIFICADA";
    if(!m.source)m.source="MANUAL";
    if(m.checkedAt===undefined)m.checkedAt=null;
    return s;
  }
  var state=load();
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
  function val(id){var e=$(id);return e?e.value:""}
  function n(id){var v=val(id);if(v==="")return null;var x=Number(v);return isFinite(x)?x:null}
  function setv(id,v){var e=$(id);if(e)e.value=(v===null||v===undefined)?"":String(v)}
  function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
  function round5(x){return Math.round(x/5)*5}
  function pct(x){return isFinite(x)?(x*100).toFixed(1)+"%":"—"}
  function num1(x){return isFinite(x)?Number(x).toLocaleString("es-CL",{maximumFractionDigits:1}):"—"}
  function money(x){return isFinite(x)?"$"+Number(x).toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"}

  function injectStyles(){
    if($("jev-market-style"))return;
    var st=document.createElement("style");st.id="jev-market-style";
    st.textContent=
      ".jev-market-card{margin:0 0 14px;padding-bottom:10px}"+
      ".jev-market-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}"+
      ".jev-market-score{font-family:var(--mono);font-size:23px;line-height:1}"+
      ".jev-market-band{font-size:11px;color:var(--muted);margin-top:4px;text-align:right}"+
      ".jev-market-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}"+
      ".jev-market-mini{border:1px solid var(--line);padding:8px 9px;background:#fff}"+
      ".jev-market-mini .k{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}"+
      ".jev-market-mini .v{font-family:var(--mono);font-size:14px;margin-top:2px}"+
      ".jev-market-warn{font-size:11.5px;line-height:1.5;margin-top:7px;padding:7px 9px;background:var(--warnBg);border-left:3px solid var(--warn)}"+
      ".jev-market-note{font-size:11px;color:var(--muted);line-height:1.5;margin-top:7px}"+
      "@media(max-width:620px){.jev-market-grid{grid-template-columns:1fr 1fr}.jev-market-head{display:block}.jev-market-band{text-align:left}}";
    document.head.appendChild(st);
  }

  function fnum(id,label,suffix,hint){return '<label class="f"><div class="flabel">'+label+'</div><div class="fbox"><input id="'+id+'" type="number" inputmode="decimal" step="0.01">'+(suffix?'<span class="fix">'+suffix+'</span>':'')+'</div>'+(hint?'<div class="hint">'+hint+'</div>':'')+'</label>'}
  function fsel(id,label,opts,hint){return '<label class="f"><div class="flabel">'+label+'</div><select id="'+id+'">'+opts.map(function(o){return '<option value="'+o+'">'+o+'</option>'}).join("")+'</select>'+(hint?'<div class="hint">'+hint+'</div>':'')+'</label>'}

  function buildUI(){
    var p3=$("jev_phase3");if(!p3||$("jev_market_block"))return;
    var box=document.createElement("div");box.id="jev_market_block";
    box.innerHTML='<details class="jev-details" id="jev_market_details"><summary>Mercado · datos manuales</summary><div class="jev-details-body">'+
      '<div class="sect">Demanda y BSR</div>'+
      '<div class="two">'+fnum("jev_bsr","BSR actual","","")+fsel("jev_bsr_trend","Tendencia BSR",["NO VERIFICADO","MEJORA","ESTABLE","EMPEORA"],"MEJORA = BSR tiende a bajar/mejorar; EMPEORA = BSR tiende a subir.")+'</div>'+
      fnum("jev_sales_month","Ventas estimadas / mes","u","Estimación externa; no es una garantía de ventas para tu cuenta.")+
      '<div class="sect">Precio histórico</div>'+
      '<div class="hint" style="margin-bottom:9px">El precio actual se toma de “Precio de venta en Amazon”.</div>'+
      '<div class="two">'+fnum("jev_p30","Promedio 30 días","US$","")+fnum("jev_p90","Promedio 90 días","US$","")+'</div>'+
      '<div class="two">'+fnum("jev_p180","Promedio 180 días","US$","")+fnum("jev_pmin","Mínimo reciente","US$","")+'</div>'+
      fsel("jev_price_stability","Estabilidad de precio",["NO VERIFICADA","ALTA","MEDIA","BAJA"],"")+
      '<div class="sect">Competencia</div>'+
      '<div class="two">'+fnum("jev_sellers_now","Sellers FBA actuales","","")+fnum("jev_sellers_30","Sellers FBA hace 30 días","","")+'</div>'+
      fsel("jev_amazon_seller","Amazon como vendedor",["NO VERIFICADO","NO","INTERMITENTE","SÍ"],"")+
      fsel("jev_buybox","Buy Box",["NO VERIFICADA","ESTABLE","VARIABLE","CONCENTRADA"],"CONCENTRADA = uno o pocos sellers dominan la Buy Box.")+
      fsel("jev_seasonality","Estacionalidad",["NO VERIFICADA","BAJA","MEDIA","ALTA"],"")+
      '<div class="hint">Fuente actual: MANUAL. Más adelante estos mismos campos podrán venir de Keepa/SP-API/otros proveedores sin cambiar el Motor Scoring.</div>'+
    '</div></details>';
    p3.parentNode.insertBefore(box,p3.nextSibling);

    var cap=$("jev_capital_summary");
    if(cap&&!$("jev_market_summary")){
      var card=document.createElement("div");card.id="jev_market_summary";card.className="card jev-market-card";
      cap.parentNode.insertBefore(card,cap.nextSibling);
    }
  }

  function hydrate(){
    var m=state.market;
    setv("jev_bsr",m.bsrCurrent);setv("jev_bsr_trend",m.bsrTrend);setv("jev_sales_month",m.salesEstimatedMonthly);
    setv("jev_p30",m.priceAvg30);setv("jev_p90",m.priceAvg90);setv("jev_p180",m.priceAvg180);setv("jev_pmin",m.priceMinRecent);setv("jev_price_stability",m.priceStability);
    setv("jev_sellers_now",m.sellersFbaCurrent);setv("jev_sellers_30",m.sellersFba30);setv("jev_amazon_seller",m.amazonSeller);setv("jev_buybox",m.buyBox);setv("jev_seasonality",m.seasonality);
  }

  function persist(){
    var m=state.market;
    m.bsrCurrent=n("jev_bsr");m.bsrTrend=val("jev_bsr_trend")||"NO VERIFICADO";m.salesEstimatedMonthly=n("jev_sales_month");
    m.priceAvg30=n("jev_p30");m.priceAvg90=n("jev_p90");m.priceAvg180=n("jev_p180");m.priceMinRecent=n("jev_pmin");m.priceStability=val("jev_price_stability")||"NO VERIFICADA";
    m.sellersFbaCurrent=n("jev_sellers_now");m.sellersFba30=n("jev_sellers_30");m.amazonSeller=val("jev_amazon_seller")||"NO VERIFICADO";m.buyBox=val("jev_buybox")||"NO VERIFICADA";m.seasonality=val("jev_seasonality")||"NO VERIFICADA";
    m.source="MANUAL";m.checkedAt=new Date().toISOString();save();render();
  }

  function bind(){
    ["jev_bsr","jev_bsr_trend","jev_sales_month","jev_p30","jev_p90","jev_p180","jev_pmin","jev_price_stability","jev_sellers_now","jev_sellers_30","jev_amazon_seller","jev_buybox","jev_seasonality"].forEach(function(id){var e=$(id);if(e){e.addEventListener("input",persist);e.addEventListener("change",persist)}});
    var p=$("p_precio");if(p){p.addEventListener("input",render);p.addEventListener("change",render)}
  }

  function componentDemand(m){
    var score=null,detail="sin datos";
    if(m.salesEstimatedMonthly!==null&&m.sellersFbaCurrent!==null&&m.sellersFbaCurrent>0){
      var pressure=m.salesEstimatedMonthly/m.sellersFbaCurrent;
      if(pressure>=25)score=90;else if(pressure>=15)score=80;else if(pressure>=8)score=65;else if(pressure>=4)score=50;else score=35;
      if(m.bsrTrend==="MEJORA")score+=10;else if(m.bsrTrend==="ESTABLE")score+=5;else if(m.bsrTrend==="EMPEORA")score-=10;
      score=clamp(score,0,100);detail=num1(pressure)+" u/seller teóricas";
      return {score:score,detail:detail,pressure:pressure};
    }
    if(m.bsrTrend!=="NO VERIFICADO"){
      score=m.bsrTrend==="MEJORA"?80:(m.bsrTrend==="ESTABLE"?65:40);detail="solo tendencia BSR";
      return {score:score,detail:detail,pressure:null};
    }
    return {score:null,detail:detail,pressure:null};
  }

  function componentPrice(m,current){
    var avg=m.priceAvg90!==null?m.priceAvg90:(m.priceAvg30!==null?m.priceAvg30:m.priceAvg180);
    if(!(current>0)&&avg===null)return {score:null,detail:"sin datos",ratio:null};
    var score=null,ratio=null;
    if(current>0&&avg>0){
      ratio=current/avg;
      var d=Math.abs(ratio-1);
      if(d<=0.05)score=90;else if(d<=0.10)score=75;else if(d<=0.20)score=55;else score=30;
      if(ratio<0.90)score-=5;
    }else score=55;
    if(m.priceStability==="ALTA")score+=5;else if(m.priceStability==="MEDIA")score+=0;else if(m.priceStability==="BAJA")score-=20;
    score=clamp(score,0,100);
    return {score:score,detail:avg?"vs histórico "+pct((current/avg)-1):"histórico parcial",ratio:ratio};
  }

  function componentCompetition(m){
    if(m.sellersFbaCurrent===null||m.sellersFba30===null||m.sellersFba30<=0)return {score:null,detail:"sin tendencia",growth:null};
    var g=(m.sellersFbaCurrent-m.sellersFba30)/m.sellersFba30,score;
    if(g<=-0.10)score=90;else if(g<=0.10)score=80;else if(g<=0.25)score=60;else if(g<=0.50)score=40;else score=20;
    return {score:score,detail:(g>=0?"+":"")+pct(g)+" sellers",growth:g};
  }
  function componentAmazon(m){if(m.amazonSeller==="NO VERIFICADO")return {score:null,detail:"sin verificar"};return {score:m.amazonSeller==="NO"?90:(m.amazonSeller==="INTERMITENTE"?55:25),detail:m.amazonSeller}}
  function componentBuyBox(m){if(m.buyBox==="NO VERIFICADA")return {score:null,detail:"sin verificar"};return {score:m.buyBox==="ESTABLE"?90:(m.buyBox==="VARIABLE"?60:45),detail:m.buyBox}}
  function componentSeason(m){if(m.seasonality==="NO VERIFICADA")return {score:null,detail:"sin verificar"};return {score:m.seasonality==="BAJA"?90:(m.seasonality==="MEDIA"?70:45),detail:m.seasonality}}

  function evaluate(){
    var m=state.market,current=Number(val("p_precio"))||0;
    var comps=[
      {k:"Demanda",w:25,o:componentDemand(m)},
      {k:"Precio",w:20,o:componentPrice(m,current)},
      {k:"Competencia",w:20,o:componentCompetition(m)},
      {k:"Amazon",w:15,o:componentAmazon(m)},
      {k:"Buy Box",w:10,o:componentBuyBox(m)},
      {k:"Estacionalidad",w:10,o:componentSeason(m)}
    ];
    var num=0,den=0;comps.forEach(function(c){if(c.o.score!==null){num+=c.o.score*c.w;den+=c.w}});
    var raw=den?num/den:null,score=raw===null?null:round5(raw),coverage=den/100;
    var band=coverage<0.50?"INCOMPLETO":(score>=75?"SANO":(score>=60?"ACEPTABLE":(score>=45?"CAUTELOSO":"DÉBIL")));
    var w=[];
    var d=comps[0].o,p=comps[1].o,c=comps[2].o;
    if(d.pressure!==null&&d.pressure<4)w.push("La relación ventas estimadas / sellers es baja; no equivale a tus ventas esperadas, pero indica presión competitiva.");
    if(p.ratio!==null&&p.ratio>1.15)w.push("El precio actual está más de 15% sobre el promedio histórico usado; riesgo de reversión a la media.");
    if(p.ratio!==null&&p.ratio<0.90)w.push("El precio actual está más de 10% bajo el promedio histórico; revisar si existe deterioro de precio.");
    if(m.priceStability==="BAJA")w.push("Precio históricamente inestable.");
    if(c.growth!==null&&c.growth>0.25)w.push("Los sellers FBA crecieron más de 25% frente a hace 30 días.");
    if(m.amazonSeller==="SÍ")w.push("Amazon está presente como vendedor; aumenta el riesgo competitivo.");
    if(m.buyBox==="CONCENTRADA")w.push("Buy Box concentrada: la distribución de ventas puede ser muy desigual.");
    if(m.seasonality==="ALTA")w.push("Estacionalidad alta: el dato actual puede no representar todo el año.");
    if(coverage<0.50)w.push("Cobertura de datos de mercado insuficiente para interpretar el score con confianza.");
    return {score:score,coverage:coverage,band:band,components:comps,warnings:w,current:current};
  }

  function render(){
    var card=$("jev_market_summary");if(!card)return;
    var r=evaluate(),m=state.market;
    var checked=m.checkedAt?new Date(m.checkedAt).toLocaleString("es-CL"):"sin actualizar";
    card.innerHTML='<div class="jev-market-head"><div><div class="cardtitle">Market Score v1 · heurístico</div><div class="jev-market-note">No es una probabilidad de éxito ni una predicción de ventas.</div></div><div><div class="jev-market-score">'+(r.score===null?'—':r.score+'/100')+'</div><div class="jev-market-band">'+r.band+' · cobertura '+Math.round(r.coverage*100)+'%</div></div></div>'+
      '<div class="jev-market-grid">'+r.components.map(function(c){return '<div class="jev-market-mini"><div class="k">'+c.k+'</div><div class="v">'+(c.o.score===null?'—':round5(c.o.score))+'</div><div class="jev-market-note">'+c.o.detail+'</div></div>'}).join("")+'</div>'+
      (r.warnings.length?r.warnings.map(function(w){return '<div class="jev-market-warn">'+w+'</div>'}).join(""):'<div class="jev-market-note">Sin alertas fuertes con los datos cargados.</div>')+
      '<div class="jev-market-note">Fuente: MANUAL · '+checked+' · El score se redondea a bloques de 5 para evitar precisión artificial.</div>';
    window.JEV_MARKET={result:r,evaluate:evaluate};
  }

  function loadPhase5(){if($("jev-phase5-script"))return;var s=document.createElement("script");s.id="jev-phase5-script";s.src="jev-phase5-rotation-risk.js";document.body.appendChild(s)}
  function init(){
    if(!$("jev_phase3"))return;
    injectStyles();buildUI();hydrate();bind();render();
    var eyebrow=document.querySelector(".eyebrow");if(eyebrow)eyebrow.textContent="CALCULADOR AMAZON COMPUESTO · MOTOR SCORING v1 · FASE 4";
    loadPhase5();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(init,0)});else setTimeout(init,0);
})();
