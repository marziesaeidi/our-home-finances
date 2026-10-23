import test from 'node:test';
import assert from 'node:assert/strict';
import { setValuation } from '../src/savings';
import { migrate, validate } from '../src/store';
import { converted, add } from '../src/decimal';

test('asset price history snapshots date-specific holdings, survives reload and preserves latest price',()=>{
 const data=migrate({transactions:[],accounts:[],loans:[],goals:[],recurring:[],budget:{total:0,categories:{}}},'2026-01-01T00:00:00Z');
 data.assets=[{id:'gold',name:'طلا',identifier:'GOLD',kind:'gold',unit:'گرم',purity:'18K',custody:'خانه',quantity:'2',openingQuantity:'2',cost:100,openingCost:100,acquisitionDate:'2026-01-01',owner:'a',visibility:'private'}];
 const quote=(price:string,day:string)=>({identifier:'GOLD',unit:'گرم',purity:'18K',price,currency:'IRT' as const,timestamp:`${day}T00:00:00Z`,source:'ورود دستی'});
 const first=setValuation(data,'gold',quote('80','2026-02-01'),'manual');
 assert.equal(add(converted(first.assets[0].quoteHistory![0].quantity!,'80'),-first.assets[0].quoteHistory![0].cost!),60);
 const next=setValuation(first,'gold',quote('40','2026-01-02'),'manual');
 assert.equal(next.assets[0].quote,'80');assert.equal(next.assets[0].quoteHistory!.length,2);
 assert.deepEqual(next.accounts,data.accounts);assert.deepEqual(next.transactions,data.transactions);
 const restored=JSON.parse(JSON.stringify(next));validate(restored);assert.deepEqual(restored,next);
 next.assets[0].quantity='3';assert.equal(next.assets[0].quoteHistory![0].quantity,'2');
 const bad=structuredClone(next);bad.assets[0].quoteHistory![0].cost=-1;assert.throws(()=>validate(bad));
});

import { correctAssetOpening } from '../src/savings';
test('asset metadata and opening can be corrected without a reason, with original history and cash preserved',()=>{
 const data=migrate({transactions:[],accounts:[],loans:[],goals:[],recurring:[],budget:{total:0,categories:{}}},'2026-01-01T00:00:00Z');
 data.assets=[{id:'asset',name:'old',identifier:'CUSTOM',kind:'other',unit:'واحد',custody:'home',quantity:'2',openingQuantity:'2',cost:100,openingCost:100,owner:'a',visibility:'private'}];
 const next=correctAssetOpening(data,'asset',{name:'new',kind:'gold',identifier:'GOLD',unit:'گرم',purity:'18K',custody:'bank',openingQuantity:'3',openingCost:150});
 assert.equal(next.assets[0].name,'new');assert.equal(next.assets[0].kind,'gold');assert.equal(next.assets[0].quantity,'3');
 assert.deepEqual(next.accounts,data.accounts);assert.deepEqual(next.transactions,data.transactions);
 assert.deepEqual(next.assetOpeningRevisions![0].previous,data.assets[0]);assert.equal(next.assetOpeningRevisions![0].reason,'');validate(JSON.parse(JSON.stringify(next)));
});
