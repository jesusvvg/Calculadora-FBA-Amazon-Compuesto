'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const contract = require('../jev-observer-contract.js');
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const root = path.resolve(__dirname, '..');
const PUBLIC_FILES = new Set(['index.html','manifest.json','sw.js','amazon-plan-expenses.js','jev-v1.js','jev-phase2.js','jev-phase3.js',
  'jev-phase4-market.js','jev-phase5-rotation-risk.js','jev-phase6-engine.js','operations-v1.js','jev-financial-sync.js','data-tools.js','scanner-bridge.js',
  'jev-observer-contract.js','jev-observer-adapter.js','jev-observer-panel.js','icons/icon-192.png','icons/icon-512.png','icons/icon-512-maskable.png']);
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
function equalSecret(actual, expected) {
  return typeof actual === 'string' && crypto.timingSafeEqual(Buffer.from(digest(actual)),Buffer.from(digest(expected)));
}
function error(code, status) { const e = new Error(code); e.code=code; e.status=status; return e; }
function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let data='', bytes=0, ended=false;
    const timer=setTimeout(() => fail(error('REQUEST_TIMEOUT',408)),5000);
    function fail(e) { if (ended) return; ended=true; clearTimeout(timer); reject(e); req.resume(); }
    req.setEncoding('utf8');
    req.on('data',chunk => { bytes+=Buffer.byteLength(chunk); if(bytes>maxBytes) fail(error('BODY_TOO_LARGE',413)); else if(!ended)data+=chunk; });
    req.on('end',() => { if(ended)return;ended=true;clearTimeout(timer);try{resolve(JSON.parse(data));}catch{reject(error('INVALID_JSON',400));} });
    req.on('error',() => fail(error('REQUEST_ERROR',400)));
    req.on('aborted',() => fail(error('REQUEST_ABORTED',400)));
  });
}
async function readUpstream(response, maxBytes) {
  const reader=response.body && response.body.getReader();
  if(!reader) throw error('INVALID_RESPONSE',502);
  const chunks=[];let bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
    if(bytes>maxBytes){await reader.cancel();throw error('INVALID_RESPONSE',502);}chunks.push(Buffer.from(value));}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw error('INVALID_RESPONSE',502);}
}
function createServer(options={}) {
  const enabled=options.enabled === true, apiKey=options.apiKey || '', accessToken=options.accessToken || '';
  const fetchImpl=options.fetchImpl || fetch, now=options.now || Date.now;
  const maxCallsPerDay=options.maxCallsPerDay ?? 100, maxCallsPerMinute=options.maxCallsPerMinute ?? 6;
  const maxConcurrent=options.maxConcurrent ?? 2, timeoutMs=options.timeoutMs ?? 10000;
  const publicOrigin=options.publicOrigin ? new URL(options.publicOrigin) : null;
  if(publicOrigin && (publicOrigin.pathname!=='/' || publicOrigin.search || publicOrigin.hash || publicOrigin.username || publicOrigin.password ||
      (!['localhost','127.0.0.1','[::1]'].includes(publicOrigin.hostname) && publicOrigin.protocol!=='https:'))) throw new Error('JEV_PUBLIC_ORIGIN requiere HTTPS o localhost, sin ruta.');
  if(enabled && accessToken.length<32) throw new Error('JEV_ACCESS_TOKEN debe tener al menos 32 caracteres.');
  let day=-1, attempts=0, minute=[], active=0;
  const metrics={upstreamCalls:0, acceptedResponses:0, inputTokens:0, outputTokens:0};
  function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(value));}
  const server=http.createServer(async(req,res) => {
    try {
      const expected=publicOrigin || new URL('http://127.0.0.1:'+server.address().port);
      if(req.headers.host !== expected.host) throw error('INVALID_HOST',403);
      if((req.headers.origin && req.headers.origin !== expected.origin) || req.headers['sec-fetch-site']==='cross-site') throw error('INVALID_ORIGIN',403);
      const url=new URL(req.url,expected);
      if(req.method==='GET' && url.pathname==='/api/jev/status') return json(res,200,{mode:'OBSERVATION',enabled:enabled&&!!apiKey,contractVersion:contract.VERSION});
      if(url.pathname==='/api/jev/review') {
        if(req.method!=='POST') {res.setHeader('Allow','POST');throw error('METHOD_NOT_ALLOWED',405);}
        if(!accessToken || !equalSecret(req.headers.authorization,'Bearer '+accessToken)) throw error('AUTH_REQUIRED',401);
        if(!enabled || !apiKey) throw error('DISABLED',503);
        if(req.headers['content-type']?.split(';')[0]!=='application/json') throw error('CONTENT_TYPE_REQUIRED',415);
        const envelope=await readBody(req,16384);
        if(!envelope || typeof envelope!=='object' || Array.isArray(envelope) || Object.keys(envelope).length!==2 ||
          !Object.hasOwn(envelope,'state') || typeof envelope.analysisId!=='string' || !/^[A-Za-z0-9:._-]{1,100}$/.test(envelope.analysisId)) throw error('INVALID_INPUT',422);
        let plan;
        try{plan=contract.buildRequest(envelope.state);}catch(e){throw error(e.code==='BLOCKED'?'BLOCKED':'INVALID_INPUT',422);}
        if(!Object.keys(plan.request.questions).length) return json(res,200,{status:'INSUFFICIENT_DATA',mode:'OBSERVATION',contractVersion:contract.VERSION,analysisId:envelope.analysisId,skipped:plan.skipped});
        const time=now(), currentDay=Math.floor(time/86400000);
        if(day!==currentDay){day=currentDay;attempts=0;}
        minute=minute.filter(t=>time-t<60000);
        if(attempts>=maxCallsPerDay || minute.length>=maxCallsPerMinute || active>=maxConcurrent) {res.setHeader('Retry-After','60');throw error('LOCAL_LIMIT',429);}
        // Attempts are counted before calling the paid API; no automatic retry or duplicate charge.
        attempts++;minute.push(time);active++;metrics.upstreamCalls++;
        const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeoutMs);
        const disconnected=()=>controller.abort();res.on('close',disconnected);
        const started=now();
        try {
          const upstream=await fetchImpl(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},
            body:JSON.stringify(plan.request),signal:controller.signal,redirect:'error'});
          if(!upstream.ok){await upstream.body?.cancel();throw error(upstream.status===401?'PROVIDER_AUTH_ERROR':
            upstream.status===429?'PROVIDER_LIMIT':upstream.status===529?'PROVIDER_OVERLOADED':'UNAVAILABLE',502);}
          let result;
          try{result=contract.validateResponse(await readUpstream(upstream,65536),plan.request.questions);}catch(e){throw error('INVALID_RESPONSE',502);}
          metrics.acceptedResponses++;metrics.inputTokens+=result.usage.input_tokens;metrics.outputTokens+=result.usage.output_tokens;
          return json(res,200,{status:'READY',mode:'OBSERVATION',contractVersion:contract.VERSION,analysisId:envelope.analysisId,
            fingerprint:digest(JSON.stringify(plan.request.state)),skipped:plan.skipped,result,latencyMs:Math.max(0,now()-started)});
        } catch(e) {if(e.status)throw e;throw error(controller.signal.aborted?'UPSTREAM_TIMEOUT':'UNAVAILABLE',502);}
        finally {clearTimeout(timer);res.removeListener('close',disconnected);active--;}
      }
      if(req.method==='GET' || req.method==='HEAD') {
        const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
        if(!PUBLIC_FILES.has(name)) throw error('NOT_FOUND',404);
        const file=path.join(root,name),body=await fs.promises.readFile(file);
        res.writeHead(200,{'Content-Type':name.endsWith('.js')?'application/javascript; charset=utf-8':name.endsWith('.png')?'image/png':
          name.endsWith('.json')?'application/json; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        return res.end(req.method==='HEAD'?undefined:body);
      }
      throw error('NOT_FOUND',404);
    }catch(e){if(!res.headersSent && !res.destroyed)json(res,e.status||500,{status:e.code||'SERVER_ERROR'});}
  });
  server.requestTimeout=6000;server.headersTimeout=5000;server.keepAliveTimeout=2000;
  server.metrics=()=>({...metrics,attemptsToday:attempts,active});
  return server;
}
if(require.main===module){
  const port=Number(process.env.PORT || 8787);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT inválido.');
  const server=createServer({enabled:process.env.JEV_ENABLED==='1',apiKey:process.env.TYPESAFE_API_KEY,accessToken:process.env.JEV_ACCESS_TOKEN,
    publicOrigin:process.env.JEV_PUBLIC_ORIGIN});
  server.listen(port,'127.0.0.1',()=>console.log('Servidor privado preparado en http://127.0.0.1:'+port+' · JEV '+(process.env.JEV_ENABLED==='1'&&process.env.TYPESAFE_API_KEY?'configurado':'desactivado')));
}
module.exports={createServer};
