import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNavasan } from '../server/rates.mjs';
const at='2026-10-08T12:00:00Z', timestamp=Date.parse('2026-10-08T08:00:00Z')/1000;
// Supplied fixtures only. These values are never advertised as current rates.
test('provider adapter explicitly normalizes IRR and IRT without losing fractional toman',()=>{
  const raw={usd_sell:{value:'600001',timestamp}};
  assert.equal(normalizeNavasan(raw,'USD','2026-10-08','IRR',at).rate,'60000.1');
  assert.equal(normalizeNavasan(raw,'USD','2026-10-08','IRT',at).rate,'600001');
});
test('provider cannot run with unverified units or reinterpret old/latest quotes as historical',()=>{
  const raw={usd_sell:{value:'600000',timestamp}};
  assert.throws(()=>normalizeNavasan(raw,'USD','2026-10-08',undefined,at),/Confirm/);
  assert.throws(()=>normalizeNavasan(raw,'USD','2026-10-07','IRR',at),/purchase day/);
});
test('provider rejects malformed, missing, future or unsupported quotes',()=>{
  assert.throws(()=>normalizeNavasan({usd_sell:{value:'1.25',timestamp}},'USD','2026-10-08','IRT',at),/Invalid/);
  assert.throws(()=>normalizeNavasan({usd_sell:{value:'0',timestamp}},'USD','2026-10-08','IRT',at),/Invalid/);
  assert.throws(()=>normalizeNavasan({usd_sell:{value:'1',timestamp:timestamp+100000}},'USD','2026-10-08','IRT',at),/purchase day/);
  assert.throws(()=>normalizeNavasan({},'USD','2026-10-08','IRT',at),/Invalid/);
  assert.throws(()=>normalizeNavasan({eur:{value:'1',timestamp}},'EUR','2026-10-08','IRT',at),/Invalid/);
});
