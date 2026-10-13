'use strict';
// Local launcher: no dependencies, provider requests, or browser-data mutations.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const RUNTIME = path.join(ROOT, '.calculator-runtime');
const RECORD = path.join(RUNTIME, 'server.json');
const LOCK = path.join(RUNTIME, 'launcher.lock');
const BRANCH = 'feature/jev-v1';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function configuration() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Necesitas Node.js 22 o posterior.');
  const envFile = path.join(ROOT, 'server', '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT no es valido.');
  const origin = 'http://127.0.0.1:' + port;
  if (process.env.JEV_PUBLIC_ORIGIN && new URL(process.env.JEV_PUBLIC_ORIGIN).origin !== origin)
    throw new Error('El lanzador local requiere JEV_PUBLIC_ORIGIN igual a ' + origin + ', o vacio.');
  return { port, origin, envFile };
}
function readRecord() {
  try {
    const r = JSON.parse(fs.readFileSync(RECORD, 'utf8'));
    return r.root === ROOT && Number.isInteger(r.controlPort) && r.controlPort > 0 && r.controlPort <= 65535 && /^[a-f0-9]{64}$/.test(r.token) ? r : null;
  } catch { return null; }
}
function removeRecord(token) {
  if (readRecord()?.token === token) fs.rmSync(RECORD, { force: true });
}
async function status(origin) {
  let response;
  try { response = await fetch(origin + '/api/jev/status', { signal: AbortSignal.timeout(1500), redirect: 'error' }); }
  catch (e) {
    if (e.cause?.code === 'ECONNREFUSED') return null;
    throw new Error('No se pudo comprobar el servidor local. No se abrira ni cerrara otro proceso.');
  }
  let value;
  try { value = await response.json(); } catch { /* An unrelated service must not be adopted. */ }
  const version = require('../jev-observer-contract.js').VERSION;
  if (!response.ok || value?.mode !== 'OBSERVATION' || value.contractVersion !== version)
    throw new Error('El puerto esta ocupado por otro servicio o una version incompatible.');
  return value;
}
function control(record, command) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: record.controlPort });
    let body = '', settled = false;
    const timer = setTimeout(() => finish(new Error('Control local no disponible.')), 1800);
    function finish(e, value) {
      if (settled) return; settled = true; clearTimeout(timer); socket.destroy();
      if (e) reject(e); else resolve(value);
    }
    socket.on('error', e => finish(e));
    socket.on('connect', () => socket.write(JSON.stringify({ token: record.token, command }) + '\n'));
    socket.on('data', chunk => {
      body += chunk.toString('utf8');
      if (body.length > 2048) return finish(new Error('Respuesta local invalida.'));
      if (!body.includes('\n')) return;
      try {
        const result = JSON.parse(body.split('\n')[0]);
        if (result.ok !== true) throw new Error('El servidor no pertenece a este lanzador.');
        finish(null, result);
      } catch (e) { finish(e); }
    });
    socket.on('end', () => finish(new Error('Control local incompleto.')));
  });
}
async function managed(record = readRecord()) {
  if (!record) return false;
  try { await control(record, 'ping'); return true; } catch { return false; }
}
function acquireLock() {
  fs.mkdirSync(RUNTIME, { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(LOCK, 'wx', 0o600);
      fs.writeFileSync(fd, String(process.pid)); fs.closeSync(fd);
      return () => fs.rmSync(LOCK, { force: true });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let pid;
      try { pid = Number(fs.readFileSync(LOCK, 'utf8')); } catch { /* Refuse an uncertain lock. */ }
      if (!Number.isInteger(pid) || pid <= 0) throw new Error('Hay un bloqueo local incompleto. Revisa .calculator-runtime/launcher.lock.');
      try { process.kill(pid, 0); }
      catch (probe) {
        if (probe.code === 'ESRCH') { fs.rmSync(LOCK, { force: true }); continue; }
      }
      throw new Error('Ya hay otra apertura o actualizacion en curso. Espera a que termine.');
    }
  }
  throw new Error('No se pudo adquirir el bloqueo local.');
}
async function start(config) {
  if (await status(config.origin)) {
    console.log('La calculadora ya esta abierta. Se reutiliza el servidor.'); return;
  }
  if (await managed()) throw new Error('El servidor administrado tiene otro puerto o no responde. Usa Cerrar-calculadora.cmd primero.');
  const record = readRecord();
  if (record) removeRecord(record.token);
  const stdout = fs.openSync(path.join(RUNTIME, 'server-output.log'), 'a', 0o600);
  const stderr = fs.openSync(path.join(RUNTIME, 'server-error.log'), 'a', 0o600);
  let child, childError;
  try {
    const args = fs.existsSync(config.envFile) ? ['--env-file=' + config.envFile] : [];
    args.push(__filename, 'serve');
    child = spawn(process.execPath, args, { cwd: ROOT, detached: true, windowsHide: true, stdio: ['ignore', stdout, stderr] });
    child.on('error', e => { childError = e; }); child.unref();
  } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
  for (let i = 0; i < 50; i++) {
    if (childError) break;
    const own = readRecord();
    if (own?.pid === child.pid && await managed(own) && await status(config.origin)) {
      console.log('Calculadora preparada en ' + config.origin + '/'); return;
    }
    await delay(200);
  }
  throw new Error('El servidor no arranco. Revisa .calculator-runtime/server-error.log.');
}
async function stop(config) {
  const record = readRecord();
  if (!await managed(record)) {
    if (await status(config.origin))
      throw new Error('Este servidor se inicio manualmente. Detenlo una vez con Ctrl+C en su PowerShell.');
    if (record) removeRecord(record.token);
    console.log('La calculadora ya esta cerrada.'); return;
  }
  await control(record, 'stop');
  for (let i = 0; i < 50; i++) {
    if (!await managed(record) && !await status(config.origin)) {
      removeRecord(record.token); console.log('Servidor de la calculadora cerrado.'); return;
    }
    await delay(200);
  }
  throw new Error('El servidor no termino de cerrar. No se iniciara otro.');
}
function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  if (r.error || r.status !== 0)
    throw new Error('Git no pudo completar ' + args[0] + '. ' + (r.stderr || r.error?.message || '').trim());
  return r.stdout.trim();
}
async function update(config) {
  if (git(['branch', '--show-current']) !== BRANCH) throw new Error('Actualiza desde la rama ' + BRANCH + '. No se cambiara tu rama.');
  if (git(['status', '--porcelain', '--untracked-files=no']))
    throw new Error('Hay cambios locales en archivos del proyecto. No se sobrescribiran.');
  const remote = git(['config', '--get', 'remote.origin.url']);
  if (!/^(https:\/\/github\.com\/|git@github\.com:)jesusvvg\/Calculadora-FBA-Amazon-Compuesto(?:\.git)?\/?$/.test(remote))
    throw new Error('El origen Git no corresponde al proyecto.');
  if (await status(config.origin) && !await managed())
    throw new Error('Deten una vez el servidor manual con Ctrl+C. Luego vuelve a hacer doble clic en Actualizar-calculadora.cmd.');
  console.log('Descargando actualizacion...');
  console.log(git(['pull', '--ff-only', 'origin', BRANCH]));
  // Only stop after a successful download; a failed pull leaves the service running.
  if (await managed()) await stop(config);
  // Run the newly downloaded launcher, rather than the version cached in this process.
  const args = fs.existsSync(config.envFile) ? ['--env-file=' + config.envFile] : [];
  args.push(__filename, 'start-after-update');
  const fresh = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', windowsHide: true, timeout: 20000 });
  if (fresh.error || fresh.status !== 0) throw new Error('Los archivos se descargaron, pero el servidor no arranco. Usa Abrir-calculadora.cmd para reintentar.');
  console.log('Actualizacion terminada. Si la pestana ya estaba abierta, pulsa Ctrl+F5.');
}
async function openBrowser(origin) {
  if (process.argv.includes('--no-browser')) return;
  // Fixed loopback URL, passed as one argument, never shell-interpolated.
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  await new Promise((resolve, reject) => {
    const child = spawn(command, [origin + '/'], { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => reject(new Error('El servidor esta listo. Abre ' + origin + '/ en tu navegador.')));
    child.on('spawn', () => { child.unref(); resolve(); });
  });
}
async function serve(config) {
  const token = crypto.randomBytes(32).toString('hex');
  const app = require('../server/jev-server.cjs').createServer({
    enabled: process.env.JEV_ENABLED === '1', apiKey: process.env.TYPESAFE_API_KEY,
    accessToken: process.env.JEV_ACCESS_TOKEN, publicOrigin: process.env.JEV_PUBLIC_ORIGIN
  });
  let closing = false;
  const local = net.createServer(socket => {
    let body = ''; socket.setTimeout(2000, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('data', chunk => {
      body += chunk.toString('utf8');
      if (body.length > 2048) return socket.destroy();
      if (!body.includes('\n')) return;
      let request;
      try { request = JSON.parse(body.split('\n')[0]); } catch { return socket.destroy(); }
      if (typeof request.token !== 'string' || !/^[a-f0-9]{64}$/.test(request.token) ||
        !crypto.timingSafeEqual(Buffer.from(request.token), Buffer.from(token)) || !['ping','stop'].includes(request.command))
        return socket.end('{"ok":false}\n');
      socket.end('{"ok":true}\n');
      if (request.command === 'stop') socket.once('close', close);
    });
  });
  function close() {
    if (closing) return; closing = true;
    removeRecord(token); local.close(); app.close(); app.closeAllConnections();
    setTimeout(() => process.exit(0), 200).unref();
  }
  process.once('SIGTERM', close); process.once('SIGINT', close);
  process.once('exit', () => removeRecord(token));
  try {
    await new Promise((resolve,reject) => { app.once('error',reject); app.listen(config.port,'127.0.0.1',resolve); });
    await new Promise((resolve,reject) => { local.once('error',reject); local.listen(0,'127.0.0.1',resolve); });
    fs.writeFileSync(RECORD, JSON.stringify({ root: ROOT, controlPort: local.address().port, pid: process.pid, token, origin: config.origin }), { mode: 0o600 });
  } catch (e) { close(); throw e; }
}
async function main() {
  const action = process.argv[2] || 'open';
  if (!['open','update','stop','serve','start-after-update'].includes(action)) throw new Error('Accion desconocida.');
  const config = configuration();
  if (action === 'serve') return serve(config);
  if (action === 'start-after-update') { await start(config); return; }
  const release = acquireLock();
  try {
    if (action === 'stop') await stop(config);
    else if (action === 'update') { await update(config); await openBrowser(config.origin); }
    else { await start(config); await openBrowser(config.origin); }
  } finally { release(); }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { configuration, readRecord, status, managed, control, main };
