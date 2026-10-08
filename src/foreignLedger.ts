import type { FinanceData, Transaction } from './types';
import type { RateQuote } from './exchangeRates';
import { add, converted, integer, quantityAdd, sum } from './decimal';
import { minorUnits, nativeText } from './currencies';
import { active, allowed, consumption, post, reverse } from './finance';
import { nextDate, periodKey } from './calendar';
export type ForeignInput = { id: string; title: string; merchant: string; currency: string; original: string; date: string; quote: RateQuote; accountId: string; debit: string; fee: string; paymentRate: string; category: string; folderId?: string; note?: string; override?: string; reason?: string; subscription: boolean; frequency?: string; correctsId?: string };
export function foreignTransaction(data: FinanceData, input: ForeignInput, viewer: Transaction['createdBy']): Transaction {
  const a=data.accounts.find(a=>a.id===input.accountId && allowed(a,viewer));
  if(!a || !input.title.trim())throw new Error('عنوان و حساب معتبر لازم است.');
  if(input.folderId&&!data.folders.some(f=>f.id===input.folderId&&!f.archived&&allowed(f,viewer)))throw new Error('پوشه معتبر لازم است.');
  const paymentCurrency=a.currency??'IRT', debitMinor=minorUnits(input.debit,paymentCurrency,data.currencyDefinitions),feeMinor=minorUnits(input.fee||'0',paymentCurrency,data.currencyDefinitions);
  const paymentRate=paymentCurrency==='IRT'?'1':paymentCurrency==='IRR'?'0.1':input.paymentRate;
  const override=input.override?integer(input.override):undefined;
  return {id:input.id,title:input.title.trim(),amount:override??converted(input.original,input.quote.rate),type:'expense',category:input.category,accountId:a.id,date:input.date,createdBy:viewer,visibility:a.visibility,folderId:input.folderId,note:input.note,correctsId:input.correctsId,
    fx:{currency:input.currency,originalAmount:input.original,rate:input.quote.rate,source:input.quote.source,date:input.date,direction:'IRT-per-unit',rounding:'half-up'},
    foreignExpense:{version:1,merchant:input.merchant.trim(),quote:{...input.quote},paymentCurrency,debitMinor,feeMinor,feeToman:converted(nativeText(feeMinor,paymentCurrency,data.currencyDefinitions),paymentRate),paymentRate,convertedOverride:override,overrideReason:input.reason,subscription:input.subscription}};
}
export function recordForeign(data: FinanceData, input: ForeignInput, viewer: Transaction['createdBy']) {
  const existing=data.transactions.find(t=>t.id===input.id);if(existing)return data;
  let base=data;
  if(input.correctsId){const old=data.transactions.find(t=>t.id===input.correctsId&&active(t)&&allowed(t,viewer)&&t.foreignExpense);if(!old||!input.reason?.trim())throw new Error('اصلاح تاریخی به تراکنش فعال و دلیل نیاز دارد.');base=reverse(data,old.id);}
  const t=foreignTransaction(base,input,viewer);let result=post(base,t);
  if(input.correctsId){
    let root=data.transactions.find(t=>t.id===input.correctsId);
    const seen=new Set<string>();
    while(root?.correctsId&&!seen.has(root.id)){seen.add(root.id);root=data.transactions.find(t=>t.id===root!.correctsId);}
    result={...result,recurring:result.recurring.map(r=>r.id===`foreign:${root?.id}`?{...r,name:t.title,amount:t.amount,accountId:t.accountId,category:t.category,foreignCurrency:t.fx!.currency,archived:!input.subscription}:r)};
  }
  if(input.subscription&&!input.correctsId){result={...result,recurring:[{id:`foreign:${input.id}`,name:input.title,amount:t.amount,foreignCurrency:input.currency,frequency:input.frequency??'ماهانه',nextDate:nextDate(input.date,input.frequency??'ماهانه'),category:input.category,owner:viewer,reminder:true,accountId:input.accountId,transactionType:'expense'},...result.recurring]};}
  return result;
}
export function foreignSummary(data: FinanceData, viewer: string, filter='foreign', month='') {
  const rows=data.transactions.filter(t=>active(t)&&allowed(t,viewer)&&t.type==='expense'&&(!month||periodKey(t.date)===month)&&(filter==='all'||(filter==='domestic'?!t.fx||['IRT','IRR'].includes(t.fx.currency):t.fx&&!['IRT','IRR'].includes(t.fx.currency))));
  const group=(key:(t:Transaction)=>string)=>rows.reduce<Record<string,number>>((out,t)=>{const k=key(t);out[k]=add(out[k]??0,consumption(t));return out;},{});
  return {rows,total:sum(rows.map(consumption)),usd:rows.filter(t=>t.fx?.currency==='USD').reduce((s,t)=>quantityAdd(s,t.fx!.originalAmount),'0'),months:group(t=>periodKey(t.date)),merchants:group(t=>t.foreignExpense?.merchant??t.title),categories:group(t=>t.category),subscriptions:rows.filter(t=>t.foreignExpense?.subscription)};
}
