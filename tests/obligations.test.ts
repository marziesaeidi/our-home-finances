import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FinancialObligations } from '../src/FinancialObligations';
import { adjustInstallment, createLoan, dueItems, reminders, saveCheck, saveRecurring, setCheckStatus, settleCheck, settleInstallment, settleRecurring, totals } from '../src/obligations';
import { consumption, earnedIncome, post, remainingLoan, reverse } from '../src/finance';
import { fromJalali, nextDate } from '../src/calendar';
import { migrate, saveStore, loadStore, validate } from '../src/store';
import type { Data, FinanceData, Loan, Obligation, Recurring, Transaction } from '../src/types';

const who='مرزیه',date='2026-10-08',at=date+'T12:00:00.000Z';
const initial:Data={transactions:[],accounts:[{id:'a',name:'بانک',type:'بانکی',balance:10000,visibility:'shared'}],loans:[],goals:[],recurring:[],budget:{total:10000,categories:{}}};
const fixture=()=>migrate(structuredClone(initial),at);
const check=(extra:Partial<Obligation>={}):Obligation=>({id:'check',name:'چک اجاره',kind:'check',direction:'pay',amount:100,currency:'IRT',date,accountId:'a',category:'خانه',status:'pending',bank:'ملت',reference:'123',counterparty:'مالک',owner:who,visibility:'shared',reminderDays:[3,0],...extra});
const loan=(extra:Partial<Loan>={}):Loan=>({id:'loan',name:'وام',total:0,count:3,installment:0,paid:0,nextDate:date,frequency:'ماهانه',principalTotal:100,interestTotal:10,feesTotal:4,currency:'IRT',direction:'borrow',startDate:date,repaymentStartDate:date,accountId:'a',calculation:'equal-manual-total',...extra});
const template=(extra:Partial<Recurring>={}):Recurring=>({id:'rent',name:'اجاره',amount:100,currency:'IRT',frequency:'ماهانه',nextDate:date,startDate:date,category:'خانه',accountId:'a',owner:who,reminder:true,transactionType:'expense',reminderDays:[3,0],...extra});
const opts=(extra={})=>({requestId:'one',date,accountId:'a',...extra});
const balance=(d:FinanceData)=>d.accounts[0].balance;
const transaction=(extra:Partial<Transaction>={}):Transaction=>({id:'purchase',title:'اجاره ثبت‌شده',amount:100,type:'expense',category:'خانه',accountId:'a',date,createdBy:who,visibility:'shared',...extra});

test('check creation and editing never debit cash; settling and reload retry post once',()=>{
  let d=saveCheck(fixture(),check(),who);d=saveCheck(d,check({bank:'سامان'}),who);assert.equal(balance(d),10000);
  d=settleCheck(d,'check',opts(),who);assert.equal(balance(d),9900);assert.equal(d.obligations[0].status,'cleared');validate(d);
  assert.deepEqual(settleCheck(JSON.parse(JSON.stringify(d)),'check',opts(),who),d);
  assert.throws(()=>saveCheck(d,check(),who));
});
test('incoming check credits once and pending cancellation or bouncing has no cash effects',()=>{
  const d=saveCheck(fixture(),check({direction:'receive'}),who);
  assert.equal(balance(settleCheck(d,'check',opts(),who)),10100);
  for(const status of ['canceled','bounced'] as const){const canceled=setCheckStatus(d,'check',status,who);assert.equal(balance(canceled),10000);assert.throws(()=>settleCheck(canceled,'check',opts(),who));}
});
test('link check to original purchase avoids duplicate expense and rejects incompatible or reused transaction',()=>{
  const d=saveCheck(post(fixture(),transaction()),check(),who),settled=settleCheck(d,'check',opts({existingId:'purchase'}),who);
  assert.equal(balance(settled),9900);assert.equal(settled.transactions.length,1);assert.equal(settled.transactions[0].obligationId,'check');validate(settled);
  const other=saveCheck(settled,check({id:'other'}),who);assert.throws(()=>settleCheck(other,'other',opts({existingId:'purchase'}),who));
  assert.throws(()=>settleCheck(saveCheck(post(fixture(),transaction({amount:90})),check(),who),'check',opts({existingId:'purchase'}),who));
});
test('settled check reversal restores pending and keeps history; reused reversed request cannot clear it',()=>{
  const settled=settleCheck(saveCheck(fixture(),check(),who),'check',opts(),who),undone=reverse(settled,settled.transactions[0].id);
  assert.equal(balance(undone),10000);assert.equal(undone.obligations[0].status,'pending');validate(undone);
  assert.throws(()=>settleCheck(undone,'check',opts(),who));
  const again=settleCheck(undone,'check',opts({requestId:'two'}),who);assert.equal(balance(again),9900);assert.equal(again.transactions.length,2);validate(again);
});
test('currency settlement stores explicit historical rate and dashboard never mixes currencies',()=>{
  let d=saveCheck(fixture(),check({currency:'USD',amount:2}),who);assert.throws(()=>settleCheck(d,'check',opts(),who));
  const stats=totals(dueItems(d,who),date);assert.equal(stats.outstanding.USD,2);assert.equal(stats.outstanding.IRT,0);
  d=settleCheck(d,'check',opts({rate:'60000'}),who);assert.equal(balance(d),-110000);assert.equal(d.transactions[0].fx?.originalAmount,'2');validate(d);
  const rial=settleCheck(saveCheck(fixture(),check({currency:'IRR',amount:1000}),who),'check',opts(),who);assert.equal(balance(rial),9900);validate(rial);
});
test('equal schedule conserves principal, interest and fees independently with Jalali cadence',()=>{
  const d=createLoan(fixture(),loan(),undefined,who);assert.equal(balance(d),10000);assert.equal(d.transactions.length,0);
  assert.deepEqual(d.installments.map(i=>i.principal),[33,33,34]);assert.deepEqual(d.installments.map(i=>i.interest),[3,3,4]);assert.deepEqual(d.installments.map(i=>i.fees),[1,1,2]);
  assert.equal(d.installments[1].date,nextDate(date,'ماهانه'));assert.equal(d.loans[0].principalRemaining,100);assert.equal(remainingLoan(d,d.loans[0]),114);validate(d);
});
test('partial installment creates one cash payment and distinguishes principal from expenses',()=>{
  let d=createLoan(fixture(),loan(),undefined,who);const request=opts({principal:10,interest:2,fees:1});d=settleInstallment(d,'loan:0',request,who);
  assert.equal(balance(d),9987);assert.equal(d.loans[0].principalRemaining,90);assert.equal(d.installments[0].paidAmount,13);assert.equal(d.loans[0].paid,0);assert.equal(consumption(d.transactions[0]),3);assert.equal(remainingLoan(d,d.loans[0]),101);validate(d);
  assert.deepEqual(settleInstallment(JSON.parse(JSON.stringify(d)),'loan:0',request,who),JSON.parse(JSON.stringify(d)));
  d=settleInstallment(d,'loan:0',opts({requestId:'two',principal:23,interest:1,fees:0}),who);
  assert.equal(d.installments[0].settled,true);assert.equal(d.loans[0].paid,1);assert.equal(d.loans[0].principalRemaining,67);validate(d);
  assert.throws(()=>settleInstallment(d,'loan:0',opts({requestId:'three',principal:1}),who));
});
test('installment overpayment and invalid account fail atomically; early payment is allowed',()=>{
  const d=createLoan(fixture(),loan(),undefined,who);
  assert.throws(()=>settleInstallment(d,'loan:0',opts({principal:34,interest:0,fees:0}),who));
  assert.throws(()=>settleInstallment(d,'loan:0',opts({accountId:'missing',principal:1,interest:0,fees:0}),who));
  const early=settleInstallment(d,'loan:2',opts({principal:34,interest:4,fees:2}),who);assert.equal(early.installments[2].settled,true);assert.equal(early.loans[0].principalRemaining,66);validate(early);
});
test('installment reversal recomputes paid status, principal, next due date and balance',()=>{
  const paid=settleInstallment(createLoan(fixture(),loan(),undefined,who),'loan:0',opts({principal:33,interest:3,fees:1}),who);
  const reversed=reverse(paid,paid.transactions[0].id);assert.equal(balance(reversed),10000);assert.equal(reversed.loans[0].principalRemaining,100);assert.equal(reversed.loans[0].nextDate,date);assert.equal(reversed.installments[0].paidAmount,0);assert.equal(reversed.transactions.length,1);validate(reversed);
});
test('lending principal collection is cash inflow without treating principal as income',()=>{
  const d=settleInstallment(createLoan(fixture(),loan({direction:'lend'}),undefined,who),'loan:0',opts({principal:33,interest:3,fees:1}),who);
  assert.equal(balance(d),10037);assert.equal(consumption(d.transactions[0]),0);assert.equal(earnedIncome(d.transactions[0]),4);assert.equal(d.loans[0].principalRemaining,67);assert.equal(totals(dueItems(d,who),date).outstanding.IRT,0);validate(d);
});
test('linking an existing installment payment reduces principal without debiting cash again',()=>{
  const base=post(createLoan(fixture(),loan(),undefined,who),transaction({amount:37}));
  const d=settleInstallment(base,'loan:0',opts({existingId:'purchase',principal:33,interest:3,fees:1}),who);
  assert.equal(balance(d),9963);assert.equal(d.transactions.length,1);assert.equal(consumption(d.transactions[0]),4);assert.equal(d.loans[0].paid,1);validate(d);
  assert.deepEqual(settleInstallment(d,'loan:0',opts({existingId:'purchase',principal:33,interest:3,fees:1}),who),d);
});
test('manual schedule validates contractual components and preserves paid history on adjustments',()=>{
  const l=loan({count:2,calculation:'manual'}),rows=[{id:'loan:0',loanId:'loan',index:0,principal:70,interest:8,fees:3,amount:81,date,settled:false},{id:'loan:1',loanId:'loan',index:1,principal:30,interest:2,fees:1,amount:33,date:'2026-11-01',settled:false}];
  let d=createLoan(fixture(),l,rows,who);assert.throws(()=>createLoan(fixture(),l,[{...rows[0],principal:69},rows[1]],who));
  d=adjustInstallment(d,{...d.installments[1],principal:35,amount:38},who);assert.equal(d.loans[0].principalTotal,105);validate(d);
  d=settleInstallment(d,'loan:0',opts({principal:1,interest:0,fees:0}),who);assert.throws(()=>adjustInstallment(d,{...d.installments[0],date:'2026-11-01'},who));
});
test('recurring confirmation uses occurrence identity, adjusted amount and preserves historical payment',()=>{
  let d=saveRecurring(fixture(),template(),who);assert.equal(balance(d),10000);
  d=settleRecurring(d,'rent',date,opts({value:120}),who);assert.equal(balance(d),9880);assert.equal(d.recurring[0].amount,100);assert.equal(d.recurring[0].nextDate,nextDate(date,'ماهانه'));validate(d);
  assert.deepEqual(settleRecurring(JSON.parse(JSON.stringify(d)),'rent',date,opts({value:120}),who),JSON.parse(JSON.stringify(d)));
  const edited=saveRecurring(d,{...d.recurring[0],amount:150},who);assert.equal(edited.transactions[0].amount,120);validate(edited);
  const reversed=reverse(edited,edited.transactions[0].id);assert.equal(reversed.recurring[0].nextDate,date);assert.equal(balance(reversed),10000);validate(reversed);
});
test('weekly yearly and custom recurrence respect end dates and leap month clamps',()=>{
  for(const frequency of ['هفتگی','سالانه','سفارشی']){
    const d=settleRecurring(saveRecurring(fixture(),template({frequency,customDays:10,endDate:date}),who),'rent',date,opts(),who);assert.equal(dueItems(d,who).length,0);assert.throws(()=>settleRecurring(d,'rent',d.recurring[0].nextDate,opts({requestId:'two'}),who));validate(d);
  }
  const esfand=fromJalali('1403/12/30');assert.equal(nextDate(esfand,'سالانه'),fromJalali('1404/12/29'));
});
test('private obligations are excluded from dashboard and another user cannot settle them',()=>{
  const d=saveCheck(fixture(),check({visibility:'private'}),who);assert.equal(dueItems(d,'علی').length,0);assert.throws(()=>settleCheck(d,'check',opts(),'علی'));
  assert.deepEqual(reminders('۷،۳،۰،۳'),[7,3,0]);assert.throws(()=>reminders('۱.۵'));
});
test('managed obligations survive atomic storage reload; invalid payment projections are rejected',()=>{
  let d=createLoan(fixture(),loan(),undefined,who);d=settleInstallment(d,'loan:0',opts({principal:10,interest:0,fees:0}),who);
  const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
  saveStore(storage,d);assert.deepEqual(loadStore(storage,initial,at),JSON.parse(JSON.stringify(d)));
  assert.throws(()=>validate({...d,installments:d.installments.map(i=>i.id==='loan:0'?{...i,paidAmount:999}:i)}));
});
test('Persian RTL module renders dashboard calendar and all obligation sections',()=>{
  const data=createLoan(saveCheck(saveRecurring(fixture(),template(),who),check(),who),loan(),undefined,who);
  for(const initialTab of ['dashboard','checks','loans','recurring'] as const){const html=renderToStaticMarkup(createElement(FinancialObligations,{data,viewer:who,change:()=>{},initialTab}));assert.match(html,/تعهدات مالی/);assert.match(html,/پرداخت‌های دوره‌ای/);assert.doesNotMatch(html,/NaN|Infinity/);if(initialTab==='dashboard')assert.match(html,/due-calendar/);}
});

test('dashboard includes every weekly occurrence in the Jalali month without posting them',()=>{
  const d=saveRecurring(fixture(),template({frequency:'هفتگی'}),who);
  const rows=dueItems(d,who,'2026-10-22');assert.equal(rows.length,3);assert.equal(totals(rows,date).month.IRT,300);assert.equal(balance(d),10000);assert.equal(d.transactions.length,0);
});
test('foreign partial loan settlement converts cash and interest once and preserves native principal',()=>{
  const d=settleInstallment(createLoan(fixture(),loan({currency:'USD',principalTotal:100,interestTotal:10,feesTotal:0}),undefined,who),'loan:0',opts({principal:10,interest:2,fees:0,rate:'60000'}),who);
  assert.equal(balance(d),-710000);assert.equal(consumption(d.transactions[0]),120000);assert.equal(d.loans[0].principalRemaining,90);validate(d);
  assert.throws(()=>validate({...d,loans:d.loans.map(l=>({...l,principalRemaining:100}))}));
  assert.throws(()=>validate({...d,transactions:d.transactions.map(t=>({...t,paymentAllocation:{...t.paymentAllocation!,expense:720000}}))}));
});
test('new recurring confirmation retains existing transfer and savings semantics',()=>{
  const base=fixture();base.accounts.push({id:'b',name:'دوم',type:'بانکی',balance:0,openingBalance:0,currency:'IRT',visibility:'shared'});
  const d=settleRecurring(saveRecurring(base,template({transactionType:'transfer',toAccountId:'b'}),who),'rent',date,opts(),who);
  assert.equal(balance(d),9900);assert.equal(d.accounts[1].balance,100);assert.equal(consumption(d.transactions[0]),0);validate(d);
});
