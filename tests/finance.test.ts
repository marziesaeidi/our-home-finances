import './asset-history.test';
import './household.test';
import { deleteCategory } from '../src/personalization';
import './reporting.test';
import './personal.test';
import './foreign.test';
import './obligations.test';
import { deleteFolder, folderReport, linkFolder, saveFolder } from '../src/folders';
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { add, apportion, converted, integer, quantityAdd, split, sum } from '../src/decimal';
import { canonicalDay, fromJalali, isoDay, jalaliParts, nextDate, periodKey, previousPeriod } from '../src/calendar';
import { active, consumption, loanPayment, payRecurring, post, registerLoan, remainingLoan, reverse, revise, scheduleLoan, settleObligation } from '../src/finance';
import { loadStore, migrate, saveStore, STORE_KEY, validate } from '../src/store';
import type { Data, FinanceData, Transaction, Loan } from '../src/types';

const at = '2026-10-08T12:00:00.000Z';
mock.timers.enable({ apis: ['Date'], now: Date.parse(at) });
function legacy(): Data {
  return { transactions: [], accounts: [{ id:'a', name:'بانک', type:'بانکی', balance:1000, visibility:'shared' }, { id:'b', name:'کیف پول', type:'نقدی', balance:200, visibility:'shared' }], loans:[], goals:[{ id:'g', name:'هدف', target:1000, saved:0, targetDate:'اسفند ۱۴۰۵', visibility:'shared' }], recurring:[], budget:{ total:1000, categories:{ خوراک:500 } } };
}
const fixture = () => migrate(legacy(), at);
const tx = (extra: Partial<Transaction> = {}): Transaction => ({ id:'event', title:'رویداد', amount:100, type:'expense', category:'خوراک', accountId:'a', date:'2026-10-08', createdBy:'مرزیه', visibility:'shared', ...extra });
const balance = (d: FinanceData, id: string) => d.accounts.find(a=>a.id===id)!.balance;
class MemoryStorage {
  values = new Map<string,string>();
  failKey = '';
  getItem(key:string) { return this.values.get(key)??null; }
  setItem(key:string,value:string) { if(key===this.failKey)throw new Error('quota');this.values.set(key,value); }
}
test('same-currency transfer conserves money and creates no expense',()=>{
  const d=post(fixture(),tx({type:'transfer',toAccountId:'b',amount:300}));
  assert.equal(balance(d,'a'),700);assert.equal(balance(d,'b'),500);assert.equal(sum(d.accounts.map(a=>a.balance)),1200);assert.equal(consumption(d.transactions[0]),0);validate(d);
});
test('posting retry is idempotent after storage reload',()=>{
  const d=post(fixture(),tx());const loaded=JSON.parse(JSON.stringify(d));assert.deepEqual(post(loaded,tx()),loaded);
});
test('invalid and same-account transfers are rejected',()=>{
  assert.throws(()=>post(fixture(),tx({type:'transfer',toAccountId:'a'})));assert.throws(()=>post(fixture(),tx({type:'transfer',toAccountId:'missing'})));
});
test('revision and reversal preserve history and reconcile',()=>{
  let d=post(fixture(),tx());d=revise(d,'event','اصلاح',150);assert.equal(balance(d,'a'),850);assert.equal(d.transactions[0].revisions?.[0].amount,100);
  d=reverse(d,'event');assert.equal(balance(d,'a'),1000);assert.equal(d.transactions.length,1);assert.equal(active(d.transactions[0]),false);assert.deepEqual(reverse(d,'event'),d);validate(d);
});
test('goal allocation does not remove cash or inflate net worth',()=>{
  const d=post(fixture(),tx({type:'saving',amount:200,goalId:'g',allocationOnly:true}));assert.equal(balance(d,'a'),1000);assert.equal(d.goals[0].saved,200);assert.equal(consumption(d.transactions[0]),0);validate(d);
});
test('goal withdrawal links to same funding account and cannot overdraw',()=>{
  let d=post(fixture(),tx({type:'saving',amount:200,goalId:'g',allocationOnly:true}));
  assert.throws(()=>post(d,tx({id:'withdraw',type:'saving',amount:250,goalId:'g',allocationOnly:true,goalWithdrawal:true})));
  assert.throws(()=>post(d,tx({id:'withdraw',type:'saving',amount:100,goalId:'g',accountId:'b',allocationOnly:true,goalWithdrawal:true})));
  d=post(d,tx({id:'withdraw',type:'saving',amount:100,goalId:'g',allocationOnly:true,goalWithdrawal:true}));assert.equal(d.goals[0].saved,100);assert.equal(balance(d,'a'),1000);
});
test('multiple goals cannot allocate the same available cash twice',()=>{
  let d=fixture();d.goals.push({...d.goals[0],id:'g2'});d=post(d,tx({type:'saving',amount:800,goalId:'g',allocationOnly:true}));assert.throws(()=>post(d,tx({id:'second',type:'saving',amount:300,goalId:'g2',allocationOnly:true})));
});
test('folder link does not create a second financial event',()=>{
  const d=fixture();d.folders.push({id:'project',name:'پروژه',note:'',owner:'مرزیه',visibility:'private'});const result=post(d,tx({folderId:'project'}));assert.equal(result.transactions.length,1);assert.equal(sum(result.transactions.map(consumption)),100);assert.equal(balance(result,'a'),900);
});
test('safe integer range and Persian digits',()=>{
  assert.equal(integer('۱۲۳۴'),1234);assert.equal(integer('١٢٣٤'),1234);assert.equal(integer('۱٬۲۳۴'),1234);assert.throws(()=>integer('1,2,34'));assert.throws(()=>integer('1e3'));assert.throws(()=>integer('NaN'));assert.throws(()=>integer('1.1'));assert.throws(()=>integer('۹۰۰۷۱۹۹۲۵۴۷۴۰۹۹۲'));assert.throws(()=>add(Number.MAX_SAFE_INTEGER,1));
});
test('integer installment residual is conserved',()=>{assert.deepEqual(split(100,3),[33,33,34]);assert.equal(sum(split(100,3)),100);assert.throws(()=>split(100,2.5));});
test('historical conversion and rial denomination are exact',()=>{
  assert.equal(converted('۲','۶۰۰۰۰'),120000);assert.equal(converted('1200000','0.1'),120000);assert.equal(converted('0.1','0.2'),0);assert.equal(converted('1','0.5'),1);
});
test('fractional holding arithmetic is exact at 18 decimal places',()=>{
  assert.equal(quantityAdd('0.1','0.2'),'0.3');assert.equal(quantityAdd('1','0.000000000000000001',true),'0.999999999999999999');assert.equal(quantityAdd('10','0.0'),'10');assert.throws(()=>quantityAdd('0.1','0.2',true));
});
function assetFixture() {const d=fixture();d.assets.push({id:'gold',name:'طلا',kind:'gold',unit:'گرم',purity:'750',custody:'خانه',quantity:'0',openingQuantity:'0',cost:0,openingCost:0,owner:'مرزیه',visibility:'private'});return d;}
test('asset acquisition is investment; fees alone are consumption',()=>{
  const d=post(assetFixture(),tx({type:'asset-buy',assetId:'gold',quantity:'0.3',amount:300,fee:10}));assert.equal(balance(d,'a'),690);assert.equal(d.assets[0].quantity,'0.3');assert.equal(d.assets[0].cost,300);assert.equal(consumption(d.transactions[0]),10);validate(d);
});
test('partial asset sale uses weighted cost and reversal restores it',()=>{
  let d=post(assetFixture(),tx({type:'asset-buy',assetId:'gold',quantity:'0.3',amount:300}));d=post(d,tx({id:'sale',type:'asset-sell',assetId:'gold',quantity:'0.1',amount:150}));assert.equal(d.assets[0].quantity,'0.2');assert.equal(d.assets[0].cost,200);assert.equal(d.transactions[0].costBasis,100);assert.equal(balance(d,'a'),850);assert.throws(()=>reverse(d,'event'));d=reverse(d,'sale');assert.equal(d.assets[0].quantity,'0.3');assert.equal(d.assets[0].cost,300);d=reverse(d,'event');assert.equal(balance(d,'a'),1000);validate(d);
});
test('loan principal and interest affect distinct projections',()=>{
  let d=fixture();const loan:Loan={id:'loan',name:'وام',total:1100,installment:110,count:10,paid:0,nextDate:'2026-10-08',frequency:'ماهانه',principalTotal:1000,principalRemaining:1000};d.loans.push(loan);d.installments=scheduleLoan(loan);d=loanPayment(d,'loan','a','2026-10-08','مرزیه',0);assert.equal(balance(d,'a'),890);assert.equal(d.loans[0].principalRemaining,900);assert.equal(consumption(d.transactions[0]),10);assert.equal(remainingLoan(d,d.loans[0]),990);assert.throws(()=>loanPayment(d,'loan','a','2026-10-08','مرزیه',0));d=reverse(d,d.transactions[0].id);assert.equal(balance(d,'a'),1000);assert.equal(d.loans[0].paid,0);assert.equal(d.loans[0].principalRemaining,1000);assert.equal(d.installments[0].settled,false);d=loanPayment(d,'loan','a','2026-10-08','مرزیه',0);assert.equal(balance(d,'a'),890);validate(d);
});
test('loan receipt is not income or consumption',()=>{
  const d=fixture();d.loans.push({id:'loan',name:'وام',total:1000,installment:100,count:10,paid:0,nextDate:'2026-10-08',frequency:'ماهانه',principalRemaining:0});const next=post(d,tx({type:'loan-receipt',amount:1000,loanId:'loan'}));assert.equal(balance(next,'a'),2000);assert.equal(next.loans[0].principalRemaining,1000);assert.equal(consumption(next.transactions[0]),0);
});
function checkFixture(){const d=fixture();d.obligations.push({id:'check',name:'چک',kind:'check',direction:'pay',amount:100,date:'2026-10-10',accountId:'a',category:'خانه',status:'pending',reference:'123',owner:'مرزیه',visibility:'shared'});return d;}
test('future check does not change balance; settlement posts exactly once',()=>{
  let d=checkFixture();assert.equal(balance(d,'a'),1000);d=settleObligation(d,'check','2026-10-08','مرزیه');assert.equal(balance(d,'a'),900);assert.deepEqual(settleObligation(d,'check','2026-10-08','مرزیه'),d);d=reverse(d,d.obligations[0].transactionId!);assert.equal(balance(d,'a'),1000);assert.equal(d.obligations[0].status,'pending');d=settleObligation(d,'check','2026-10-08','مرزیه');assert.equal(balance(d,'a'),900);validate(d);
});
test('canceled obligation has no cash effect and cannot settle',()=>{const d=checkFixture();d.obligations[0].status='canceled';assert.throws(()=>settleObligation(d,'check','2026-10-08','مرزیه'));assert.equal(balance(d,'a'),1000);});
test('recurring payment retries, reload and reversal are consistent',()=>{
  let d=fixture();d.recurring.push({id:'rent',name:'اجاره',amount:100,frequency:'ماهانه',nextDate:'2026-10-08',category:'خانه',owner:'مرزیه',reminder:true,accountId:'a',transactionType:'expense',anchorDay:16});d=payRecurring(d,'rent','2026-10-08','2026-10-08','مرزیه');assert.equal(balance(d,'a'),900);const loaded=JSON.parse(JSON.stringify(d));assert.deepEqual(payRecurring(loaded,'rent','2026-10-08','2026-10-08','مرزیه'),loaded);d=reverse(d,d.transactions[0].id);assert.equal(d.recurring[0].nextDate,'2026-10-08');d=payRecurring(d,'rent','2026-10-08','2026-10-08','مرزیه');assert.equal(balance(d,'a'),900);validate(d);
});
test('future recurring payment cannot post early',()=>{const d=fixture();d.recurring.push({id:'r',name:'آینده',amount:100,frequency:'ماهانه',nextDate:'2026-11-08',category:'خانه',owner:'مرزیه',reminder:true,accountId:'a',transactionType:'expense'});assert.throws(()=>payRecurring(d,'r','2026-11-08','2026-10-08','مرزیه'));});
test('Tehran financial day is not UTC day',()=>{assert.equal(canonicalDay(new Date('2026-10-07T21:00:00Z')),'2026-10-08');});
test('Jalali conversion and previous-month arithmetic',()=>{
  assert.equal(fromJalali('۱۴۰۵/۰۷/۱۶'),'2026-10-08');assert.equal(periodKey('2026-10-08'),'1405-07');assert.equal(previousPeriod('2026-10-08'),'1405-06');assert.equal(previousPeriod(fromJalali('1405/1/1')),'1404-12');assert.equal(isoDay('2026-02-30'),false);
});
test('Jalali leap Esfand and end-of-month recurrence',()=>{
  assert.equal(jalaliParts(fromJalali('1403/12/30')).day,30);assert.throws(()=>fromJalali('1404/12/30'));const d=nextDate(fromJalali('1405/6/31'),'ماهانه',31);assert.deepEqual(jalaliParts(d),{year:1405,month:7,day:30});assert.deepEqual(jalaliParts(nextDate(d,'ماهانه',31)),{year:1405,month:8,day:30});
});
test('legacy migration preserves IDs, dates, links and snapshot balances',()=>{
  const old=legacy();old.transactions.push(tx({amount:100,goalId:'missing-goal'}));old.accounts[0].balance=777;const raw=JSON.stringify(old);const d=migrate(old,at);assert.equal(balance(d,'a'),777);assert.equal(d.transactions[0].id,'event');assert.equal(d.transactions[0].goalId,'missing-goal');assert.equal(d.transactions[0].amount,100);assert.equal(JSON.stringify(old),raw);assert.deepEqual(migrate(d,at),d);
});
test('migration never replays sample history on snapshot balance',()=>{
  const old=legacy();old.transactions.push(tx());const d=migrate(old,at);assert.equal(balance(d,'a'),1000);const reverted=reverse(d,'event');assert.equal(balance(reverted,'a'),1100);validate(reverted);
});
test('storage preserves original before publishing migration',()=>{
  const storage=new MemoryStorage(),raw=JSON.stringify(legacy());storage.setItem('khaneh-v1',raw);const d=loadStore(storage,legacy(),at);assert.equal(storage.getItem('khaneh-v1'),raw);assert.equal(storage.getItem('khaneh-v1-original'),raw);assert.deepEqual(loadStore(storage,legacy(),at),d);
});
test('malformed storage is never reset to seeds',()=>{
  const storage=new MemoryStorage();storage.setItem('khaneh-v1','{broken');assert.throws(()=>loadStore(storage,legacy(),at));assert.equal(storage.getItem('khaneh-v1'),'{broken');assert.equal(storage.getItem(STORE_KEY),null);
});
test('interrupted migration preserves original',()=>{
  const storage=new MemoryStorage(),raw=JSON.stringify(legacy());storage.setItem('khaneh-v1',raw);storage.failKey=STORE_KEY;assert.throws(()=>loadStore(storage,legacy(),at));assert.equal(storage.getItem('khaneh-v1'),raw);assert.equal(storage.getItem('khaneh-v1-original'),raw);assert.equal(storage.getItem(STORE_KEY),null);
});
test('quota failure retains durable previous state',()=>{
  const storage=new MemoryStorage(),d=loadStore(storage,legacy(),at),raw=storage.getItem(STORE_KEY);storage.failKey=STORE_KEY;assert.throws(()=>saveStore(storage,post(d,tx())));assert.equal(storage.getItem(STORE_KEY),raw);
});
test('newer schema and inconsistent balances are rejected',()=>{
  const d=fixture();assert.throws(()=>validate({...d,schemaVersion:3}));d.accounts[0].balance=123;assert.throws(()=>validate(d));
});
test('historical FX snapshot survives quote refresh and backup roundtrip',()=>{
  const d=post(fixture(),tx({amount:120,fx:{currency:'USD',originalAmount:'2',rate:'60',source:'test-fixture',date:'2026-10-08',direction:'IRT-per-unit',rounding:'half-up'}}));const loaded=JSON.parse(JSON.stringify(d));validate(loaded);assert.equal(loaded.transactions[0].fx.rate,'60');assert.equal(loaded.transactions[0].fx.originalAmount,'2');assert.throws(()=>revise(loaded,'event','تغییر',130));
});
test('principal allocation never creates negative interest from rounding',()=>{
  for(let total=3;total<150;total++)for(let component=0;component<=total;component++){
    const amounts=split(total,3),parts=apportion(component,amounts);assert.equal(sum(parts),component);assert.ok(parts.every((part,i)=>part<=amounts[i]));
  }
});
test('loan registration and actual disbursement commit together',()=>{
  const loan:Loan={id:'loan',name:'وام تازه',total:1100,installment:110,count:10,paid:0,nextDate:'2026-11-08',frequency:'ماهانه',principalTotal:1000,disbursementAccountId:'a'};
  let d=registerLoan(fixture(),loan,'2026-10-08','مرزیه');assert.equal(balance(d,'a'),2000);assert.equal(d.loans[0].principalRemaining,1000);assert.equal(d.transactions[0].type,'loan-receipt');assert.equal(d.installments.length,10);validate(d);d=loanPayment(d,'loan','a','2026-10-08','مرزیه');assert.throws(()=>reverse(d,'loan-receipt:loan'));
});
test('legacy loan schedule preserves contractual installment amounts',()=>{
  const loan:Loan={id:'legacy',name:'وام قدیمی',total:100,installment:33,count:3,paid:1,nextDate:'2026-10-08',frequency:'ماهانه',legacy:true};const schedule=scheduleLoan(loan);assert.deepEqual(schedule.map(i=>i.amount),[33,33,33]);assert.equal(schedule[0].date,'');assert.equal(schedule[1].date,'2026-10-08');
});
test('concurrent tabs cannot overwrite a newer durable snapshot',()=>{
  const storage=new MemoryStorage(),d=loadStore(storage,legacy(),at);saveStore(storage,post(d,tx()),d);assert.throws(()=>saveStore(storage,{...d,settings:{...d.settings,name:'stale'}},d));assert.equal(JSON.parse(storage.getItem(STORE_KEY)!).transactions.length,1);
});
test('incomplete assets and inconsistent historical FX are rejected',()=>{
  const d=assetFixture();delete (d.assets[0] as Partial<typeof d.assets[0]>).quantity;assert.throws(()=>validate(d));const fx=post(fixture(),tx({fx:{currency:'USD',originalAmount:'2',rate:'99',source:'fixture',date:'2026-10-08',direction:'IRT-per-unit',rounding:'half-up'}}));assert.throws(()=>validate(fx));
});
test('future-dated transactions cannot change actual balances',()=>{assert.throws(()=>post(fixture(),tx({date:'2099-01-01'})));});
test('editing a legacy savings event preserves its historical cash effect',()=>{
  const old=legacy();old.goals[0].saved=100;old.transactions=[tx({type:'saving',goalId:'g'})];let d=migrate(old,at);d=revise(d,'event','اصلاح پس‌انداز قدیمی',150);assert.equal(balance(d,'a'),950);assert.equal(d.goals[0].saved,150);assert.equal(d.transactions[0].legacy,true);validate(d);
});
test('reversing an unused loan receipt cancels future debt without deleting its history',()=>{
  const loan:Loan={id:'loan',name:'وام تازه',total:1100,installment:110,count:10,paid:0,nextDate:'2026-11-08',frequency:'ماهانه',principalTotal:1000,disbursementAccountId:'a'};let d=registerLoan(fixture(),loan,'2026-10-08','مرزیه');d=reverse(d,'loan-receipt:loan');assert.equal(balance(d,'a'),1000);assert.equal(remainingLoan(d,d.loans[0]),0);assert.equal(d.installments.length,10);assert.equal(d.transactions.length,1);assert.throws(()=>loanPayment(d,'loan','a','2026-10-08','مرزیه'));validate(d);
});
test('recurring income and goal allocations keep their economic meaning',()=>{
  let d=fixture();d.recurring.push({id:'income',name:'درآمد',amount:100,frequency:'ماهانه',nextDate:'2026-10-08',category:'درآمد',owner:'مرزیه',reminder:true,accountId:'a',transactionType:'income'});d=payRecurring(d,'income','2026-10-08','2026-10-08','مرزیه');assert.equal(balance(d,'a'),1100);assert.equal(d.transactions[0].type,'income');d.recurring.push({id:'save',name:'هدف',amount:200,frequency:'ماهانه',nextDate:'2026-10-08',category:'پس‌انداز',owner:'مرزیه',reminder:true,accountId:'a',transactionType:'saving',goalId:'g'});d=payRecurring(d,'save','2026-10-08','2026-10-08','مرزیه');assert.equal(balance(d,'a'),1100);assert.equal(d.goals[0].saved,200);assert.equal(consumption(d.transactions[0]),0);validate(d);
});
test('recurring foreign expenses require a fresh explicitly supplied rate',()=>{
  const d=fixture();d.recurring.push({id:'fx',name:'هزینه ارزی',amount:100,frequency:'ماهانه',nextDate:'2026-10-08',category:'سایر',owner:'مرزیه',reminder:true,accountId:'a',transactionType:'expense',foreignCurrency:'USD'});assert.throws(()=>payRecurring(d,'fx','2026-10-08','2026-10-08','مرزیه'));assert.equal(balance(d,'a'),1000);
});

test('folder lifecycle preserves ledger and derives summaries after edits, unlink and reverse',()=>{
 let d=saveFolder(fixture(),{id:'f',name:'سفر',note:'',owner:'مرزیه',visibility:'private',budget:200,color:'#6574cd',icon:'✈️'},'مرزیه');
 assert.deepEqual(d.accounts,fixture().accounts);assert.equal(d.accountEntries.length,0);
 d=post(d,tx());const entries=structuredClone(d.accountEntries);d=linkFolder(d,'event','f','مرزیه');
 assert.deepEqual(d.accountEntries,entries);assert.equal(d.transactions.length,1);assert.equal(folderReport(d,'f','مرزیه').total,100);
 d=saveFolder(d,{...d.folders[0],archived:true},'مرزیه');d=revise(d,'event','اصلاح',150);assert.equal(folderReport(d,'f','مرزیه').total,150);
 d=saveFolder(d,{...d.folders[0],archived:false},'مرزیه');d=linkFolder(d,'event',undefined,'مرزیه');assert.equal(folderReport(d,'f','مرزیه').total,0);assert.equal(balance(d,'a'),850);
 d=linkFolder(d,'event','f','مرزیه');const removed=deleteFolder(d,'f','مرزیه');assert.equal(removed.transactions.length,1);assert.equal(removed.transactions[0].folderId,undefined);assert.deepEqual(removed.accountEntries,d.accountEntries);validate(removed);
 d=reverse(d,'event');assert.equal(folderReport(d,'f','مرزیه').total,0);assert.equal(balance(d,'a'),1000);
});
test('project reports exclude non-expense events, filter visibility, and aggregate Jalali periods',()=>{
 const d=fixture();d.folders.push({id:'f',name:'سفر',note:'',owner:'مرزیه',visibility:'shared'});
 d.transactions=[tx({id:'1',folderId:'f'}),tx({id:'2',folderId:'f',type:'transfer'}),tx({id:'3',folderId:'f',type:'saving'}),tx({id:'4',folderId:'f',type:'asset-buy',fee:10}),tx({id:'5',folderId:'f',status:'reversed'}),tx({id:'6',folderId:'f',visibility:'private',createdBy:'علی'}),tx({id:'7',folderId:'f',category:'سفر',amount:50,date:'2026-09-01'})];
 const r=folderReport(d,'f','مرزیه');assert.equal(r.total,150);assert.deepEqual(r.categories,{خوراک:100,سفر:50});assert.equal(Object.keys(r.months).length,2);assert.equal(sum(Object.values(r.months)),150);assert.equal(r.transactions[0].date,'2026-10-08');
});
test('folder persistence retains optional fields and rejects invalid budgets and dangling links',()=>{
 let d=saveFolder(fixture(),{id:'f',name:'خانه',note:'',owner:'مرزیه',visibility:'private',budget:0},'مرزیه');d=post(d,tx({folderId:'f'}));const storage=new MemoryStorage();saveStore(storage,d);assert.deepEqual(loadStore(storage,legacy(),at),d);assert.deepEqual(migrate(d,at),d);
 assert.throws(()=>saveFolder(d,{...d.folders[0],budget:-1},'مرزیه'));assert.throws(()=>linkFolder(d,'event','missing','مرزیه'));assert.throws(()=>linkFolder(d,'event','f','علی'));assert.throws(()=>validate({...d,folders:[]}));
});

import { assetTrade, correctAssetOpening, correctAssetTrade, saveGoal, savingsSummary, setValuation, staleValuation } from '../src/savings';
test('optional savings targets and monthly plans are projections, not cash events',()=>{
 let d=saveGoal(fixture(),{id:'monthly',name:'پس‌انداز ماهانه',target:0,targetDate:'',saved:999,visibility:'shared',monthlyTarget:300,status:'active',monthlyPlans:{'1405-07':450}});
 assert.equal(d.goals.find(g=>g.id==='monthly')!.saved,0);assert.equal(d.transactions.length,0);assert.equal(balance(d,'a'),1000);
 d=post(d,tx({type:'saving',goalId:'monthly',allocationOnly:true,amount:200}));
 const s=savingsSummary(d,'مرزیه','1405-07');assert.equal(s.planned,450);assert.equal(s.actual,200);assert.equal(s.allocated,200);validate(d);assert.deepEqual(migrate(JSON.parse(JSON.stringify(d)),at),d);
});
test('completed goals block new contributions while withdrawals remain traceable',()=>{
 let d=post(fixture(),tx({type:'saving',goalId:'g',allocationOnly:true,amount:200}));d={...d,goals:d.goals.map(g=>({...g,status:'completed'}))};
 assert.throws(()=>post(d,tx({id:'more',type:'saving',goalId:'g',allocationOnly:true})));
 d=post(d,tx({id:'withdraw',type:'saving',goalId:'g',allocationOnly:true,goalWithdrawal:true,amount:50}));assert.equal(d.goals[0].saved,150);validate(d);
});
const savingsAssetFixture=():FinanceData=>({...fixture(),assets:[{id:'gold',name:'طلا',kind:'gold',identifier:'GOLD',unit:'گرم',purity:'18K',custody:'خانه',quantity:'0',openingQuantity:'0',cost:0,openingCost:0,visibility:'shared',owner:'مرزیه'}]});
test('funding reserved savings into an asset releases allocation once and reverses atomically',()=>{
 let d=post(savingsAssetFixture(),tx({id:'reserve',type:'saving',goalId:'g',allocationOnly:true,amount:600}));
 const purchase=tx({id:'buy',type:'asset-buy',assetId:'gold',quantity:'0.25',amount:500,fee:10});
 assert.throws(()=>post(d,purchase));d=assetTrade(d,purchase,'g');assert.equal(balance(d,'a'),490);assert.equal(d.goals[0].saved,90);assert.equal(d.assets[0].cost,500);assert.equal(consumption(d.transactions[0]),10);
 const loaded=JSON.parse(JSON.stringify(d));assert.strictEqual(assetTrade(loaded,purchase,'g'),loaded);validate(d);
 d=reverse(d,'buy');assert.equal(balance(d,'a'),1000);assert.equal(d.goals[0].saved,600);assert.equal(d.assets[0].quantity,'0');validate(d);
});
test('historical asset correction replays dependent partial sales and retains original history',()=>{
 let d=post(savingsAssetFixture(),tx({id:'buy',type:'asset-buy',assetId:'gold',quantity:'2',amount:400}));
 d=post(d,tx({id:'sell',type:'asset-sell',assetId:'gold',quantity:'0.5',amount:150}));
 d=correctAssetTrade(d,'buy',tx({id:'buy',type:'asset-buy',assetId:'gold',quantity:'3',amount:600}));
 assert.equal(d.assets[0].quantity,'2.5');assert.equal(d.assets[0].cost,500);assert.equal(balance(d,'a'),550);assert.equal(active(d.transactions.find(t=>t.id==='buy')!),false);assert.equal(d.transactions.filter(t=>active(t)&&t.assetId==='gold').length,2);validate(d);
 const store=new MemoryStorage();saveStore(store,d);assert.deepEqual(loadStore(store,legacy(),at),d);
 assert.throws(()=>correctAssetTrade(d,d.transactions.find(t=>active(t)&&t.type==='asset-buy')!.id,tx({type:'asset-buy',assetId:'gold',quantity:'0.1',amount:10})));
});
test('cashless holding adjustments preserve exact quantities without account effects',()=>{
 let d=post(savingsAssetFixture(),tx({type:'asset-buy',assetId:'gold',allocationOnly:true,quantity:'0.000000000000000001',amount:200}));
 assert.equal(balance(d,'a'),1000);assert.equal(d.assets[0].quantity,'0.000000000000000001');validate(d);
 assert.throws(()=>post(d,tx({id:'bad',type:'asset-buy',assetId:'gold',allocationOnly:true,quantity:'1',fee:1})));
 d=reverse(d,'event');assert.equal(d.assets[0].quantity,'0');validate(d);
});
test('manual valuations preserve timestamps and history, reject mismatched purity and future quotes',()=>{
 let d=post(savingsAssetFixture(),tx({type:'asset-buy',assetId:'gold',quantity:'2',amount:400}));
 const quote={identifier:'GOLD',unit:'گرم',purity:'18K',price:'300',currency:'IRT' as const,timestamp:at,source:'ورود دستی'};
 d=setValuation(d,'gold',quote,'manual');assert.equal(converted(d.assets[0].quantity,d.assets[0].quote!),600);assert.equal(d.assets[0].cost,400);assert.equal(balance(d,'a'),600);assert.equal(d.assets[0].quoteMode,'manual');assert.equal(staleValuation(d.assets[0]),false);
 assert.throws(()=>setValuation(d,'gold',{...quote,purity:'24K'},'manual'));assert.throws(()=>setValuation(d,'gold',{...quote,timestamp:'2027-01-01T00:00:00Z'},'provider'));
 d=setValuation(d,'gold',{...quote,price:'250',timestamp:'2026-10-01T00:00:00Z'},'manual');assert.equal(staleValuation(d.assets[0]),false);assert.equal(d.assets[0].quote,'300');assert.equal(d.assets[0].quoteHistory!.length,2);validate(d);
});
test('unpriced assets remain unavailable and corrupted holding projections are rejected',()=>{
 const d=savingsAssetFixture();assert.equal(savingsSummary(d,'مرزیه','1405-07').missing,1);assert.throws(()=>validate({...d,assets:d.assets.map(a=>({...a,quantity:'10'}))}));
});




test('opening acquisition corrections preserve audit and recompute disposed basis without cash effects',()=>{
 let d=savingsAssetFixture();d={...d,assets:d.assets.map(a=>({...a,openingQuantity:'2',quantity:'2',openingCost:400,cost:400}))};
 d=post(d,tx({id:'sale',type:'asset-sell',assetId:'gold',quantity:'0.5',amount:150}));
 const closing=balance(d,'a');d=correctAssetOpening(d,'gold',{openingQuantity:'3',openingCost:900,acquisitionDate:'2026-09-01',originalCost:'900',originalCurrency:'IRT'},'اصلاح رسید خرید');
 assert.equal(balance(d,'a'),closing);assert.equal(d.assets[0].quantity,'2.5');assert.equal(d.assets[0].cost,750);assert.equal(d.transactions[0].costBasis,150);assert.equal(d.transactions[0].costBasisRevisions![0].value,100);assert.equal(d.assetOpeningRevisions![0].previous.openingCost,400);validate(d);
 assert.throws(()=>correctAssetOpening(d,'gold',{openingQuantity:'0.1',openingCost:100},'اصلاح ناسازگار'));
 const store=new MemoryStorage();saveStore(store,d);assert.deepEqual(loadStore(store,legacy(),at),d);
});
test('linked funding releases cannot be reversed independently of their asset purchase',()=>{
 let d=post(savingsAssetFixture(),tx({id:'reserve',type:'saving',goalId:'g',allocationOnly:true,amount:600}));
 d=assetTrade(d,tx({id:'buy',type:'asset-buy',assetId:'gold',quantity:'2',amount:500}),'g');
 assert.throws(()=>reverse(d,'buy:release'));assert.throws(()=>revise(d,'buy:release','اصلاح',100));
 d=correctAssetTrade(d,'buy',tx({id:'buy',type:'asset-buy',assetId:'gold',quantity:'1',amount:400}));assert.equal(d.goals[0].saved,200);assert.equal(balance(d,'a'),600);validate(d);
});
test('foreign asset purchases preserve original currency and exact unit price across reload',()=>{
 const d=post(savingsAssetFixture(),tx({type:'asset-buy',assetId:'gold',amount:600,quantity:'0.25',fx:{currency:'USD',originalAmount:'2',rate:'300',source:'fixture only',date:'2026-10-08',direction:'IRT-per-unit',rounding:'half-up'}}));
 assert.equal(d.transactions[0].unitPrice,'8');assert.equal(d.transactions[0].fx!.originalAmount,'2');assert.equal(balance(d,'a'),400);validate(d);
 const store=new MemoryStorage();saveStore(store,d);assert.equal(loadStore(store,legacy(),at).transactions[0].unitPrice,'8');
});
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SavingsGoals, AssetHoldings } from '../src/SavingsAssets';
test('Persian module screens render optional target and empty/unpriced states without invalid progress',()=>{
 const d=saveGoal(fixture(),{id:'monthly',name:'پس‌انداز ماهانه',target:0,saved:0,targetDate:'',monthlyTarget:100,visibility:'shared'});
 const goals=renderToStaticMarkup(createElement(SavingsGoals,{data:d,viewer:'مرزیه',change:()=>{}}));assert.match(goals,/بدون مبلغ هدف/);assert.doesNotMatch(goals,/NaN|Infinity/);
 const empty=renderToStaticMarkup(createElement(AssetHoldings,{data:fixture(),viewer:'مرزیه',change:()=>{}}));assert.match(empty,/هنوز دارایی نداری/);
 const assets=renderToStaticMarkup(createElement(AssetHoldings,{data:savingsAssetFixture(),viewer:'مرزیه',change:()=>{}}));assert.match(assets,/قیمت ثبت نشده/);assert.match(assets,/ارائه‌دهنده معتبر قیمت تنظیم نشده/);
});

import './input-format.test';

test('category deletion removes matching events atomically and reconciles after reload',()=>{
 let d=post(fixture(),tx());
 d=post(d,tx({id:'other',category:'سایر',amount:40}));
 const category=d.categoryRecords.find(c=>c.name==='خوراک')!;
 const before=JSON.stringify(d);
 const result=deleteCategory(d,category.id);
 assert.equal(JSON.stringify(d),before);
 assert.equal(balance(result,'a'),960);
 assert.equal(result.transactions.length,1);
 assert.equal(result.transactions[0].id,'other');
 assert.ok(!result.categoryRecords.some(c=>c.id===category.id));
 assert.ok(!result.accountEntries.some(e=>e.transactionId==='event'));
 assert.equal(result.budget.categories['خوراک'],undefined);
 validate(result);
 const storage=new MemoryStorage(); saveStore(storage,result);
 assert.deepEqual(loadStore(storage,legacy(),at),result);
});
