import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1/unused';
test('local private storage persists bytes and rejects traversal keys', async () => {
 const root=await mkdtemp(join(tmpdir(),'varsa-files-'));
 process.env.STORAGE_DRIVER='local'; process.env.STORAGE_LOCAL_ROOT=root;
 try {
  const {s3Storage}=await import('../src/modules/files/storage');
  const store=s3Storage(),key='private/account-id/'+ 'a'.repeat(64);
  await store.ready(); await store.put(key,Buffer.from('private content'),'text/plain');
  assert.equal((await s3Storage().get(key)).toString(),'private content');
  await assert.rejects(store.get('../secret'),/Invalid storage key/);
  await assert.rejects(store.put('public/../../secret',Buffer.from('bad'),'text/plain'),/Invalid storage key/);
 } finally {delete process.env.STORAGE_DRIVER;delete process.env.STORAGE_LOCAL_ROOT;await rm(root,{recursive:true,force:true});}
});
