import type { FinanceData, Transaction } from './types';
import { active, allowed, consumption, earnedIncome, remainingLoan, transactionCashDelta } from './finance';
import { add, converted, sum } from './decimal';
import { fromJalali, isoDay, jalaliParts, periodKey } from './calendar';
import { dueItems } from './obligations';
import { persianDate } from './utils';
export type ReportFilter = { start: string; end: string; category?: string; account?: string; folder?: string; currency?: string };
export function dateRange(preset: string, day: string): ReportFilter {
 const p=jalaliParts(day); let y=p.year,m=p.month;
 if(preset==='previous'){m--;if(!m){m=12;y--;}}
 if(preset==='three'){m-=2; if(m<1){m+=12;y--;}}
 if(preset==='year')m=1;
 const start=fromJalali(`${y}/${m}/1`);
 const end=preset==='previous'?new Date(Date.parse(fromJalali(`${p.year}/${p.month}/1`)+'T12:00:00Z')-86400000).toISOString().slice(0,10):day;
 return {start,end};
}
export const eventCurrency=(t:Transaction)=>t.fx?.currency??'IRT';
export function report(data:FinanceData,viewer:string,filter:ReportFilter,day:string){
 const seen=new Set<string>();
 const transactions=data.transactions.filter(t=>{
  const key=t.occurrenceKey??t.id;
  if(!active(t)||!allowed(t,viewer)||!isoDay(t.date)||t.date>day||seen.has(key))return false;
  seen.add(key);
  return t.date>=filter.start&&t.date<=filter.end&&(!filter.category||t.category===filter.category)&&(!filter.account||t.accountId===filter.account||t.toAccountId===filter.account)&&(!filter.folder||t.folderId===filter.folder)&&(!filter.currency||eventCurrency(t)===filter.currency);
 }).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 const group=(key:(t:Transaction)=>string,amount:(t:Transaction)=>number)=>{const result=new Map<string,number>();transactions.forEach(t=>{const n=amount(t);if(n)result.set(key(t),add(result.get(key(t))??0,n));});return [...result].sort((a,b)=>b[1]-a[1]);};
 // Reuse the ledger's native effects; legacy snapshot history is reported, never replayed onto balances.
 const cashByCurrency=new Map<string,number>();
 transactions.forEach(t=>data.accounts.filter(a=>!filter.account||a.id===filter.account).forEach(a=>{const delta=transactionCashDelta(t,a.id);if(delta){const c=a.currency??'IRT';cashByCurrency.set(c,add(cashByCurrency.get(c)??0,delta));}}));
 const accounts=data.accounts.filter(a=>allowed(a,viewer)&&(!filter.account||a.id===filter.account)&&(!filter.currency||(a.currency??'IRT')===filter.currency));
 const balances=new Map<string,number>();accounts.forEach(a=>{const c=a.currency??'IRT';balances.set(c,add(balances.get(c)??0,a.balance));});
 const goals=data.goals.filter(g=>allowed(g,viewer));const assets=data.assets.filter(a=>allowed(a,viewer));
 const loans=data.loans.filter(l=>!l.canceled&&(l.visibility?allowed({...l,visibility:l.visibility},viewer):true));
 const missing=[...assets.filter(a=>!a.quote).map(a=>`قیمت ${a.name}`),...accounts.filter(a=>(a.currency??'IRT')!=='IRT').map(a=>`ارزش تومانی ${a.name}`),...loans.filter(l=>remainingLoan(data,l)>0&&(l.principalRemaining===undefined||(l.currency??'IRT')!=='IRT')).map(l=>`اصل / ارزش ${l.name}`)];
 const allocation=[...balances].filter(([c])=>c==='IRT').map(([,n])=>['حساب‌های تومانی',n] as [string,number]).concat(assets.filter(a=>a.quote).map(a=>[a.name,converted(a.quantity,a.quote!)] as [string,number]));
 const netWorth=sum([...allocation.map(([,n])=>n),...loans.map(l=>(l.currency??'IRT')==='IRT'?(l.direction==='lend'?1:-1)*(l.principalRemaining??0):0)]);
 const due=dueItems(data,viewer,filter.end).filter(o=>o.date>=filter.start&&o.date<=filter.end&&(!filter.category||data.obligations.some(x=>x.id===o.id&&x.category===filter.category)||data.recurring.some(x=>o.id.startsWith(x.id+':')&&x.category===filter.category))&&!filter.folder&&(!filter.account||data.obligations.some(x=>x.id===o.id&&x.accountId===filter.account)||data.loans.some(l=>data.installments.some(i=>i.id===o.id&&i.loanId===l.id)&&l.accountId===filter.account)||data.recurring.some(r=>o.id.startsWith(r.id+':')&&r.accountId===filter.account))&&(!filter.currency||o.currency===filter.currency));
 const monthKeys=new Set(transactions.map(t=>periodKey(t.date)));
 if(isoDay(filter.start)&&isoDay(filter.end)&&filter.start<=filter.end&&Number(filter.end.slice(0,4))-Number(filter.start.slice(0,4))<=10){let cursor=filter.start;for(let count=0;count<3600&&cursor<=filter.end;count++){monthKeys.add(periodKey(cursor));const p=jalaliParts(cursor);cursor=fromJalali(`${p.month===12?p.year+1:p.year}/${p.month===12?1:p.month+1}/1`);}}
 const months=[...monthKeys].sort().map(month=>({month,income:sum(transactions.filter(t=>periodKey(t.date)===month).map(earnedIncome)),expense:sum(transactions.filter(t=>periodKey(t.date)===month).map(consumption)),saving:sum(transactions.filter(t=>periodKey(t.date)===month&&t.type==='saving').map(t=>t.goalWithdrawal?-t.amount:t.amount))}));
 return {transactions,income:sum(transactions.map(earnedIncome)),expense:sum(transactions.map(consumption)),saving:sum(transactions.filter(t=>t.type==='saving').map(t=>t.goalWithdrawal?-t.amount:t.amount)),cash:[...cashByCurrency],balances:[...balances],goals,categories:group(t=>t.category,consumption),folderIds:group(t=>t.folderId??'',consumption),folders:group(t=>data.folders.find(f=>f.id===t.folderId)?.name??'بدون پوشه',consumption),foreign:group(eventCurrency,t=>t.fx&&!['IRT','IRR'].includes(t.fx.currency)?consumption(t):0),recurring:group(t=>t.occurrenceKey?.split(':')[0]??(t.foreignExpense?.subscription?t.title:''),t=>t.occurrenceKey||t.foreignExpense?.subscription?consumption(t):0),months,due,allocation,netWorth,missing};
}
export function budgetUsage(limit:number,spent:number,warning=80,exceeded=100){const percentage=limit?spent/limit*100:0;return {limit,spent,remaining:add(limit,-spent),percentage,state:!limit?'unset':percentage>=exceeded?'exceeded':percentage>=warning?'warning':'normal'};}
export function csv(rows:(string|number)[][]){return '\uFEFF'+rows.map(row=>row.map(value=>{const s=String(value);return '"'+(/^[=+@\-\t\r]/.test(s)?"'":'')+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
export function transactionRows(result:ReturnType<typeof report>){return [['شناسه','عنوان','تاریخ شمسی','نوع','مبلغ تومان','هزینه مصرفی تومان','درآمد تومان','ارز اصلی','مبلغ اصلی'],...result.transactions.map(t=>[t.id,t.title,persianDate(t.date),t.type,t.amount,consumption(t),earnedIncome(t),eventCurrency(t),t.fx?.originalAmount??t.amount])];}
