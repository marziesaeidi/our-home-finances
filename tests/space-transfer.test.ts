import { createLoan, settleInstallment, saveRecurring, settleRecurring } from '../src/obligations';
import { assetTrade, correctAssetOpening } from '../src/savings';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpaceData, validate } from '../src/store';
import { moveBetweenSpaces, transferPlan, type TransferOptions } from '../src/space-transfer';
import { post, reverse, consumption } from '../src/finance';
import type { FinanceData, Transaction } from '../src/types';
const at='2026-10-08T12:00:00.000Z';
function fixture(owner='u',account='bank'){
 const d=createSpaceData(owner,{id:owner,name:owner},at);
 d.accounts=[{id:account,name:account,type:'بانکی',balance:10000,openingBalance:10000,currency:'IRT',visibility:'private',owner}];
 d.assets=[{id:'gold',name:'طلا',kind:'gold',quantity:'1',openingQuantity:'1',cost:100,openingCost:100,unit:'گرم',custody:'خانه',owner,visibility:'private',quote:'110',quoteDate:'2026-10-08'}];return d;
}
const options=(extra:Partial<TransferOptions>={}):TransferOptions=>({selection:{kind:'assets',id:'gold'},accountMap:{bank:'target-bank'},requestId:'req1',sourceId:'personal',targetId:'shared',sourceMember:'u',targetMember:'v',targetKind:'household',at,...extra});
const target=()=>{const d=fixture('v','target-bank');d.assets=[];return d;};
const buy=(extra:Partial<Transaction>={}):Transaction=>({id:'buy',title:'خرید طلا',amount:200,type:'asset-buy',category:'سرمایه‌گذاری',accountId:'bank',assetId:'gold',quantity:'2',fee:10,date:'2026-10-08',createdBy:'u',visibility:'private',...extra});
test('moving one asset preserves unrelated records, quantities, cash and fees across reload and round trip',()=>{
 let d=post(fixture(),buy());d.assets.push({...d.assets[0],id:'other',name:'دیگر',openingQuantity:'1',quantity:'1',cost:100,openingCost:100});
 d=post(d,{id:'food',title:'خوراک',amount:50,type:'expense',category:'خوراک',accountId:'bank',date:'2026-10-08',createdBy:'u',visibility:'private'});
 const before=JSON.stringify(d),dst=target();const result=moveBetweenSpaces(d,dst,options());
 assert.equal(JSON.stringify(d),before);assert.deepEqual(result.source.assets.map(a=>a.id),['other']);assert.deepEqual(result.source.transactions.map(t=>t.id),['food']);
 assert.equal(result.source.accounts[0].balance,d.accounts[0].balance);assert.equal(result.target.accounts[0].balance,dst.accounts[0].balance);
 assert.equal(result.target.assets[0].quantity,'3');assert.equal(result.target.assets[0].cost,300);assert.equal(result.target.assets[0].visibility,'shared');assert.equal(result.target.transactions[0].fee,10);
 assert.equal(consumption(result.target.transactions[0]),10);assert.equal(result.source.spaceTransfers?.[0].originals.transactions instanceof Array,true);
 const reloaded=JSON.parse(JSON.stringify(result));validate(reloaded.source);validate(reloaded.target);
 const back=moveBetweenSpaces(reloaded.target,reloaded.source,options({selection:{kind:'assets',id:result.target.assets[0].id},accountMap:{'target-bank':'bank'},requestId:'req2',sourceId:'shared',targetId:'personal',sourceMember:'v',targetMember:'u',targetKind:'personal'}));
 assert.equal(back.source.assets.length,0);assert.equal(back.target.assets.length,2);assert.equal(back.target.assets[1].quantity,'3');assert.equal(back.target.assets[1].visibility,'private');assert.equal(back.target.accounts[0].balance,d.accounts[0].balance);validate(back.source);validate(back.target);
});
test('reversed asset trades and their ledger reversals travel without replaying cash',()=>{
 let d=post(fixture(),buy());d=reverse(d,'buy');const r=moveBetweenSpaces(d,target(),options());assert.equal(r.target.assets[0].quantity,'1');assert.equal(r.target.transactions[0].status,'reversed');assert.equal(r.target.accountEntries.length,2);assert.equal(r.target.accounts[0].balance,10000);validate(r.target);
});
test('account itself travels with its current balance and linked history',()=>{
 const d=post(fixture(),buy());const r=moveBetweenSpaces(d,target(),options({selection:{kind:'accounts',id:'bank'},accountMap:{}}));assert.equal(r.source.accounts.length,0);assert.equal(r.source.assets.length,0);assert.equal(r.target.accounts[1].balance,9790);assert.equal(r.target.accounts[1].openingBalance,10000);validate(r.source);validate(r.target);
});
test('a standalone asset needs no destination bank account',()=>{
 const dst=target();dst.accounts=[];const r=moveBetweenSpaces(fixture(),dst,options({accountMap:{}}));assert.equal(r.target.assets.length,1);assert.equal(r.target.accounts.length,0);
});
test('wrong currency, inaccessible accounts and collapsed internal legs are rejected without mutation',()=>{
 const d=post(fixture(),buy()),dst=target();dst.accounts[0].currency='USD';assert.throws(()=>moveBetweenSpaces(d,dst,options()),/ارز یکسان/);dst.accounts[0].currency='IRT';dst.accounts[0].owner='other';assert.throws(()=>moveBetweenSpaces(d,dst,options()),/ارز یکسان/);
 const x=fixture();x.accounts.push({...x.accounts[0],id:'second'});const trans=post(x,{...buy(),id:'internal',type:'transfer',assetId:undefined,quantity:undefined,fee:undefined,toAccountId:'second'});
 assert.throws(()=>moveBetweenSpaces(trans,target(),options({selection:{kind:'transactions',id:'internal'},accountMap:{bank:'target-bank',second:'target-bank'}})),/دو حساب متفاوت/);
});
test('readers cannot move and private related records are not exposed by preview',()=>{
 const d=post(fixture(),buy());d.settings.members![0].role='reader';d.settings.members!.push({id:'owner',name:'owner',role:'owner'});assert.throws(()=>moveBetweenSpaces(d,target(),options()),/دسترسی ویرایش/);
 const x=post(fixture(),buy());x.transactions[0].createdBy='someone';assert.throws(()=>transferPlan(x,{kind:'assets',id:'gold'},'u'),/خصوصی/);
});
test('moving a box preserves reservation and checks destination funding',()=>{
 const d=fixture();d.assets=[];d.goals=[{id:'box',name:'سفر',target:1000,saved:0,openingSaved:0,targetDate:'',owner:'u',visibility:'private'}];
 const x=post(d,{id:'saving',title:'پس‌انداز',amount:500,type:'saving',category:'پس‌انداز',accountId:'bank',goalId:'box',allocationOnly:true,date:'2026-10-08',createdBy:'u',visibility:'private'});
 const r=moveBetweenSpaces(x,target(),options({selection:{kind:'goals',id:'box'}}));assert.equal(r.target.goals[0].saved,500);assert.equal(r.target.accounts[0].balance,10000);assert.equal(r.source.goals.length,0);
 const dst=target();dst.accounts[0].balance=0;dst.accounts[0].openingBalance=0;assert.throws(()=>moveBetweenSpaces(x,dst,options({selection:{kind:'goals',id:'box'}})),/کافی نیست/);
});
test('monthly budget moves without overwriting destination or leaving the current budget behind',()=>{
 const d=fixture();d.monthlyBudgets['1405-07']={total:300,categories:{خوراک:100}};d.budget=d.monthlyBudgets['1405-07'];const r=moveBetweenSpaces(d,target(),options({selection:{kind:'monthlyBudgets',id:'1405-07'},accountMap:{}}));assert.equal(r.source.monthlyBudgets['1405-07'],undefined);assert.equal(r.source.budget.total,0);assert.equal(r.target.budget.total,300);
 assert.throws(()=>moveBetweenSpaces(d,r.target,options({selection:{kind:'monthlyBudgets',id:'1405-07'},accountMap:{}})),/بودجه وجود دارد/);
});

test('managed loan moves with paid allocations and can be repaid and reversed in the destination',()=>{
 let d=fixture();d.assets=[];d=createLoan(d,{id:'loan',name:'وام',total:0,count:3,installment:0,paid:0,nextDate:'2026-10-08',frequency:'ماهانه',principalTotal:100,interestTotal:10,feesTotal:4,currency:'IRT',direction:'borrow',startDate:'2026-10-08',repaymentStartDate:'2026-10-08',accountId:'bank',calculation:'equal-manual-total'},undefined,'u');
 d=settleInstallment(d,d.installments[0].id,{requestId:'pay',date:'2026-10-08',accountId:'bank',principal:33,interest:3,fees:1},'u');
 const r=moveBetweenSpaces(d,target(),options({selection:{kind:'loans',id:'loan'}}));assert.equal(r.source.loans.length,0);assert.equal(r.target.loans[0].paid,1);assert.equal(r.target.accounts[0].balance,10000);assert.equal(r.target.installments.length,3);
 const undone=reverse(r.target,r.target.transactions[0].id);assert.equal(undone.loans[0].paid,0);validate(undone);
});
test('recurring schedule keeps occurrence identity and remains payable after a move',()=>{
 let d=fixture();d.assets=[];d=saveRecurring(d,{id:'rent',name:'اجاره',amount:100,currency:'IRT',frequency:'ماهانه',nextDate:'2026-10-08',startDate:'2026-10-08',category:'خانه',accountId:'bank',owner:'u',reminder:true,transactionType:'expense'},'u');
 d=settleRecurring(d,'rent','2026-10-08',{requestId:'one',date:'2026-10-08',accountId:'bank'},'u');
 const r=moveBetweenSpaces(d,target(),options({selection:{kind:'recurring',id:'rent'}}));const template=r.target.recurring[0];assert.ok(r.target.transactions[0].occurrenceKey!.startsWith(template.id+':'));
 const next=settleRecurring(r.target,template.id,template.nextDate,{requestId:'two',date:'2026-10-08',accountId:'target-bank'},'v');assert.equal(next.transactions.length,2);assert.equal(next.accounts[0].balance,9900);validate(next);
});
test('asset funding releases remain linked to purchases through movement and reversal',()=>{
 let d=fixture();d.goals=[{id:'box',name:'سفر',target:1000,saved:0,openingSaved:0,targetDate:'',owner:'u',visibility:'private'}];d=post(d,{id:'reserve',title:'پس‌انداز',type:'saving',amount:500,category:'پس‌انداز',goalId:'box',accountId:'bank',allocationOnly:true,date:'2026-10-08',createdBy:'u',visibility:'private'});d=assetTrade(d,buy(),'box');
 const r=moveBetweenSpaces(d,target(),options());assert.equal(r.target.goals[0].saved,290);assert.equal(r.source.goals.length,0);const purchase=r.target.transactions.find(t=>t.type==='asset-buy')!;assert.ok(r.target.transactions.some(t=>t.id===purchase.id+':release'));assert.throws(()=>reverse(r.target,purchase.id+':release'),/خرید مرتبط/);
 const undo=reverse(r.target,purchase.id);assert.equal(undo.goals[0].saved,500);validate(undo);
});
test('asset opening revisions keep historical snapshots after moving',()=>{
 const d=correctAssetOpening(fixture(),'gold',{openingQuantity:'2',openingCost:180},'اصلاح');const r=moveBetweenSpaces(d,target(),options({accountMap:{}}));assert.equal(r.source.assetOpeningRevisions!.length,0);assert.equal(r.target.assetOpeningRevisions![0].previous.id,r.target.assets[0].id);assert.equal(r.target.assetOpeningRevisions![0].previous.openingQuantity,'1');validate(JSON.parse(JSON.stringify(r.target)));
});
