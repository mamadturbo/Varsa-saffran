// One command starts both the local API services and the storefront.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { once } from 'node:events';
const root = path.resolve(import.meta.dirname, '..');
const apiRoot = path.join(root, 'artifacts/api-server');
const children = [];
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    if (child.connected) child.send('shutdown');
    else child.kill();
  }
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
function run(args, cwd, ipc = false) {
  const child = spawn(process.execPath, args, { cwd, stdio: ipc ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit', windowsHide: true });
  children.push(child);
  child.once('error', () => stop(1));
  return child;
}
const build = run(['build.mjs'], apiRoot);
const [built] = await once(build, 'exit');
if (built !== 0) process.exit(1);
const api = run(['--import', 'tsx', 'scripts/dev-local.ts'], apiRoot, true);
api.once('exit', code => { if (!closing) stop(code ?? 1); });
let ready = false;
for (let attempt = 0; attempt < 120 && !closing; attempt++) {
  try { ready = (await fetch('http://127.0.0.1:5000/api/healthz', { signal: AbortSignal.timeout(1000) })).ok; } catch {}
  if (ready) break;
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (!ready) { console.error('Local API failed to become ready.'); stop(1); }
else {
  const web = run(['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts', '--host', '127.0.0.1'], path.join(root, 'artifacts/varsa-shop'));
  web.once('exit', code => { if (!closing) stop(code ?? 1); });
}
