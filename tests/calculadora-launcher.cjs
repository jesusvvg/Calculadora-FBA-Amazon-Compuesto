'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const SOURCE = path.resolve(__dirname, '..');
async function freePort() {
  const s = net.createServer();
  await new Promise(resolve => s.listen(0,'127.0.0.1',resolve));
  const port = s.address().port; await new Promise(resolve => s.close(resolve)); return port;
}
function git(root, ...args) {
  const r = spawnSync('git', args, { cwd: root, encoding:'utf8' });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
function run(root, action) {
  return new Promise((resolve,reject) => {
    const env = { ...process.env };
    for (const key of ['PORT','JEV_PUBLIC_ORIGIN','JEV_ENABLED','TYPESAFE_API_KEY','JEV_ACCESS_TOKEN']) delete env[key];
    const child = spawn(process.execPath, [path.join(root,'scripts/calculadora-launcher.cjs'),action,'--no-browser'], { cwd:os.tmpdir(),env });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Launcher timeout: ' + out + err)); },25000);
    child.stdout.on('data', d => out += d); child.stderr.on('data', d => err += d);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('exit', code => { clearTimeout(timer); resolve({ code,out,err }); });
  });
}
async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'calc space '));
  fs.mkdirSync(path.join(root,'scripts')); fs.mkdirSync(path.join(root,'server'));
  for (const p of ['scripts/calculadora-launcher.cjs','server/jev-server.cjs','jev-observer-contract.js','index.html','.gitignore'])
    fs.copyFileSync(path.join(SOURCE,p),path.join(root,p));
  const port = await freePort();
  fs.writeFileSync(path.join(root,'server/.env'),'PORT=' + port + '\nJEV_ENABLED=0\nTYPESAFE_API_KEY=TEST_SECRET_NOT_TO_PRINT\n');
  return { root,port,origin:'http://127.0.0.1:' + port };
}
function record(f) { return JSON.parse(fs.readFileSync(path.join(f.root,'.calculator-runtime/server.json'),'utf8')); }
async function command(r,token,action) {
  return new Promise((resolve,reject) => {
    const s = net.createConnection({host:'127.0.0.1',port:r.controlPort}); let value = '';
    s.on('error',reject); s.on('connect',() => s.write(JSON.stringify({token,command:action}) + '\n'));
    s.on('data',d => value += d); s.on('end',() => resolve(JSON.parse(value))); s.setTimeout(2000,() => s.destroy());
  });
}
test('launcher lifecycle and update protection', async t => {
  const f = await fixture();
  t.after(async () => { await run(f.root,'stop'); fs.rmSync(f.root,{recursive:true,force:true}); });
  const envOriginal = fs.readFileSync(path.join(f.root,'server/.env'),'utf8');
  await t.test('opens from another cwd with spaces; duplicate open reuses PID',async () => {
    const first = await run(f.root,'open'); assert.equal(first.code,0,first.err);
    const r = record(f); const second = await run(f.root,'open'); assert.equal(second.code,0,second.err);
    assert.equal(record(f).pid,r.pid); assert.match(second.out,/reutiliza/);
    const status = await (await fetch(f.origin + '/api/jev/status')).json();
    assert.equal(status.enabled,false); assert.equal(status.mode,'OBSERVATION');
    assert.equal(first.out.includes('TEST_SECRET'),false);
    assert.equal(fs.readFileSync(path.join(f.root,'server/.env'),'utf8'),envOriginal);
  });
  await t.test('invalid control tokens do not stop the server',async () => {
    const r = record(f);
    assert.equal((await command(r,'0'.repeat(64),'stop')).ok,false);
    assert.equal((await command(r,'é'.repeat(64),'stop')).ok,false);
    assert.equal((await fetch(f.origin + '/api/jev/status')).status,200);
  });
  await t.test('concurrent action is rejected without stopping server',async () => {
    const lock = path.join(f.root,'.calculator-runtime/launcher.lock');
    fs.writeFileSync(lock,String(process.pid));
    try { const result = await run(f.root,'open'); assert.equal(result.code,1); assert.match(result.err,/curso/); }
    finally { fs.rmSync(lock); }
    assert.equal((await fetch(f.origin + '/api/jev/status')).status,200);
  });
  git(f.root,'init','-b','feature/jev-v1'); git(f.root,'config','user.name','Launcher tests'); git(f.root,'config','user.email','launcher@example.invalid');
  git(f.root,'add','.'); git(f.root,'commit','-m','fixture');
  git(f.root,'remote','add','origin','https://github.com/jesusvvg/Calculadora-FBA-Amazon-Compuesto.git');
  const remote = fs.mkdtempSync(path.join(os.tmpdir(),'calc remote '));
  t.after(() => fs.rmSync(remote,{recursive:true,force:true}));
  git(remote,'init','--bare');
  // Exercise production remote validation while redirecting transport to an offline test repo.
  git(f.root,'config','url.' + remote + '.insteadOf','https://github.com/jesusvvg/Calculadora-FBA-Amazon-Compuesto.git');
  git(f.root,'push','-u','origin','feature/jev-v1');
  await t.test('dirty tracked files reject update and preserve server',async () => {
    fs.appendFileSync(path.join(f.root,'index.html'),'\n<!-- local change -->');
    const pid = record(f).pid; const result = await run(f.root,'update');
    assert.equal(result.code,1); assert.match(result.err,/cambios locales/); assert.equal(record(f).pid,pid);
    git(f.root,'checkout','--','index.html');
  });
  await t.test('wrong branch rejects update',async () => {
    git(f.root,'checkout','-b','another-branch'); const result = await run(f.root,'update');
    assert.equal(result.code,1); assert.match(result.err,/rama/); git(f.root,'checkout','feature/jev-v1');
  });
  await t.test('failed pull leaves old server alive',async () => {
    git(f.root,'config','url.' + remote + '.insteadOf','unused-test-origin');
    const absent = path.join(remote,'missing');
    git(f.root,'config','url.' + absent + '.insteadOf','https://github.com/jesusvvg/Calculadora-FBA-Amazon-Compuesto.git');
    const pid = record(f).pid; const result = await run(f.root,'update');
    assert.equal(result.code,1); assert.equal(record(f).pid,pid);
    assert.equal((await fetch(f.origin + '/api/jev/status')).status,200);
    git(f.root,'config','--unset','url.' + absent + '.insteadOf');
    git(f.root,'config','url.' + remote + '.insteadOf','https://github.com/jesusvvg/Calculadora-FBA-Amazon-Compuesto.git');
  });
  await t.test('successful fast-forward downloads changes and restarts once',async () => {
    const writer = fs.mkdtempSync(path.join(os.tmpdir(),'calc writer '));
    try {
      git(writer,'clone','--branch','feature/jev-v1',remote,'.'); git(writer,'config','user.name','Tests'); git(writer,'config','user.email','tests@example.invalid');
      fs.appendFileSync(path.join(writer,'index.html'),'\n<!-- updated fixture -->');
      git(writer,'add','index.html'); git(writer,'commit','-m','update fixture'); git(writer,'push');
      const pid = record(f).pid; const result = await run(f.root,'update');
      assert.equal(result.code,0,result.err); assert.notEqual(record(f).pid,pid);
      assert.match(await (await fetch(f.origin + '/')).text(),/updated fixture/);
      assert.equal(fs.readFileSync(path.join(f.root,'server/.env'),'utf8'),envOriginal);
    } finally { fs.rmSync(writer,{recursive:true,force:true}); }
  });
  await t.test('stop and restart work; stale PID is never killed',async () => {
    assert.equal((await run(f.root,'stop')).code,0);
    const old = { root:f.root,controlPort:await freePort(),pid:process.pid,token:'f'.repeat(64),origin:f.origin };
    fs.writeFileSync(path.join(f.root,'.calculator-runtime/server.json'),JSON.stringify(old));
    assert.equal((await run(f.root,'open')).code,0);
    assert.equal((await fetch(f.origin + '/api/jev/status')).status,200);
    assert.equal((await run(f.root,'stop')).code,0);
  });
  await t.test('unmanaged server is reused for open; update and stop refuse to kill it',async () => {
    const { createServer } = require(path.join(f.root,'server/jev-server.cjs'));
    const app = createServer(); await new Promise(resolve => app.listen(f.port,'127.0.0.1',resolve));
    try {
      assert.equal((await run(f.root,'open')).code,0);
      const result = await run(f.root,'update'); assert.equal(result.code,1); assert.match(result.err,/Ctrl\+C/);
      assert.equal((await run(f.root,'stop')).code,1);
      assert.equal((await fetch(f.origin + '/api/jev/status')).status,200);
    } finally { app.closeAllConnections(); await new Promise(resolve => app.close(resolve)); }
  });
  await t.test('unrelated occupied port is left untouched',async () => {
    const http = require('node:http'); const other = http.createServer((req,res) => res.end('other service'));
    await new Promise(resolve => other.listen(f.port,'127.0.0.1',resolve));
    try { const result = await run(f.root,'open'); assert.equal(result.code,1); assert.match(result.err,/otro servicio/); }
    finally { other.closeAllConnections(); await new Promise(resolve => other.close(resolve)); }
  });
});
