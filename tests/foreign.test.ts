import { FinanceModules } from '../src/modules';
import { money } from '../src/utils';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ForeignExpenses } from '../src/ForeignExpenses';
import { minorUnits, nativeText } from '../src/currencies';
import { recordForeign, foreignSummary, suggestedForeignDebit } from '../src/foreignLedger';
import type { ForeignInput } from '../src/foreignLedger';
import { ProxyRateProvider, RateService } from '../src/exchangeRates';
import type { RateQuote } from '../src/exchangeRates';
import { consumption, post, reverse } from '../src/finance';
import { loadStore, migrate, saveStore, validate, STORE_KEY } from '../src/store';
const at='2026-10-08T12:00:00.000Z';
function fixture(){return migrate({transactions:[],accounts:[{id:'a',name:'تومان',type:'بانک',balance:10000000,visibility:'shared'}],loans:[],goals:[],recurring:[],budget:{total:10000000,categories:{}}},at);}
const quote:RateQuote={currency:'USD',target:'IRT',rate:'60000',source:'supplied test fixture (not current)',effectiveAt:'2026-10-08T08:00:00Z',retrievedAt:'2026-10-08T09:00:00Z',rateType:'manual',frequency:'manual receipt'};
const input=(over:Partial<ForeignInput>={}):ForeignInput=>({id:'foreign',title:'ChatGPT',merchant:'OpenAI',currency:'USD',original:'20',date:'2026-10-08',quote:{...quote},accountId:'a',debit:'1250000',fee:'10000',paymentRate:'1',category:'سایر',subscription:false,...over});
class Memory { values=new Map<string,string>();getItem(k:string){return this.values.get(k)??null;}setItem(k:string,v:string){this.values.set(k,v);} }
test('foreign receipt retains USD, debits actual IRT and includes explicit fee once',()=>{
  const d=recordForeign(fixture(),input(), 'مرزیه');validate(d);const t=d.transactions[0];
  assert.equal(t.amount,1200000);assert.equal(t.fx?.originalAmount,'20');assert.equal(t.fx?.currency,'USD');assert.equal(d.accounts[0].balance,8740000);
  assert.equal(consumption(t),1210000);
  assert.ok(renderToStaticMarkup(createElement(FinanceModules,{page:'reports',data:d,viewer:'مرزیه',change:()=>{}})).includes(money(1260000))); assert.equal(foreignSummary(d,'مرزیه','all').total,1210000);assert.equal(foreignSummary(d,'مرزیه').usd,'20');
  assert.deepEqual(recordForeign(d,input(),'مرزیه'),d);
  const restored=reverse(d,t.id);validate(restored);assert.equal(restored.accounts[0].balance,10000000);assert.equal(foreignSummary(restored,'مرزیه').total,0);
});
test('native USD account uses cents; IRR account uses rials and neither enters IRT sums',()=>{
  let d=fixture();d.accounts.push({id:'usd',name:'USD',type:'cash',balance:10000,openingBalance:10000,currency:'USD',visibility:'private',owner:'مرزیه'});
  d=recordForeign(d,input({accountId:'usd',debit:'20',fee:'0.25',paymentRate:'60000'}),'مرزیه');validate(d);
  assert.equal(d.accounts[1].balance,7975);assert.equal(d.accounts[0].balance,10000000);assert.equal(consumption(d.transactions[0]),1215000);
  assert.throws(()=>post(d,{id:'bad',title:'bad',amount:20,type:'expense',category:'سایر',accountId:'usd',createdBy:'مرزیه',visibility:'private',date:'2026-10-08'}),/ماژول/);
  d=reverse(d,'foreign');assert.equal(d.accounts[1].balance,10000);
  d.accounts.push({id:'irr',name:'Rial',type:'cash',balance:20000000,openingBalance:20000000,currency:'IRR',visibility:'shared'});
  d=recordForeign(d,input({id:'rial-payment',accountId:'irr',debit:'12000000',fee:'100',paymentRate:'0.1'}),'مرزیه');validate(d);assert.equal(d.accounts[2].balance,7999900);
});
test('rial purchases use denomination rate and remain domestic in filters',()=>{
  const i=input({currency:'IRR',original:'12345',debit:'1235',fee:'0',quote:{...quote,currency:'IRR',rate:'0.1',rateType:'denomination'}});
  const d=recordForeign(fixture(),i,'مرزیه');validate(d);assert.equal(d.transactions[0].amount,1235);
  assert.equal(foreignSummary(d,'مرزیه').rows.length,0);assert.equal(foreignSummary(d,'مرزیه','domestic').total,1235);
  assert.throws(()=>recordForeign(fixture(),{...i,quote:{...i.quote,rate:'1'}},'مرزیه'),/۱۰ ریال/);
});
test('precision, Persian digits, sub-cent rejection, overflow and extensible currency scales',()=>{
  assert.equal(minorUnits('۲۰٫۰۱','USD'),2001);assert.equal(nativeText(2001,'USD'),'20.01');
  assert.throws(()=>minorUnits('1.001','USD'),/دقت/);assert.throws(()=>minorUnits('9007199254740992','IRR'),/محدوده/);
  assert.equal(minorUnits('1.234','KWD',[{code:'KWD',label:'دینار',decimals:3}]),1234);
  assert.throws(()=>minorUnits('1','BAD'),/تعریف/);
  const d=recordForeign(fixture(),input({original:'0.01',debit:'600',fee:'0'}),'مرزیه');assert.equal(d.transactions[0].amount,600);
});
test('historical correction preserves old FX, reverses native debit and persists replacement once',()=>{
  let d=recordForeign(fixture(),input({folderId:undefined}),'مرزیه');
  const old=JSON.stringify(d.transactions[0].foreignExpense?.quote);
  d=recordForeign(d,input({id:'corrected',correctsId:'foreign',reason:'correct receipt',quote:{...quote,rate:'61000'},debit:'1220000',fee:'0'}),'مرزیه');validate(d);
  assert.equal(d.transactions[1].status,'reversed');assert.equal(JSON.stringify(d.transactions[1].foreignExpense?.quote),old);
  assert.equal(d.accounts[0].balance,8780000);assert.equal(foreignSummary(d,'مرزیه').total,1220000);assert.equal(foreignSummary(d,'مرزیه').usd,'20');
  const storage=new Memory();saveStore(storage,d);const loaded=loadStore(storage,fixture(),at);assert.deepEqual(loaded,JSON.parse(JSON.stringify(d)));
  assert.throws(()=>recordForeign(loaded,input({id:'again',correctsId:'foreign',reason:'already corrected'}),'مرزیه'),/تراکنش فعال/);
});
test('override requires reason; corrupted snapshots, dates, fees, unknown versions are rejected',()=>{
  assert.throws(()=>recordForeign(fixture(),input({override:'1230000'}),'مرزیه'),/دلیل/);
  const d=recordForeign(fixture(),input({override:'1230000',reason:'receipt rounding'}),'مرزیه');validate(d);
  const broken=structuredClone(d);broken.transactions[0].foreignExpense!.feeToman++;assert.throws(()=>validate(broken),/کارمزد/);
  assert.throws(()=>recordForeign(fixture(),input({quote:{...quote,effectiveAt:'2026-10-07T08:00:00Z'}}),'مرزیه'),/تاریخ/);
  const future=structuredClone(d);(future.transactions[0].foreignExpense as {version:number}).version=2;assert.throws(()=>validate(future),/معتبر/);
});
test('foreign subscription and personal folder do not post duplicate expense; Jalali month and visibility',()=>{
  const base=fixture();base.folders.push({id:'f',name:'کار',note:'',visibility:'private',owner:'مرزیه'});
  const d=recordForeign(base,input({subscription:true,folderId:'f'}),'مرزیه');validate(d);
  const corrected=recordForeign(d,input({id:'sub-correction',correctsId:'foreign',subscription:true,reason:'correct service',title:'Updated ChatGPT'}),'مرزیه');
  assert.equal(corrected.recurring.length,1);assert.equal(corrected.recurring[0].name,'Updated ChatGPT');validate(corrected);
  assert.equal(d.transactions.length,1);assert.equal(d.transactions[0].folderId,'f');assert.equal(d.recurring.length,1);assert.equal(d.recurring[0].foreignCurrency,'USD');
  assert.equal(foreignSummary(d,'مرزیه','foreign','1405-07').total,1210000);
  const privateData=structuredClone(d);privateData.transactions[0].visibility='private';assert.equal(foreignSummary(privateData,'علی').total,0);
});
test('additive currency fields preserve legacy v2 store byte for byte; invalid store retained',()=>{
  const storage=new Memory(),d=fixture(),raw=JSON.stringify(d);storage.setItem(STORE_KEY,raw);
  assert.deepEqual(loadStore(storage,fixture(),at),d);assert.equal(storage.getItem(STORE_KEY),raw);
  d.currencyDefinitions=[{code:'IRT',label:'wrong',decimals:2}];storage.setItem(STORE_KEY,JSON.stringify(d));const original=storage.getItem(STORE_KEY);
  assert.throws(()=>loadStore(storage,fixture(),at));assert.equal(storage.getItem(STORE_KEY),original);
});
test('cache is date specific, preserves historical snapshots, handles offline and corrupt cache',async()=>{
  const storage=new Memory();let calls=0,fail=false;
  const provider={name:'fixture',quote:async()=>{calls++;if(fail)throw new Error('offline');return {...quote,retrievedAt:at,effectiveAt:'2026-10-08T11:30:00Z'};}};
  const service=new RateService(provider,storage,7200000,()=>Date.parse(at));
  const first=await service.get('USD','2026-10-08');assert.equal(first.cached,false);
  assert.equal((await service.get('USD','2026-10-08')).cached,true);assert.equal(calls,1);
  fail=true;const fallback=await service.get('USD','2026-10-08',true);assert.equal(fallback.offline,true);assert.equal(fallback.stale,true);
  await assert.rejects(service.get('USD','2026-10-07'),/offline/);
  storage.values.set('khaneh-fx:fixture:USD:2026-10-08','broken');await assert.rejects(service.get('USD','2026-10-08'),/offline/);
  await assert.rejects(new RateService({name:'bad',quote:async()=>({...quote,target:'IRR'} as unknown as RateQuote)},new Memory(),7200000,()=>Date.parse(at)).get('USD','2026-10-08'),/واحد/);
});
test('proxy rejects HTTP errors and unknown quote dates instead of inventing rates',async()=>{
  const provider=new ProxyRateProvider('/api/exchange-rates',async()=>new Response('',{status:503}));await assert.rejects(provider.quote('USD','2026-10-08'),/دسترس/);
});
test('RTL foreign dashboard renders empty and populated states with original and debit currencies',()=>{
  const props={data:fixture(),viewer:'مرزیه' as const,change:()=>{}};
  assert.match(renderToStaticMarkup(createElement(ForeignExpenses,props)),/هنوز هزینه‌ای/);
  props.data=recordForeign(props.data,input(),'مرزیه');const html=renderToStaticMarkup(createElement(ForeignExpenses,props));assert.match(html,/20 USD/);assert.match(html,/OpenAI/);assert.match(html,/برداشت/);
});

test('foreign debit autofill respects account units, exact rounding and receipt override',()=>{
  const suggest=(original:string,rate:string,target='IRT',paymentRate='',override='')=>suggestedForeignDebit(original,rate,'USD',target,paymentRate,[],override);
  assert.equal(suggest('۵','۶۰٬۰۰۰'),'300000');
  assert.equal(suggest('5','60000','IRR'),'3000000');
  assert.equal(suggest('5','60000','USD'),'5.00');
  assert.equal(suggest('5','60000','EUR','75000'),'4.00');
  assert.equal(suggest('0.01','100','EUR','3'),'0.33');
  assert.equal(suggest('5','60000','IRT','','310000'),'310000');
  assert.throws(()=>suggest('5',''));
  assert.throws(()=>suggest('5','0'));
  assert.throws(()=>suggest('5','60000','EUR',''));
  assert.throws(()=>suggest('999999999999999999999','60000'));
  const d=recordForeign(fixture(),input({original:'5',debit:suggest('5','60000'),fee:'1000'}),'مرزیه');
  validate(d);assert.equal(d.accounts[0].balance,9699000);assert.equal(consumption(d.transactions[0]),301000);
});
