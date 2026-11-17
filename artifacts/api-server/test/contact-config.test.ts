import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContactConfig, contactEmail, contactPhone, contactProfile } from '../../varsa-shop/src/lib/contact-config.ts';

test('missing business details stay absent without a placeholder contact or social destination', () => {
  assert.deepEqual(buildContactConfig(),{phone:null,email:null,address:null,instagram:null,telegram:null});
  assert.deepEqual(buildContactConfig({phone:' ',email:' ',address:' ',instagram:' ',telegram:' '}),buildContactConfig());
});

test('Iranian landline and mobile digits normalize to the same callable number without extensions', () => {
  for(const value of ['۰۲۱-۱۲۳۴۵۶۷۸','٠٢١ ١٢٣٤٥٦٧٨','+98 (21) 12345678','0098 21 12345678'])
    assert.deepEqual(contactPhone(value),{label:'+982112345678',href:'tel:+982112345678'});
  assert.deepEqual(contactPhone('۰۹۱۲۳۴۵۶۷۸۹'),{label:'+989123456789',href:'tel:+989123456789'});
  assert.deepEqual(contactPhone('+44 20 7946 0123'),{label:'+442079460123',href:'tel:+442079460123'});
});

test('partial phone numbers, dial actions and non-number syntax never become contact links', () => {
  for(const value of ['','021','9123456789','+98123456','+0012345678','++989123456789','02112345678 داخلی 1','tel:+989123456789','*123#','+1234567890123456','javascript:alert(1)']) assert.equal(contactPhone(value),null,value);
});

test('email links encode one mailbox and cannot introduce mail headers', () => {
  assert.deepEqual(contactEmail(' support+shop@example.test '),{label:'support+shop@example.test',href:'mailto:support%2Bshop%40example.test'});
  for(const value of ['support@example.test?subject=x','a@example.test\r\nBcc:other@example.test','a@example.test,b@example.test','mailto:a@example.test','a@localhost','a@@example.test','a..b@example.test','.a@example.test','a.@example.test','a@-example.test','a'.repeat(65)+'@example.test']) assert.equal(contactEmail(value),null,value);
});

test('social URLs resolve direct public profiles and remove tracking fragments and queries', () => {
  assert.equal(contactProfile('https://instagram.com/varsa_test/?igsh=test#top','instagram'),'https://www.instagram.com/varsa_test/');
  assert.equal(contactProfile('https://www.instagram.com/varsa.test','instagram'),'https://www.instagram.com/varsa.test/');
  assert.equal(contactProfile('https://telegram.me/varsa_test/?start=tracking','telegram'),'https://t.me/varsa_test');
  assert.equal(contactProfile('https://t.me/varsa_test','telegram'),'https://t.me/varsa_test');
});

test('platform homepages, posts, actions, invitation paths and lookalike domains are not brand profile links', () => {
  for(const url of ['https://instagram.com','https://www.instagram.com/','https://instagram.com/p/abc','https://instagram.com/accounts','https://instagram.com/reels','https://instagram.com.evil.test/varsa','https://instagram.com@evil.test/varsa','https://user:pass@instagram.com/varsa','http://instagram.com/varsa','javascript:alert(1)','//instagram.com/varsa','https://instagram.com:444/varsa','https://instagram.com/varsa%2Fother']) assert.equal(contactProfile(url,'instagram'),null,url);
  for(const url of ['https://telegram.org','https://t.me/','https://t.me/share?url=x','https://t.me/+private','https://t.me/joinchat/token','https://t.me/s/varsa_test','https://t.me/varsa_test/123','https://t.me/varsa.test','https://t.me.evil.test/varsa','https://t.me/proxy']) assert.equal(contactProfile(url,'telegram'),null,url);
});

test('partial configuration only exposes present valid channels and preserves a literal address', () => {
  const result=buildContactConfig({email:'support@example.test',address:'  نشانی آزمایشی <متن>  ',instagram:'https://instagram.com',telegram:'https://t.me/varsa_test'});
  assert.equal(result.phone,null);assert.equal(result.email?.label,'support@example.test');assert.equal(result.address,'نشانی آزمایشی <متن>');
  assert.equal(result.instagram,null);assert.equal(result.telegram,'https://t.me/varsa_test');
});
