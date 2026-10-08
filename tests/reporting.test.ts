import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { migrate, validate } from '../src/store';
import { post } from '../src/finance';
import { report, dateRange, budgetUsage, csv, transactionRows } from '../src/reporting';
import { MonthlyBudgets, UnifiedDashboard, FinancialReports } from '../src/BudgetReporting';
import { fromJalali } from '../src/calendar';
import type { Transaction } from '../src/types';
const day='2026-10-08';
const fixture=()=>migrate({transactions:[],accounts:[{id:'a',name:'بانک',balance:1000,type:'cash',visibility:'shared'},{id:'b',name:'نقد',balance:200,type:'cash',visibility:'shared'}],goals:[{id:'g',name:'هدف',target:1000,saved:0,targetDate:day,visibility:'shared'}],loans:[],recurring:[],budget:{total:500,categories:{خوراک:200}}},day+'T12:00:00Z');
const tx=(over:Partial<Transaction>={}):Transaction=>({id:'expense',title:'خوراک',amount:100,type:'expense',category:'خوراک',accountId:'a',createdBy:'مرزیه',visibility:'shared',date:day,...over});
test('unified report reconciles cash with balances, excludes allocation and internal transfer',()=>{
 let d=post(fixture(),tx());d=post(d,tx({id:'transfer',type:'transfer',amount:200,toAccountId:'b'}));d=post(d,tx({id:'saving',type:'saving',goalId:'g',allocationOnly:true,amount:50}));
 const r=report(d,'مرزیه',dateRange('current',day),day);
 assert.equal(r.expense,100);assert.equal(r.income,0);assert.equal(r.saving,50);assert.deepEqual(r.cash,[['IRT',-100]]);assert.deepEqual(r.balances,[['IRT',1100]]);assert.equal(r.netWorth,1100);assert.equal(r.goals[0].saved,50);
 const filtered=report(d,'مرزیه',{...dateRange('current',day),account:'b'},day);assert.equal(filtered.expense,0);assert.deepEqual(filtered.cash,[['IRT',200]]);
});
test('report filters, reversed and future events, duplicate recurring occurrence and CSV agree',()=>{
 const d=fixture();d.transactions=[tx(),tx({id:'private',visibility:'private',createdBy:'علی'}),tx({id:'future',date:'2026-12-01'}),tx({id:'reversed',status:'reversed'}),tx({id:'r1',occurrenceKey:'template:2026-10-08'}),tx({id:'r2',occurrenceKey:'template:2026-10-08'})];
 const r=report(d,'مرزیه',{...dateRange('current',day),currency:'IRT',category:'خوراک'},day);assert.equal(r.transactions.length,2);assert.equal(r.expense,200);assert.equal(transactionRows(r).length,3);assert.ok(csv(transactionRows(r)).startsWith('\uFEFF'));assert.ok(csv([['=SUM(A1)','الف"ب']]).includes("'=SUM"));assert.equal(report(d,'مرزیه',{...dateRange('current',day),folder:'missing'},day).expense,0);
});
test('Jalali presets cross year correctly and thresholds preserve overspending',()=>{
 const now=fromJalali('1405/1/5');assert.equal(dateRange('previous',now).start,fromJalali('1404/12/1'));assert.equal(dateRange('previous',now).end,fromJalali('1404/12/29'));assert.equal(dateRange('three',now).start,fromJalali('1404/11/1'));assert.equal(dateRange('year',day).start,fromJalali('1405/1/1'));
 assert.equal(budgetUsage(100,80).state,'warning');assert.equal(budgetUsage(100,100).state,'exceeded');assert.equal(budgetUsage(100,120).remaining,-20);assert.equal(budgetUsage(0,100).state,'unset');
});
test('scheduled obligations never affect totals and persistence validates dashboard and budget options',()=>{
 const d=fixture();d.obligations.push({id:'o',name:'چک',kind:'check',direction:'pay',amount:500,date:'2026-10-10',accountId:'a',category:'خوراک',status:'pending',reference:'',owner:'مرزیه',visibility:'shared'});
 const r=report(d,'مرزیه',{start:day,end:'2026-10-31'},day);assert.equal(r.expense,0);assert.equal(r.due.length,1);assert.equal(r.balances[0][1],1200);
 d.settings.dashboard={'مرزیه':{order:['monthly','balances'],hidden:['recent']}};d.monthlyBudgets['1405-07']={total:500,categories:{},folders:{},warningThreshold:75,exceededThreshold:100};validate(JSON.parse(JSON.stringify(d)));d.monthlyBudgets['1405-07'].warningThreshold=100;assert.throws(()=>validate(d));
});
test('screens render Persian empty and populated states with accessible chart labels',()=>{
 const d=fixture();for(const component of [MonthlyBudgets,UnifiedDashboard,FinancialReports])assert.ok(renderToStaticMarkup(createElement(component,{data:d,viewer:'مرزیه',change:()=>{}})).length>100);
 const html=renderToStaticMarkup(createElement(UnifiedDashboard,{data:d,viewer:'مرزیه',change:()=>{}}));assert.ok(html.includes('aria-label'));assert.ok(html.includes('داشبورد مالی'));
});
test('investment principal and unrealized asset valuation do not create consumption or income',()=>{
 const d=fixture();d.assets.push({id:'asset',name:'دارایی',kind:'other',unit:'واحد',custody:'خانه',quantity:'2',openingQuantity:'2',cost:300,openingCost:300,quote:'250',quoteDate:day,visibility:'shared',owner:'مرزیه'});
 d.transactions=[tx({id:'buy',type:'asset-buy',assetId:'asset',quantity:'1',amount:100,fee:5}),tx({id:'gain',type:'asset-sell',amount:150,costBasis:100,fee:2})];
 const r=report(d,'مرزیه',dateRange('current',day),day);assert.equal(r.expense,7);assert.equal(r.income,0);assert.equal(r.netWorth,1700);assert.deepEqual(r.cash,[['IRT',43]]);
 d.assets[0].quote=undefined;const missing=report(d,'مرزیه',dateRange('current',day),day);assert.equal(missing.missing.length,1);assert.equal(missing.netWorth,1200);
});
test('legacy cash history is reported without replaying it on snapshot account balances',()=>{
 const d=fixture();d.transactions=[tx({legacy:true})];const r=report(d,'مرزیه',dateRange('current',day),day);assert.deepEqual(r.cash,[['IRT',-100]]);assert.equal(r.balances[0][1],1200);
});
