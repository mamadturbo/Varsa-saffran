import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const plan = JSON.parse(await readFile(new URL('../../../docs/catalog-copy-plan.json', import.meta.url), 'utf8'));
const sql = await readFile(new URL('../../../docs/catalog-copy.sql', import.meta.url), 'utf8');
async function seed(db: PGlite) {
  await db.exec('CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text, category text, weight numeric, weight_unit text, short_description text, long_description text, price integer DEFAULT 417000, image_url text DEFAULT \'original-image\', crocin integer DEFAULT 241)');
  for (const p of plan) await db.query('INSERT INTO products (id,slug,name,category,weight,weight_unit,short_description,long_description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [p.id,p.slug,p.name,p.category,p.weight,p.weight_unit,p.before.short_description,p.before.long_description]);
}

test('catalog copy updates all eight original rows, leaves commercial data untouched and is repeatable', async () => {
  const db = new PGlite();
  try {
    await seed(db);
    const before = (await db.query('SELECT * FROM products ORDER BY slug')).rows;
    await db.exec(sql);
    const after = (await db.query<Record<string, unknown>>('SELECT * FROM products ORDER BY slug')).rows;
    assert.equal(after.length, 8);
    for (const [index, row] of after.entries()) {
      const expected = plan.find((p: {slug:string})=>p.slug===row.slug);
      assert.deepEqual(row, {...before[index], ...expected.after});
    }
    await db.exec(sql);
    assert.deepEqual((await db.query('SELECT * FROM products ORDER BY slug')).rows, after);
  } finally { await db.close(); }
});

test('catalog copy preserves independently edited descriptions or changed product identity/specifications', async () => {
  const db = new PGlite();
  try {
    await seed(db);
    await db.query('UPDATE products SET short_description=$1 WHERE slug=$2', ['متن تأییدشده جدید مدیر',plan[0].slug]);
    await db.query('UPDATE products SET long_description=NULL WHERE slug=$1', [plan[1].slug]);
    await db.query('UPDATE products SET weight=9 WHERE slug=$1', [plan[2].slug]);
    await db.query('UPDATE products SET name=$1 WHERE slug=$2', ['محصول جدید',plan[3].slug]);
    await db.query('UPDATE products SET category=$1 WHERE slug=$2', ['دسته جدید',plan[4].slug]);
    await db.query('UPDATE products SET weight_unit=$1 WHERE slug=$2', ['مثقال',plan[5].slug]);
    await db.query('UPDATE products SET slug=$1 WHERE slug=$2', ['new-product',plan[6].slug]);
    await db.query('UPDATE products SET id=$1 WHERE slug=$2', ['00000000-0000-0000-0000-000000000001',plan[7].slug]);
    const before = (await db.query('SELECT * FROM products ORDER BY slug')).rows;
    await db.exec(sql);
    assert.deepEqual((await db.query('SELECT * FROM products ORDER BY slug')).rows, before);
  } finally { await db.close(); }
});
