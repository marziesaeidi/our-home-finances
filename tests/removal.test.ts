import { pricePerUnit } from '../src/decimal';
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, validate } from '../src/store';
import { removeAsset, removeGoal, removeCheck, removeLoan } from '../src/removal';
import { setValuation } from '../src/savings';
const fixture=()=>{
 const d=migrate({transactions:[],accounts:[],loans:[],goals:[],recurring:[],budget:{total:0,categories:{}}},'2026-01-01T00:00:00Z');
 d.assets=[{id:'gold',name:'طلا',identifier:'GOLD',kind:'gold',unit:'گرم',purity:'18K',custody:'خانه',quantity:'2.5',openingQuantity:'2.5',cost:100,openingCost:100,acquisitionDate:'2026-01-01',owner:'a',visibility:'private'}];
 return d;
};
test('delete opening holding without changing cash or unrelated records, validate after reload',()=>{
 const d=fixture();const next=removeAsset(d,'gold','a');
 assert.equal(next.assets.length,0);assert.equal(d.assets.length,1);
 assert.deepEqual(next.accounts,d.accounts);assert.deepEqual(next.transactions,d.transactions);
 validate(JSON.parse(JSON.stringify(next)));
 assert.throws(()=>removeAsset(d,'gold','b'));
});
test('asset creation with initial quantity, purchase date and manual valuation survives reload',()=>{
 const d=fixture();const next=setValuation(d,'gold',{identifier:'GOLD',unit:'گرم',purity:'18K',price:'80',currency:'IRT',timestamp:'2026-01-02T00:00:00Z',source:'ورود دستی هنگام ثبت دارایی'},'manual');
 validate(JSON.parse(JSON.stringify(next)));
 assert.equal(next.assets[0].quantity,'2.5');assert.equal(next.assets[0].quote,'80');
 assert.equal(next.assets[0].quoteHistory![0].cost,100);
 assert.deepEqual(next.accounts,d.accounts);assert.deepEqual(next.transactions,d.transactions);
});
test('deletion preserves financial links including reversed transactions and opening revisions',()=>{
 const d=fixture();d.transactions=[{id:'t',title:'خرید',amount:10,type:'asset-buy',category:'دارایی',accountId:'account',assetId:'gold',createdBy:'a',visibility:'private',date:'2026-01-01',status:'reversed'}];
 assert.throws(()=>removeAsset(d,'gold','a'));
 d.transactions=[];d.assetOpeningRevisions=[{assetId:'gold',at:'2026-01-02T00:00:00Z',previous:structuredClone(d.assets[0]),reason:'اصلاح'}];
 assert.throws(()=>removeAsset(d,'gold','a'));
});
test('goals require zero balance and no asset, recurring or transaction links',()=>{
 const d=fixture();d.goals=[{id:'g',name:'هدف',target:100,saved:0,targetDate:'',owner:'a',visibility:'private'}];
 assert.equal(removeGoal(d,'g','a').goals.length,0);
 d.assets[0].goalId='g';assert.throws(()=>removeGoal(d,'g','a'));
 d.assets[0].goalId=undefined;d.goals[0].saved=5;assert.throws(()=>removeGoal(d,'g','a'));
 d.goals[0].saved=0;d.recurring=[{id:'r',name:'پس انداز',amount:1,frequency:'monthly',nextDate:'2026-01-01',category:'پس انداز',owner:'a',reminder:false,goalId:'g'}];assert.throws(()=>removeGoal(d,'g','a'));
});
test('delete unpaid check and loan atomically while protecting payments and visibility',()=>{
 const d=fixture();d.obligations=[{id:'c',name:'چک',kind:'check',direction:'pay',amount:10,date:'2026-01-01',accountId:'account',category:'سایر',status:'pending',reference:'',owner:'a',visibility:'private'}];
 assert.equal(removeCheck(d,'c','a').obligations.length,0);assert.throws(()=>removeCheck(d,'c','b'));
 d.obligations[0].status='cleared';assert.throws(()=>removeCheck(d,'c','a'));
 d.loans=[{id:'l',name:'وام',total:10,installment:10,count:1,paid:0,nextDate:'2026-01-01',frequency:'monthly',owner:'a',visibility:'private'}];
 d.installments=[{id:'i',loanId:'l',index:0,amount:10,date:'2026-01-01',settled:false}];
 const next=removeLoan(d,'l','a');assert.equal(next.loans.length,0);assert.equal(next.installments.length,0);assert.deepEqual(next.accounts,d.accounts);
 d.installments[0].paidAmount=1;assert.throws(()=>removeLoan(d,'l','a'));
});

test('automatic opening purchase price handles fractional quantities, Persian inputs and recurring decimals',()=>{
 assert.equal(pricePerUnit('۶٬۰۰۰٬۰۰۰','۲٫۵'),'2400000');
 assert.equal(pricePerUnit('10','3'),'3.333333333333333333');
 assert.equal(pricePerUnit('1','0.00000001'),'100000000');
 assert.equal(pricePerUnit('0','2'),'0');
 assert.throws(()=>pricePerUnit('100','0'));
 assert.throws(()=>pricePerUnit('abc','2'));
 const d=fixture();d.assets[0].originalCost='100';d.assets[0].originalCurrency='IRT';
 d.assets[0].acquisitionPrice=pricePerUnit('100',d.assets[0].quantity);
 const restored=JSON.parse(JSON.stringify(d));validate(restored);
 assert.equal(restored.assets[0].acquisitionPrice,'40');assert.equal(restored.assets[0].openingCost,100);
});
