import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const script = await readFile(new URL('../../../docs/catalog-brand-images.sql', import.meta.url), 'utf8');
const originals = [
  ['fd06cca4-3787-4444-9b4f-ff1646de8860', 'negin-1g', 'https://images.pexels.com/photos/33654800/pexels-photo-33654800.jpeg?auto=compress&cs=tinysrgb&h=900&w=900'],
  ['b2038836-1243-4ab3-a2e2-9083904f744f', 'negin-2g', 'https://images.pexels.com/photos/10487658/pexels-photo-10487658.jpeg?auto=compress&cs=tinysrgb&h=900&w=900'],
  ['a2cd33cc-cb9f-40da-b1c2-3209719e20ed', 'poshal-2g', 'https://images.pexels.com/photos/6707417/pexels-photo-6707417.jpeg?auto=compress&cs=tinysrgb&h=900&w=900'],
  ['76cd4135-b4b5-4540-aa4f-6636f4d26b87', 'sargol-1g', 'https://images.pexels.com/photos/33654800/pexels-photo-33654800.jpeg?auto=compress&cs=tinysrgb&h=900&w=900'],
];

test('catalog image plan updates only matched products, preserves prices and is repeatable', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE products (id uuid PRIMARY KEY, slug text NOT NULL, image_url text NOT NULL, price integer NOT NULL)');
    for (const [id, slug, image] of originals) await db.query('INSERT INTO products VALUES ($1,$2,$3,449000)', [id, slug, image]);
    await db.query("SELECT set_config('varsa.brand_asset_base_url', $1, false)", ['https://assets.example.test/store/']);
    await db.exec(script);
    const after = await db.query<{slug:string;image_url:string;price:number}>('SELECT slug,image_url,price FROM products ORDER BY slug');
    for (const row of after.rows) {
      assert.equal(row.price, 449000);
      assert.equal(row.image_url, row.slug === 'sargol-1g' ? originals[3][2] : `https://assets.example.test/store/products/${row.slug}.png`);
    }
    await db.exec(script);
    assert.deepEqual((await db.query('SELECT slug,image_url,price FROM products ORDER BY slug')).rows, after.rows);
    // An administrator's later custom photograph must survive another run.
    await db.query('UPDATE products SET image_url=$1 WHERE slug=$2', ['https://photos.example.test/approved.png','negin-1g']);
    await db.exec(script);
    assert.equal((await db.query<{image_url:string}>("SELECT image_url FROM products WHERE slug='negin-1g'")).rows[0].image_url, 'https://photos.example.test/approved.png');
  } finally { await db.close(); }
});

test('catalog image plan refuses an unset or malformed asset origin without modifying rows', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE products (id uuid PRIMARY KEY, slug text, image_url text, price integer)');
    await db.query('INSERT INTO products VALUES ($1,$2,$3,449000)', originals[0]);
    await assert.rejects(db.exec(script), /deployed HTTPS asset base/);
    for (const invalid of ['http://localhost:5173', 'https://example.test/path?query=1', 'https://user:secret@example.test', "https://example.test/';--"]) {
      await db.query("SELECT set_config('varsa.brand_asset_base_url', $1, false)", [invalid]);
      await assert.rejects(db.exec(script), /deployed HTTPS asset base/);
    }
    assert.equal((await db.query<{image_url:string}>('SELECT image_url FROM products')).rows[0].image_url, originals[0][2]);
  } finally { await db.close(); }
});

test('every proposed catalog image exists and has the declared square dimensions', async () => {
  for (const filename of ['negin-1g.png', 'negin-2g.png', 'poshal-2g.png']) {
    const image = await readFile(new URL(`../../varsa-shop/public/products/${filename}`, import.meta.url));
    assert.equal(image.subarray(1,4).toString(), 'PNG');
    assert.equal(image.readUInt32BE(16), 1254);
    assert.equal(image.readUInt32BE(20), 1254);
  }
});
