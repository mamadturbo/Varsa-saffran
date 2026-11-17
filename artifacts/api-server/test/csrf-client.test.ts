import test from 'node:test';
import assert from 'node:assert/strict';
import { customFetch } from '../../../lib/api-client-react/src/custom-fetch';

test('CSRF startup reports backend outage and permits a successful retry without refresh', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'http://127.0.0.1:5173' } } });
  let stage: 'offline' | 'network' | 'malformed' | 'ready' = 'offline';
  let mutations = 0;
  globalThis.fetch = async (input, init) => {
    if (input === '/api/csrf') {
      if (stage === 'offline') return new Response('', { status: 500 });
      if (stage === 'network') throw new TypeError('fetch failed');
      return Response.json(stage === 'malformed' ? {} : { csrfToken: 'test-csrf' });
    }
    mutations++;
    assert.equal(new Headers(init?.headers).get('X-Varsa-CSRF'), 'test-csrf');
    return Response.json({ ok: true });
  };
  try {
    const submit = () => customFetch('/api/customer/auth/request', { method: 'POST', body: '{}' });
    await assert.rejects(submit(), /ارتباط با سرور برقرار نیست/);
    stage = 'network';
    await assert.rejects(submit(), /ارتباط با سرور برقرار نیست/);
    stage = 'malformed';
    await assert.rejects(submit(), /پاسخ سرور معتبر نیست/);
    assert.equal(mutations, 0);
    stage = 'ready';
    assert.deepEqual(await submit(), { ok: true });
    assert.equal(mutations, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
