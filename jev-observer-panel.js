(function (w) {
  'use strict';
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(w.location.hostname)) return;
  const d = w.document, adapter = w.JevObserverAdapter, contract = w.JevObserverContract;
  const labels = {financial_resilience:'Resistencia financiera', rotation_support:'Rotación', market_pressure:'Competencia', inventory_lockup:'Inventario inmovilizado'};
  const choices = {
    no_material_caveat:'Sin cautela material', price_history_caveat:'Cautela por precio reciente',
    pessimistic_scenario_caveat:'Cautela por escenario pesimista', capital_exposure_caveat:'Cautela por exposición de capital',
    combined_caveats:'Cautelas combinadas', insufficient_data:'Datos insuficientes', supported:'Con respaldo', unsupported:'Sin respaldo',
    manageable:'Manejable', pressure_detected:'Presión detectada', no_material_signal:'Sin señal material', lockup_signal:'Riesgo de inmovilización'
  };
  const readings = {
    financial_resilience:{
      no_material_caveat:'JEV no detecta una cautela financiera material adicional en los datos enviados.',
      price_history_caveat:'JEV señala que el precio mínimo reciente reduce el colchón frente al punto de equilibrio.',
      pessimistic_scenario_caveat:'JEV señala que el escenario pesimista debilita la resistencia financiera del piloto.',
      capital_exposure_caveat:'JEV señala que la exposición de capital merece cautela aunque el lote siga dentro del límite duro.',
      combined_caveats:'JEV detecta más de una cautela financiera material en los datos enviados.',
      insufficient_data:'La información enviada no basta para clasificar la resistencia financiera.'
    },
    rotation_support:{supported:'JEV considera respaldada la estimación de rotación con los datos enviados.', unsupported:'JEV considera que los datos enviados no respaldan la estimación de rotación.', insufficient_data:'JEV considera insuficiente la evidencia enviada para respaldar la rotación.'},
    market_pressure:{manageable:'JEV clasifica la presión competitiva como manejable con los datos enviados.', pressure_detected:'JEV detecta presión competitiva en la información enviada.', insufficient_data:'La información enviada no basta para evaluar la presión competitiva.'},
    inventory_lockup:{no_material_signal:'JEV no detecta una señal relevante de inventario inmovilizado en los datos enviados.', lockup_signal:'JEV detecta una señal de posible inmovilización del inventario.', insufficient_data:'La información enviada no basta para evaluar la inmovilización del inventario.'}
  };
  const financialCautions = new Set(['price_history_caveat','pessimistic_scenario_caveat','capital_exposure_caveat','combined_caveats']);
  const fieldLabels = {
    'market.observationAgeDays':'Fecha de observación de mercado reciente (máximo 30 días)', 'market.priceMinRecentUsd':'Precio mínimo reciente',
    'market.bsrCurrent':'BSR actual', 'market.bsrTrend':'Tendencia BSR', 'market.salesEstimatedMonthlyListing':'Ventas mensuales estimadas del listing',
    'market.sellersFbaCurrent':'Sellers FBA actuales', 'market.sellersFba30':'Sellers FBA hace 30 días', 'market.priceStability':'Estabilidad de precio',
    'market.observedPriceWar':'Guerra de precios observada', 'market.amazonSeller':'Amazon como vendedor', 'inventory.expectedSellThrough90':'Sell-through esperado a 90 días',
    'market.seasonality':'Estacionalidad', 'inventory.supplierReturnAllowed':'Devolución permitida por el proveedor', 'inventory.finalSale':'Confirmación de venta final',
    'inventory.supplierReturnWindowDays':'Plazo de devolución del proveedor', 'inventory.supplierRestockingFeeRatio':'Cargo de restocking del proveedor'
  };
  const present = value => value !== null && value !== undefined && !String(value).startsWith('NO VERIFICAD');
  function missingInputs(state) {
    const m=state.market||{},i=state.inventory||{},missing={financial_resilience:[],rotation_support:[],market_pressure:[],inventory_lockup:[]};
    const fresh=m.observationAgeDays!==null&&m.observationAgeDays!==undefined&&m.observationAgeDays<=30;
    const needFresh=id=>{if(!fresh)missing[id].push('market.observationAgeDays');};
    needFresh('financial_resilience');if(!present(m.priceMinRecentUsd))missing.financial_resilience.push('market.priceMinRecentUsd');
    needFresh('rotation_support');if(!(m.bsrCurrent>0))missing.rotation_support.push('market.bsrCurrent');if(!present(m.bsrTrend))missing.rotation_support.push('market.bsrTrend');if(!(m.salesEstimatedMonthlyListing>0))missing.rotation_support.push('market.salesEstimatedMonthlyListing');
    needFresh('market_pressure');if(!(m.sellersFbaCurrent>0))missing.market_pressure.push('market.sellersFbaCurrent');if(!present(m.sellersFba30))missing.market_pressure.push('market.sellersFba30');if(!present(m.priceStability))missing.market_pressure.push('market.priceStability');if(!present(m.observedPriceWar))missing.market_pressure.push('market.observedPriceWar');if(!present(m.amazonSeller))missing.market_pressure.push('market.amazonSeller');
    needFresh('inventory_lockup');if(!present(i.expectedSellThrough90))missing.inventory_lockup.push('inventory.expectedSellThrough90');if(!present(m.seasonality))missing.inventory_lockup.push('market.seasonality');if(!present(i.supplierReturnAllowed))missing.inventory_lockup.push('inventory.supplierReturnAllowed');if(!present(i.finalSale))missing.inventory_lockup.push('inventory.finalSale');
    if(i.supplierReturnAllowed==='SÍ'){if(!(i.supplierReturnWindowDays>0))missing.inventory_lockup.push('inventory.supplierReturnWindowDays');if(!present(i.supplierRestockingFeeRatio))missing.inventory_lockup.push('inventory.supplierRestockingFeeRatio');}
    return missing;
  }
  function isCaution(id, choice) {
    return id==='financial_resilience' ? financialCautions.has(choice) : ['unsupported','pressure_detected','lockup_signal'].includes(choice);
  }
  function readingSummary(record) {
    const cautions=[],appMissing=[],modelMissing=[],completed=[],missing=missingInputs(record.state),answers=record.result.answers;
    for(const id of Object.keys(labels)){
      const answer=answers[id];
      if(!answer)appMissing.push(id);
      else if(answer.choice==='insufficient_data')modelMissing.push(id);
      else {completed.push(id);if(isCaution(id,answer.choice))cautions.push(id);}
    }
    const hasMissing=appMissing.length||modelMissing.length;
    return {cautions,appMissing,modelMissing,completed,missing,title:cautions.length?(hasMissing?'Revisar piloto y completar evidencia':'Revisar piloto antes de avanzar'):hasMissing?'Completar evidencia antes de avanzar':'Piloto sin observaciones adicionales de JEV'};
  }
  function financialDetail(record) {
    const answer=record.result.answers.financial_resilience;
    if(!answer || !financialCautions.has(answer.choice))return '';
    return readings.financial_resilience[answer.choice];
  }
  const messages = {BLOCKED:'El Motor Scoring o las condiciones del lote impiden consultar este piloto.', INSUFFICIENT_DATA:'Faltan datos para evaluar este producto.', AUTH_REQUIRED:'El servidor rechazó el acceso. Revisa el token local.', DISABLED:'JEV está desactivado en el servidor.', UNAVAILABLE:'JEV no está disponible. No se reintentó la consulta.', INVALID_RESPONSE:'La respuesta no pasó la validación. No se utiliza para decidir.', STALE:'Los datos cambiaron. Esta observación ya no corresponde al análisis actual.'};
  function node(tag, text, parent) {const e=d.createElement(tag);if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e;}
  function fieldList(ids){return ids.map(id=>fieldLabels[id]||id).join(' · ');}
  function init() {
    const host=d.getElementById('p-prod');
    if(!host || !adapter || !contract || d.getElementById('jev_observer_panel'))return;
    const style=node('style');style.textContent='#jev_observer_panel{padding-bottom:15px;margin-top:22px}#jev_observer_panel h2{font-size:18px;margin:0 0 8px}#jev_observer_panel button{min-height:44px;padding:8px 14px;font:inherit;border:1px solid var(--deep);background:var(--panel);color:var(--deep);cursor:pointer}#jev_observer_panel button:disabled{opacity:.5;cursor:default}.jev-observer-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.jev-observer-primary{background:var(--accent)!important;color:var(--accentInk)!important;border-color:var(--accent)!important}.jev-observer-note{font-size:12px;color:var(--muted);margin:8px 0}.jev-observer-result{margin-top:15px}.jev-observer-access{margin:12px 0;padding:12px;border:1px solid var(--line)}.jev-observer-summary{padding:14px;margin:12px 0;border-left:4px solid var(--deep);background:var(--panelAlt)}.jev-observer-summary h3{font-size:17px;margin:0 0 8px}.jev-observer-summary p{margin:8px 0}#jev_observer_result td{vertical-align:top}#jev_observer_result td p{margin:6px 0;line-height:1.5}#jev_observer_result details{margin-top:8px}#jev_observer_panel{min-width:0}#jev_observer_result td{overflow-wrap:anywhere}.jev-observer-missing{font-size:12px;color:var(--muted)}';d.head.appendChild(style);
    const panel=node('section',undefined,host);panel.id='jev_observer_panel';panel.className='card';panel.setAttribute('aria-labelledby','jev_observer_heading');
    function placePanel(){const operations=d.getElementById('operations_history');if(operations&&operations.parentNode&&operations.nextElementSibling!==panel)operations.after(panel);}
    w.setTimeout(placePanel,100);w.setTimeout(placePanel,300);
    node('h2','JEV · Observación externa',panel).id='jev_observer_heading';
    node('p','Consulta complementaria con los datos introducidos. Las compras y el capital siguen bajo el control del Motor Scoring.',panel).className='jev-observer-note';
    const connection=node('p','Comprobando servidor local…',panel);connection.id='jev_observer_connection';
    const access=node('details',undefined,panel);access.className='jev-observer-access';node('summary','Acceso privado a JEV',access);
    const label=node('label','Token del servidor local',access);label.className='f';label.htmlFor='jev_observer_token';
    const box=node('div',undefined,label);box.className='fbox';const token=node('input',undefined,box);token.id='jev_observer_token';token.type='password';token.autocomplete='off';token.spellcheck=false;token.maxLength=64;
    node('p','Usa JEV_ACCESS_TOKEN. La clave API de TypeSafe permanece en el servidor. El acceso dura hasta que recargues o bloquees esta página.',access).className='jev-observer-note';
    const accessActions=node('div',undefined,access);accessActions.className='jev-observer-actions';const unlock=node('button','Habilitar acceso',accessActions);unlock.type='button';unlock.id='jev_observer_unlock';const lock=node('button','Bloquear acceso',accessActions);lock.type='button';lock.id='jev_observer_lock';lock.disabled=true;
    const accessMessage=node('p','Acceso pendiente.',access);accessMessage.id='jev_observer_access_status';accessMessage.setAttribute('role','status');
    const trialLabel=node('label',undefined,panel);trialLabel.className='jev-observer-note';const trial=node('input',undefined,trialLabel);trial.type='checkbox';trial.id='jev_observer_simulated';trialLabel.appendChild(d.createTextNode(' Escenario de prueba · datos ficticios para JEV'));
    const baseline=node('p','',panel);baseline.id='jev_observer_baseline';baseline.className='jev-observer-note';
    const actions=node('div',undefined,panel);actions.className='jev-observer-actions';const evaluate=node('button','Consultar JEV · consume saldo',actions);evaluate.id='jev_observer_evaluate';evaluate.type='button';evaluate.className='jev-observer-primary';evaluate.disabled=true;const check=node('button','Comprobar conexión',actions);check.type='button';
    const status=node('p','Completa el análisis y habilita el acceso privado.',panel);status.id='jev_observer_status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const result=node('div',undefined,panel);result.id='jev_observer_result';result.className='jev-observer-result';
    node('p','La confianza y las probabilidades describen la clasificación de JEV. No son probabilidades de vender, ganar dinero o recuperar capital.',panel).className='jev-observer-note';
    let observer=null,captureOptions=null,busy=false,enabled=false,drawn='',joint=null,motorDetails=null;
    function clearJoint(){const motor=d.getElementById('jev_final_decision');if(motorDetails&&motor&&motor.parentNode===motorDetails)motorDetails.parentNode.insertBefore(motor,motorDetails);if(joint)joint.remove();if(motorDetails)motorDetails.remove();joint=null;motorDetails=null;}
    function drawJoint(record){
      clearJoint();const motor=d.getElementById('jev_final_decision');if(!motor)return;
      joint=node('section');joint.id='jev_observer_interpretation';joint.className='card jev-observer-summary';motor.parentNode.insertBefore(joint,motor);
      const interpretation=readingSummary(record),sameLot=record.baseline.recommendationAppliesToChosenLot;
      node('div','Lectura conjunta · Motor Scoring + JEV',joint).className='cardtitle';node('h3',sameLot?interpretation.title:'Revisar lote distinto al piloto calculado',joint);
      node('p','Producto '+record.identity.asin+' · '+(record.state.dataOrigin==='SIMULATED'?'escenario ficticio':'datos introducidos manualmente')+'.',joint);
      node('p',sameLot?'El Motor Scoring permite un piloto de '+record.state.lot.selectedUnits+' unidad(es), con US$'+record.state.lot.entryCapitalUsd.toFixed(2)+' de capital de entrada.':'El Motor Scoring calculó un piloto distinto. La consulta de JEV corresponde al lote elegido de '+record.state.lot.selectedUnits+' unidad(es), por US$'+record.state.lot.entryCapitalUsd.toFixed(2)+'.',joint);
      if(interpretation.appMissing.length)node('p','Datos pendientes en la calculadora: '+interpretation.appMissing.map(id=>labels[id]).join(', ')+'.',joint);
      if(interpretation.modelMissing.length)node('p','JEV evaluó pero consideró insuficiente la evidencia en: '+interpretation.modelMissing.map(id=>labels[id]).join(', ')+'.',joint);
      if(interpretation.cautions.length)node('p','JEV añade observaciones en: '+interpretation.cautions.map(id=>labels[id]).join(', ')+'.',joint);
      const financeNote=financialDetail(record);if(financeNote)node('p','Detalle financiero: '+financeNote,joint);
      const cleanCompleted=interpretation.completed.filter(id=>!interpretation.cautions.includes(id));if(cleanCompleted.length)node('p','Evaluaciones completadas sin señal adicional: '+cleanCompleted.map(id=>labels[id]).join(', ')+'.',joint);
      if(interpretation.cautions.length&&!interpretation.appMissing.length&&!interpretation.modelMissing.length)node('p','Conclusión conjunta: el piloto no queda descartado por JEV, pero deben revisarse las observaciones anteriores antes de avanzar.',joint);
      else if(interpretation.appMissing.length||interpretation.modelMissing.length)node('p','Conclusión conjunta: faltan datos o evidencia suficiente antes de cerrar la revisión del piloto.',joint);
      else node('p','Conclusión conjunta: las cuatro evaluaciones de JEV no añaden objeciones al piloto calculado. Esto no autoriza la compra ni garantiza resultados.',joint);
      node('p',record.state.dataOrigin==='SIMULATED'?'Resultado de prueba: los datos son ficticios y no validan un producto real.':'Las clasificaciones se basan en los datos enviados; JEV no comprobó su veracidad en Amazon.',joint).className='jev-observer-note';
      node('p','La conclusión del piloto se construye localmente a partir de las cuatro evaluaciones de JEV y del Motor Scoring. No existe una quinta consulta pagada de “evidencia para el piloto”. Las cautelas financieras se muestran por categoría para evitar explicaciones inventadas. No se mezclan puntajes ni se autoriza una compra automáticamente.',joint).className='jev-observer-note';
      motorDetails=node('details');motorDetails.id='jev_observer_motor_detail';motorDetails.className='jev-details';node('summary','Ver evaluación y cálculo del Motor Scoring',motorDetails);motor.parentNode.insertBefore(motorDetails,motor);motorDetails.appendChild(motor);
    }
    function draw(record){
      const key=record?record.analysisId+'|'+record.status+'|'+record.saved:'';if(key===drawn)return;drawn=key;result.replaceChildren();clearJoint();if(!record||record.status==='STALE')return;if(record.status!=='READY'){node('p',messages[record.status]||'Consulta pendiente.',result);return;}
      const missing=missingInputs(record.state);node('p','Observación para '+record.identity.asin+' · '+record.state.lot.selectedUnits+' unidad(es) · '+new Date(record.completedAt).toLocaleString('es-CL'),result);node('p','Datos: '+(record.state.dataOrigin==='SIMULATED'?'escenario ficticio':'introducidos manualmente; no verificados por JEV')+'.',result).className='jev-observer-note';drawJoint(record);node('p','La lectura conjunta aparece en la tarjeta de decisión. Aquí puedes revisar el detalle de JEV.',result).className='jev-observer-note';
      const scroll=node('div',undefined,result);scroll.className='scroll';const table=node('table',undefined,scroll);const head=node('tr',undefined,node('thead',undefined,table));['Evaluación','Lectura del resultado'].forEach(t=>node('th',t,head));const body=node('tbody',undefined,table);
      Object.keys(labels).forEach(id=>{const row=node('tr',undefined,body),answer=record.result.answers[id];node('td',labels[id],row);if(!answer){const cell=node('td',undefined,row);node('strong','No enviado a JEV',cell);node('p','La calculadora no formuló esta consulta porque faltan datos mínimos.',cell);if(missing[id].length)node('p','Faltan: '+fieldList(missing[id])+'.',cell).className='jev-observer-missing';return;}const cell=node('td',undefined,row);node('strong',answer.choice==='insufficient_data'?'Datos insuficientes según JEV':(choices[answer.choice]||answer.choice),cell);node('p',readings[id][answer.choice],cell);if(answer.choice==='insufficient_data')node('p','Los datos mínimos para formular esta consulta sí estaban presentes. JEV evaluó el bloque, pero su respuesta no especifica qué evidencia adicional necesita. No se inventa una causa.',cell).className='jev-observer-missing';const details=node('details',undefined,cell);node('summary','Ver probabilidades y confianza',details);for(const [choice,probability]of Object.entries(answer.probabilities))node('div',(choices[choice]||choice)+': '+(probability*100).toFixed(1)+'%',details);node('p','Confianza de clasificación: '+answer.confidence.toFixed(2)+'. No es una probabilidad de éxito comercial.',details).className='jev-observer-note';});
      node('p','Modelo: '+record.result.model+' · Tokens de entrada: '+record.result.usage.input_tokens+' · salida: '+record.result.usage.output_tokens,result).className='jev-observer-note';if(!record.baseline.recommendationAppliesToChosenLot)node('p','El lote consultado difiere del piloto recomendado inicialmente por el Motor Scoring.',result);if(record.saved===false)node('p','La respuesta se recibió, pero no se pudo guardar la observación en este navegador.',result);
    }
    function refresh(){placePanel();let valid=false,reason='';try{const snapshot=adapter.captureBrowser(w,{dataOrigin:trial.checked?'SIMULATED':'MANUAL'}),plan=contract.buildRequest(snapshot.state);valid=Object.keys(plan.request.questions).length>0;baseline.textContent='Motor Scoring: '+snapshot.baseline.final.decision+' · ASIN '+snapshot.identity.asin+' · Lote consultado: '+snapshot.state.lot.selectedUnits+' unidad(es), US$'+snapshot.state.lot.entryCapitalUsd.toFixed(2);if(!valid)reason='Faltan datos de mercado actuales para formular una consulta.';}catch(error){baseline.textContent='';reason=error.message;}evaluate.disabled=busy||!enabled||!observer||!valid;lock.disabled=busy||!observer;unlock.disabled=busy||!!observer;trial.disabled=busy;if(busy)return;const latest=observer&&observer.latest();draw(latest);status.textContent=!enabled?'Servidor local pendiente o JEV desactivado.':!observer?'Habilita el acceso privado para consultar.':latest&&latest.status==='STALE'?messages.STALE+(!valid&&reason?' '+reason:''):!valid?reason:'Consulta manual disponible. No se envían datos hasta pulsar el botón.';}
    async function checkConnection(){check.disabled=true;try{if(typeof w.fetch!=='function')throw new Error('Fetch unavailable');const r=await w.fetch('/api/jev/status',{cache:'no-store',credentials:'omit',redirect:'error',signal:w.AbortSignal.timeout(5000)});const value=await r.json();enabled=r.ok&&value.mode==='OBSERVATION'&&value.contractVersion===contract.VERSION&&value.enabled===true;connection.textContent=enabled?'Servidor local habilitado · modo observación.':'Servidor local disponible; JEV desactivado o configuración incompatible.';}catch{enabled=false;connection.textContent='No se pudo comprobar el servidor local.';}finally{check.disabled=false;refresh();}}
    unlock.addEventListener('click',()=>{const value=token.value.trim();token.value='';if(!/^[a-f0-9]{64}$/.test(value)){accessMessage.textContent='El token local debe tener 64 caracteres hexadecimales. Usa JEV_ACCESS_TOKEN.';return;}captureOptions={accessToken:value,dataOrigin:trial.checked?'SIMULATED':'MANUAL'};observer=adapter.browserObserver(w,captureOptions);accessMessage.textContent='Acceso preparado en memoria. El servidor lo verificará al consultar.';token.disabled=true;access.open=false;refresh();});
    lock.addEventListener('click',()=>{observer=null;captureOptions=null;token.disabled=false;token.value='';accessMessage.textContent='Acceso bloqueado.';drawn='';result.replaceChildren();clearJoint();refresh();});trial.addEventListener('change',()=>{if(captureOptions)captureOptions.dataOrigin=trial.checked?'SIMULATED':'MANUAL';refresh();});check.addEventListener('click',checkConnection);
    evaluate.addEventListener('click',async()=>{if(busy||evaluate.disabled||!observer)return;busy=true;status.textContent='Consultando JEV una vez…';result.replaceChildren();clearJoint();drawn='';refresh();try{const record=await observer.evaluate();busy=false;refresh();draw(record);if(record.status!=='READY')status.textContent=record.message||messages[record.status]||'Consulta no disponible.';}catch{busy=false;status.textContent='Consulta no disponible. No se reintentó.';refresh();}});
    for(const event of ['input','change'])d.addEventListener(event,e=>{if(!panel.contains(e.target))w.setTimeout(refresh,0);});for(const event of ['motor-scoring-state-changed','motor-scoring-operations-changed','motor-scoring-expenses-changed','storage'])w.addEventListener(event,()=>w.setTimeout(refresh,0));w.setInterval(refresh,1000);checkConnection();
  }
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init);else init();
})(window);