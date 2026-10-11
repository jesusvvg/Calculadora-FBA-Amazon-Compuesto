(function (w) {
  'use strict';
  // Local observation UI. The provider key never belongs in this page.
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(w.location.hostname)) return;
  const d = w.document, adapter = w.JevObserverAdapter, contract = w.JevObserverContract;
  const labels = {financial_resilience:'Resistencia financiera', rotation_support:'Rotación',
    market_pressure:'Competencia', inventory_lockup:'Inventario inmovilizado', pilot_evidence:'Evidencia para el piloto'};
  const choices = {supported:'Con respaldo', caveat_detected:'Señal de cautela', insufficient_data:'Datos insuficientes',
    unsupported:'Sin respaldo', manageable:'Manejable', pressure_detected:'Presión detectada',
    no_material_signal:'Sin señal material', lockup_signal:'Riesgo de inmovilización', supported_for_review:'Con respaldo para revisión'};
  const messages = {BLOCKED:'El Motor Scoring o las condiciones del lote impiden consultar este piloto.',
    INSUFFICIENT_DATA:'Faltan datos para evaluar este producto.', AUTH_REQUIRED:'El servidor rechazó el acceso. Revisa el token local.',
    DISABLED:'JEV está desactivado en el servidor.', UNAVAILABLE:'JEV no está disponible. No se reintentó la consulta.',
    INVALID_RESPONSE:'La respuesta no pasó la validación. No se utiliza para decidir.',
    STALE:'Los datos cambiaron. Esta observación ya no corresponde al análisis actual.'};
  function node(tag, text, parent) {const e=d.createElement(tag);if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e;}
  function init() {
    const host=d.getElementById('p-prod');
    if(!host || !adapter || !contract || d.getElementById('jev_observer_panel'))return;
    const style=node('style');style.textContent='#jev_observer_panel{padding-bottom:15px;margin-top:22px}#jev_observer_panel h2{font-size:18px;margin:0 0 8px}#jev_observer_panel button{min-height:44px;padding:8px 14px;font:inherit;border:1px solid var(--deep);background:#fff;color:var(--deep);cursor:pointer}#jev_observer_panel button:disabled{opacity:.5;cursor:default}.jev-observer-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.jev-observer-primary{background:var(--deep)!important;color:#fff!important}.jev-observer-note{font-size:12px;color:var(--muted);margin:8px 0}.jev-observer-result{margin-top:15px}.jev-observer-access{margin:12px 0;padding:12px;border:1px solid var(--line)}';d.head.appendChild(style);
    const panel=node('section',undefined,host);panel.id='jev_observer_panel';panel.className='card';panel.setAttribute('aria-labelledby','jev_observer_heading');
    node('h2','JEV · Observación externa',panel).id='jev_observer_heading';
    node('p','Consulta complementaria con los datos introducidos. Las compras y el capital siguen bajo el control del Motor Scoring.',panel).className='jev-observer-note';
    const connection=node('p','Comprobando servidor local…',panel);connection.id='jev_observer_connection';
    const access=node('details',undefined,panel);access.className='jev-observer-access';node('summary','Acceso privado a JEV',access);
    const label=node('label','Token del servidor local',access);label.className='f';label.htmlFor='jev_observer_token';
    const box=node('div',undefined,label);box.className='fbox';
    const token=node('input',undefined,box);token.id='jev_observer_token';token.type='password';token.autocomplete='off';token.spellcheck=false;token.maxLength=64;
    node('p','Usa JEV_ACCESS_TOKEN. La clave API de TypeSafe permanece en el servidor. El acceso dura hasta que recargues o bloquees esta página.',access).className='jev-observer-note';
    const accessActions=node('div',undefined,access);accessActions.className='jev-observer-actions';
    const unlock=node('button','Habilitar acceso',accessActions);unlock.type='button';unlock.id='jev_observer_unlock';
    const lock=node('button','Bloquear acceso',accessActions);lock.type='button';lock.id='jev_observer_lock';lock.disabled=true;
    const accessMessage=node('p','Acceso pendiente.',access);accessMessage.id='jev_observer_access_status';accessMessage.setAttribute('role','status');
    const baseline=node('p','',panel);baseline.id='jev_observer_baseline';baseline.className='jev-observer-note';
    const actions=node('div',undefined,panel);actions.className='jev-observer-actions';
    const evaluate=node('button','Consultar JEV · consume saldo',actions);evaluate.id='jev_observer_evaluate';evaluate.type='button';evaluate.className='jev-observer-primary';evaluate.disabled=true;
    const check=node('button','Comprobar conexión',actions);check.type='button';
    const status=node('p','Completa el análisis y habilita el acceso privado.',panel);status.id='jev_observer_status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const result=node('div',undefined,panel);result.id='jev_observer_result';result.className='jev-observer-result';
    node('p','La confianza y las probabilidades describen la clasificación de JEV. No son probabilidades de vender, ganar dinero o recuperar capital.',panel).className='jev-observer-note';
    let observer=null, busy=false, enabled=false, drawn='';
    function draw(record) {
      const key=record ? record.analysisId+'|'+record.status+'|'+record.saved : '';
      if(key===drawn)return;drawn=key;result.replaceChildren();
      if(!record)return;
      if(record.status!=='READY'){node('p',messages[record.status]||'Consulta pendiente.',result);return;}
      node('p','Observación para '+record.identity.asin+' · '+record.state.lot.selectedUnits+' unidad(es) · '+new Date(record.completedAt).toLocaleString('es-CL'),result);
      node('p','Datos: '+(record.state.dataOrigin==='SIMULATED'?'escenario ficticio':'introducidos manualmente; no verificados por JEV')+'.',result).className='jev-observer-note';
      const scroll=node('div',undefined,result);scroll.className='scroll';const table=node('table',undefined,scroll);
      const head=node('tr',undefined,node('thead',undefined,table));['Evaluación','Resultado','Confianza'].forEach(t=>node('th',t,head));
      const body=node('tbody',undefined,table);
      Object.keys(labels).forEach(id=>{
        const row=node('tr',undefined,body), answer=record.result.answers[id];node('td',labels[id],row);
        if(!answer){node('td','Omitida: faltan datos actuales',row);node('td','—',row);return;}
        const cell=node('td',choices[answer.choice]||answer.choice,row);
        const details=node('details',undefined,cell);node('summary','Ver probabilidades',details);
        for(const [choice,probability]of Object.entries(answer.probabilities))node('div',(choices[choice]||choice)+': '+(probability*100).toFixed(1)+'%',details);
        node('td',answer.confidence.toFixed(2),row).className='n';
      });
      node('p','Modelo: '+record.result.model+' · Tokens de entrada: '+record.result.usage.input_tokens+' · salida: '+record.result.usage.output_tokens,result).className='jev-observer-note';
      if(!record.baseline.recommendationAppliesToChosenLot)node('p','El lote consultado difiere del piloto recomendado inicialmente por el Motor Scoring.',result);
      if(record.saved===false)node('p','La respuesta se recibió, pero no se pudo guardar la observación en este navegador.',result);
    }
    function refresh() {
      let valid=false, reason='';
      try {
        const snapshot=adapter.captureBrowser(w),plan=contract.buildRequest(snapshot.state);
        valid=Object.keys(plan.request.questions).length>0;
        baseline.textContent='Motor Scoring: '+snapshot.baseline.final.decision+' · ASIN '+snapshot.identity.asin+' · Lote consultado: '+snapshot.state.lot.selectedUnits+' unidad(es), US$'+snapshot.state.lot.entryCapitalUsd.toFixed(2);
        if(!valid)reason='Faltan datos de mercado actuales para formular una consulta.';
      }catch(error){baseline.textContent='';reason=error.message;}
      evaluate.disabled=busy||!enabled||!observer||!valid;lock.disabled=busy||!observer;unlock.disabled=busy||!!observer;
      if(busy)return;
      const latest=observer&&observer.latest();draw(latest);
      status.textContent=!enabled?'Servidor local pendiente o JEV desactivado.':!observer?'Habilita el acceso privado para consultar.':!valid?reason:latest&&latest.status==='STALE'?messages.STALE:'Consulta manual disponible. No se envían datos hasta pulsar el botón.';
    }
    async function checkConnection() {
      check.disabled=true;
      try {
        if(typeof w.fetch!=='function')throw new Error('Fetch unavailable');
        const r=await w.fetch('/api/jev/status',{cache:'no-store',credentials:'omit',redirect:'error',signal:w.AbortSignal.timeout(5000)});
        const value=await r.json();enabled=r.ok&&value.mode==='OBSERVATION'&&value.contractVersion===contract.VERSION&&value.enabled===true;
        connection.textContent=enabled?'Servidor local habilitado · modo observación.':'Servidor local disponible; JEV desactivado o configuración incompatible.';
      }catch{enabled=false;connection.textContent='No se pudo comprobar el servidor local.';}
      finally{check.disabled=false;refresh();}
    }
    unlock.addEventListener('click',()=>{
      const value=token.value.trim();token.value='';
      if(!/^[a-f0-9]{64}$/.test(value)){accessMessage.textContent='El token local debe tener 64 caracteres hexadecimales. Usa JEV_ACCESS_TOKEN.';return;}
      observer=adapter.browserObserver(w,{accessToken:value});accessMessage.textContent='Acceso preparado en memoria. El servidor lo verificará al consultar.';token.disabled=true;access.open=false;refresh();
    });
    lock.addEventListener('click',()=>{observer=null;token.disabled=false;token.value='';accessMessage.textContent='Acceso bloqueado.';drawn='';result.replaceChildren();refresh();});
    check.addEventListener('click',checkConnection);
    evaluate.addEventListener('click',async()=>{
      if(busy||evaluate.disabled||!observer)return;
      busy=true;status.textContent='Consultando JEV una vez…';result.replaceChildren();drawn='';refresh();
      try{const record=await observer.evaluate();busy=false;refresh();draw(record);if(record.status!=='READY')status.textContent=record.message||messages[record.status]||'Consulta no disponible.';}
      catch{busy=false;status.textContent='Consulta no disponible. No se reintentó.';refresh();}
    });
    for(const event of ['input','change'])d.addEventListener(event,e=>{if(!panel.contains(e.target))w.setTimeout(refresh,0);});
    for(const event of ['motor-scoring-state-changed','motor-scoring-operations-changed','storage'])w.addEventListener(event,()=>w.setTimeout(refresh,0));
    w.setInterval(refresh,1000);checkConnection();
  }
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init);else init();
})(window);
