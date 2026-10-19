import type { FinanceData, Installment, Loan, Obligation, ObligationCurrency, Recurring, Transaction } from './types';
import { add, apportion, converted, integer, split, sum } from './decimal';
import { canonicalDay, isoDay, jalaliParts, nextDate, periodKey } from './calendar';
import { active, allowed, post, refreshObligationLoans } from './finance';

const amount = (n: number, zero = false) => integer(String(n), zero);
const day = (d: string) => { if (!isoDay(d)) throw new Error('تاریخ کامل شمسی لازم است.'); };
const currencies = ['IRT', 'IRR', 'USD'];
function account(data: FinanceData, id: string, viewer: string) {
  if (!data.accounts.some(a=>a.id===id && allowed(a,viewer))) throw new Error('حساب معتبر و قابل مشاهده انتخاب کن.');
}
export function reminders(input: string): number[] {
  if (!input.trim()) return [];
  return [...new Set(input.split(/[,،]/).map(s=>integer(s.trim(),true)))].sort((a,b)=>b-a);
}
function common(data: FinanceData, row: { name: string; amount: number; currency?: ObligationCurrency; accountId?: string; reminderDays?: number[] }, viewer: string) {
  if (!row.name.trim() || !currencies.includes(row.currency??'IRT')) throw new Error('عنوان و ارز معتبر لازم است.');
  amount(row.amount); account(data,row.accountId??'',viewer);
  row.reminderDays?.forEach(n=>{amount(n,true);if(n>3650)throw new Error('فاصله یادآور حداکثر ۳۶۵۰ روز است.');});
}
export function saveCheck(data: FinanceData, row: Obligation, viewer: string): FinanceData {
  common(data,row,viewer); day(row.date);
  if (!allowed(row,viewer) || !['pay','receive'].includes(row.direction) || !row.bank?.trim() || !row.counterparty?.trim()) throw new Error('نوع چک، بانک و طرف چک را تکمیل کن.');
  const previous = data.obligations.find(o=>o.id===row.id);
  if (previous && (previous.status!=='pending' || !allowed(previous,viewer))) throw new Error('ویرایش فقط برای چک در انتظار مجاز است.');
  if(previous&&previous.transactionId)throw new Error('سابقه تسویه قابل بازنویسی نیست.');
  return {...data,obligations:previous?data.obligations.map(o=>o.id===row.id?{...row,status:'pending',transactionId:undefined}:o):[...data.obligations,{...row,status:'pending',transactionId:undefined}]};
}
export function setCheckStatus(data: FinanceData, id: string, status: 'canceled'|'bounced'|'pending', viewer: string): FinanceData {
  const row=data.obligations.find(o=>o.id===id);
  if (!row || !allowed(row,viewer) || row.status==='cleared') throw new Error('ابتدا تراکنش تسویه را از تاریخچه برگشت بده.');
  return {...data,obligations:data.obligations.map(o=>o.id===id?{...o,status}:o)};
}
export type Settlement = { requestId: string; date: string; accountId: string; existingId?: string; value?: number; rate?: string; principal?: number; interest?: number; fees?: number };
function nativeTransaction(data: FinanceData, currency: ObligationCurrency, value: number, opts: Settlement, creator: Transaction['createdBy'], incoming: boolean): Pick<Transaction,'amount'|'fx'> {
  day(opts.date); account(data,opts.accountId,creator); amount(value);
  if (currency==='IRT') return {amount:value};
  const rate=currency==='IRR'?'0.1':opts.rate;
  if (!rate) throw new Error('نرخ صریح تومان به ازای یک واحد ارز لازم است.');
  if(converted('1000000',rate)<=0)throw new Error('نرخ ارز باید مثبت باشد.');
  const cash=converted(String(value),rate); amount(cash);
  void incoming;
  return {amount:cash,fx:{currency,originalAmount:String(value),rate,source:'نرخ ثبت‌شده توسط کاربر',date:opts.date,direction:'IRT-per-unit',rounding:'half-up'}};
}
function linkOrPost(data: FinanceData, tx: Transaction, opts: Settlement, viewer: string): FinanceData {
  if (!opts.existingId) { if(data.transactions.some(t=>t.id===tx.id&&!active(t))) throw new Error('این درخواست قبلاً برگشت شده است؛ فرم جدید باز کن.'); return post(data,tx); }
  const old=data.transactions.find(t=>t.id===opts.existingId);
  if (!old || !active(old) || !allowed(old,viewer) || old.type!==tx.type || old.amount!==tx.amount || old.accountId!==tx.accountId || old.toAccountId!==tx.toAccountId || old.loanId || old.assetId || old.goalId || old.obligationId || old.occurrenceKey || old.paymentAllocation || old.fee) throw new Error('تراکنش انتخابی باید آزاد، هم‌جهت، هم‌مبلغ و متعلق به همین حساب باشد.');
  if ((old.fx?.currency??'IRT')!==(tx.fx?.currency??'IRT') || old.fx?.originalAmount!==tx.fx?.originalAmount || old.fx?.rate!==tx.fx?.rate) throw new Error('مبلغ و نرخ تاریخی تراکنش با تعهد سازگار نیست.');
  return refreshObligationLoans({...data,transactions:data.transactions.map(t=>t.id===old.id?{...t,obligationId:tx.obligationId,occurrenceKey:tx.occurrenceKey,paymentAllocation:tx.paymentAllocation}:t)});
}
export function settleCheck(data: FinanceData, id: string, opts: Settlement, creator: Transaction['createdBy']): FinanceData {
  const row=data.obligations.find(o=>o.id===id);
  if (!row || !allowed(row,creator)) throw new Error('چک معتبر نیست.');
  if (row.status==='cleared') return data;
  if (row.status!=='pending') throw new Error('چک فعال نیست.');
  const native=nativeTransaction(data,row.currency??'IRT',row.amount,opts,creator,row.direction==='receive');
  const tx: Transaction={id:`check:${id}:${opts.requestId}`,title:row.name,...native,type:row.direction==='receive'?'income':'expense',category:row.category,accountId:opts.accountId,date:opts.date,createdBy:creator,visibility:row.visibility,obligationId:id};
  const result=linkOrPost(data,tx,opts,creator);
  return {...result,obligations:result.obligations.map(o=>o.id===id?{...o,status:'cleared',transactionId:opts.existingId??tx.id}:o)};
}
export function createLoan(data: FinanceData, loan: Loan, custom: Installment[]|undefined, viewer: Transaction['createdBy']): FinanceData {
  common(data,{...loan,amount:loan.principalTotal??0},viewer); day(loan.startDate??''); day(loan.repaymentStartDate??'');
  if (!['borrow','lend'].includes(loan.direction??'') || !Number.isInteger(loan.count) || loan.count<1 || loan.count>1200 || data.loans.some(l=>l.id===loan.id)) throw new Error('جهت و تعداد اقساط معتبر لازم است.');
  amount(loan.upfrontFee??0,true); amount(loan.interestTotal??0,true); amount(loan.feesTotal??0,true);
  if (loan.repaymentStartDate! < loan.startDate!) throw new Error('شروع بازپرداخت قبل از شروع وام است.');
  const principal=split(loan.principalTotal!,loan.count), interest=split(loan.interestTotal??0,loan.count), fees=split(loan.feesTotal??0,loan.count);
  let date=loan.repaymentStartDate!;
  const anchor=jalaliParts(date).day;
  const schedule=custom??principal.map((p,index)=>{if(index)date=nextDate(date,loan.frequency,anchor);return {id:`${loan.id}:${index}`,loanId:loan.id,index,principal:p,interest:interest[index],fees:fees[index],amount:sum([p,interest[index],fees[index]]),date,settled:false};});
  validateSchedule(loan,schedule);
  return refreshObligationLoans({...data,loans:[{...loan,managed:true,paid:0,total:sum(schedule.map(i=>i.amount)),owner:viewer,visibility:data.accounts.find(a=>a.id===loan.accountId)!.visibility},...data.loans],installments:[...data.installments,...schedule]});
}
function validateSchedule(loan: Loan, rows: Installment[]) {
  if (rows.length!==loan.count || new Set(rows.map(i=>i.id)).size!==rows.length || new Set(rows.map(i=>i.index)).size!==rows.length || rows.some(i=>!Number.isInteger(i.index)||i.index<0||i.index>=loan.count)) throw new Error('تعداد یا شناسه اقساط نادرست است.');
  for(const i of rows){day(i.date); amount(i.amount); amount(i.principal??0,true);amount(i.interest??0,true);amount(i.fees??0,true);if(i.loanId!==loan.id || i.amount!==sum([i.principal??0,i.interest??0,i.fees??0]) || i.date<loan.startDate!)throw new Error('جمع اصل، سود و کارمزد هر قسط یا تاریخ معتبر نیست.');}
  if(sum(rows.map(i=>i.principal??0))!==loan.principalTotal || sum(rows.map(i=>i.interest??0))!==(loan.interestTotal??0) || sum(rows.map(i=>i.fees??0))!==(loan.feesTotal??0))throw new Error('جمع برنامه باید با اصل، سود و کارمزد قراردادی برابر باشد.');
}
export function adjustInstallment(data: FinanceData, row: Installment, viewer: string): FinanceData {
  const loan=data.loans.find(l=>l.id===row.loanId&&l.managed&&!l.archived);
  const old=data.installments.find(i=>i.id===row.id);
  if (!loan || !old || !allowed(loan as Loan & {visibility:string},viewer))throw new Error('وام معتبر نیست.');
  if ((old.paidAmount??0)>0 && (row.principal!==old.principal || row.interest!==old.interest || row.fees!==old.fees || row.date!==old.date))throw new Error('قسط دارای سابقه پرداخت قابل تغییر نیست.');
  const rows=data.installments.map(i=>i.id===row.id?{...old,principal:row.principal,interest:row.interest,fees:row.fees,amount:row.amount,date:row.date}:i);
  // Manual adjustment explicitly updates contractual totals, never the posted allocations.
  const schedule=rows.filter(i=>i.loanId===loan.id);
  const updated={...loan,principalTotal:sum(schedule.map(i=>i.principal??0)),interestTotal:sum(schedule.map(i=>i.interest??0)),feesTotal:sum(schedule.map(i=>i.fees??0)),total:sum(schedule.map(i=>i.amount)),calculation:'manual' as const};
  validateSchedule(updated,schedule);
  return refreshObligationLoans({...data,loans:data.loans.map(l=>l.id===loan.id?updated:l),installments:rows});
}
// Preserve the contract and posted history; distribute changes over untouched future rows.
export function resizeInstallment(data: FinanceData, id: string, value: number, date: string, viewer: string): FinanceData {
  const old=data.installments.find(i=>i.id===id);
  const loan=data.loans.find(l=>l.id===old?.loanId&&l.managed&&!l.archived&&!l.canceled);
  if(!old||!loan||!allowed(loan as Loan & {visibility:string},viewer))throw new Error('وام معتبر نیست.');
  amount(value); day(date);
  if(old.settled||old.paidAmount||data.transactions.some(t=>t.paymentAllocation?.installmentId===id))throw new Error('قسط دارای سابقه پرداخت قابل تغییر نیست.');
  const editable=data.installments.filter(i=>i.loanId===loan.id&&(i.id===id||!i.amountAdjusted&&!i.settled&&!i.paidAmount&&!data.transactions.some(t=>t.paymentAllocation?.installmentId===i.id))).sort((a,b)=>a.index-b.index);
  const others=editable.filter(i=>i.id!==id),total=sum(editable.map(i=>i.amount)),rest=add(total,-value);
  if(rest<others.length||(!others.length&&rest!==0))throw new Error('مبلغ قسط باید در مجموع ثابت قرارداد جا بگیرد و برای سایر اقساط مبلغ مثبت باقی بگذارد.');
  const equal=others.length?split(rest,others.length):[];
  const amounts=editable.map(i=>i.id===id?value:equal[others.findIndex(o=>o.id===i.id)]);
  const principal=apportion(sum(editable.map(i=>i.principal??0)),amounts);
  const residual=amounts.map((n,index)=>add(n,-principal[index]));
  const interestTotal=sum(editable.map(i=>i.interest??0));
  const interest=sum(residual)?apportion(interestTotal,residual):residual;
  const rows=data.installments.map(i=>{
    const index=editable.findIndex(e=>e.id===i.id);
    return index<0?i:{...i,amount:amounts[index],principal:principal[index],interest:interest[index],fees:residual[index]-interest[index],date:i.id===id?date:i.date,amountAdjusted:i.id===id?true:i.amountAdjusted};
  });
  validateSchedule(loan,rows.filter(i=>i.loanId===loan.id));
  return refreshObligationLoans({...data,installments:rows});
}
export function installmentPaymentParts(row: Installment, value: number) {
  amount(value);
  const remaining=[add(row.principal??0,-(row.principalPaid??0)),add(row.interest??0,-(row.interestPaid??0)),add(row.fees??0,-(row.feesPaid??0))];
  if(value>sum(remaining))throw new Error('پرداخت بیش از مانده قسط است.');
  const parts=apportion(value,remaining);
  return {principal:parts[0],interest:parts[1],fees:parts[2]};
}
export function settleInstallment(data: FinanceData, id: string, opts: Settlement, creator: Transaction['createdBy']): FinanceData {
  if(data.transactions.some(t=>t.id===`installment:${id}:${opts.requestId}` || active(t)&&opts.existingId===t.id&&t.paymentAllocation?.installmentId===id))return data;
  const row=data.installments.find(i=>i.id===id),loan=data.loans.find(l=>l.id===row?.loanId&&l.managed&&!l.archived&&!l.canceled);
  if(!row || !loan || !allowed(loan as Loan & {visibility:string},creator) || row.settled)throw new Error('قسط فعال نیست.');
  const p=amount(opts.principal??0,true),i=amount(opts.interest??0,true),f=amount(opts.fees??0,true),value=sum([p,i,f]); amount(value);
  if(p>add(row.principal??0,-(row.principalPaid??0)) || i>add(row.interest??0,-(row.interestPaid??0)) || f>add(row.fees??0,-(row.feesPaid??0)))throw new Error('پرداخت بیش از باقی‌مانده اصل، سود یا کارمزد است.');
  const currency=loan.currency??'IRT',native=nativeTransaction(data,currency,value,opts,creator,loan.direction==='lend');
  const expense=loan.direction==='lend'?0:currency==='IRT'?sum([i,f]):converted(String(sum([i,f])),native.fx!.rate);
  const tx:Transaction={id:`installment:${id}:${opts.requestId}`,title:`قسط ${loan.name}`,type:loan.direction==='lend'?'income':'expense',...native,category:'اقساط',accountId:opts.accountId,date:opts.date,createdBy:creator,visibility:loan.visibility??'private',paymentAllocation:{loanId:loan.id,installmentId:id,principal:p,interest:i,fees:f,nativeAmount:value,currency,expense}};
  return linkOrPost(data,tx,opts,creator);
}
export function saveRecurring(data: FinanceData, row: Recurring, viewer: string): FinanceData {
  common(data,row,viewer);day(row.startDate??'');day(row.nextDate);if(row.endDate)day(row.endDate);
  if(row.owner!==viewer || row.endDate && row.endDate<row.startDate! || row.nextDate<row.startDate!)throw new Error('بازه پرداخت معتبر نیست.');
  if(!['ماهانه','هفتگی','سالانه','سفارشی'].includes(row.frequency))throw new Error('تکرار معتبر نیست.');
  if(row.frequency==='سفارشی' && (!row.customDays || row.customDays>3650))throw new Error('فاصله سفارشی را به روز وارد کن.');
  if(row.customDays)amount(row.customDays);
  const old=data.recurring.find(r=>r.id===row.id);if(old&&old.owner!==viewer)throw new Error('الگو قابل ویرایش نیست.');
  if(old&&data.transactions.some(t=>active(t)&&t.occurrenceKey?.startsWith(`${row.id}:`))&&(old.currency??'IRT')!==(row.currency??'IRT'))throw new Error('ارز الگوی دارای سابقه تغییر نمی‌کند؛ الگوی جدید بساز.');
  return {...data,recurring:old?data.recurring.map(r=>r.id===row.id?row:r):[...data.recurring,row]};
}
export function deleteRecurring(data: FinanceData, id: string, viewer: string): FinanceData {
  const row = data.recurring.find(r => r.id === id);
  if (!row || row.owner !== viewer) throw new Error('الگو قابل حذف نیست.');
  return { ...data, recurring: data.recurring.filter(r => r.id !== id) };
}
export function settleRecurring(data: FinanceData, id: string, due: string, opts: Settlement, creator: Transaction['createdBy']): FinanceData {
  const key=`${id}:${due}`;if(data.transactions.some(t=>active(t)&&t.occurrenceKey===key))return data;
  const row=data.recurring.find(r=>r.id===id&&!r.archived&&r.owner===creator);
  if(!row || row.nextDate!==due || row.endDate&&due>row.endDate)throw new Error('سررسید فعال نیست.');
  if (row.foreignCurrency) throw new Error('اشتراک ارزی را از ماژول هزینه‌های ارزی با مبلغ اصلی و نرخ روز خرید ثبت کن؛ سپس سررسید یادآور را تغییر بده.');
  if (!row.transactionType)throw new Error('نوع رویداد و ارز الگوی قدیمی را ابتدا تکمیل کن.');
  if (row.transactionType!=='expense'&&(row.currency??'IRT')!=='IRT')throw new Error('رویداد غیرهزینه ارزی را با نرخ و حساب‌های صریح ثبت کن.');
  day(due); if(row.frequency==='سفارشی')amount(row.customDays??0); const native=nativeTransaction(data,row.currency??'IRT',opts.value??row.amount,opts,creator,false);
  const tx:Transaction={id:`recurring:${key}:${opts.requestId}`,title:row.name,type:row.transactionType,...native,toAccountId:row.transactionType==='transfer'?row.toAccountId:undefined,goalId:row.transactionType==='saving'?row.goalId:undefined,allocationOnly:row.transactionType==='saving',goalWithdrawal:row.goalWithdrawal,category:row.category,accountId:opts.accountId,date:opts.date,createdBy:creator,visibility:data.accounts.find(a=>a.id===opts.accountId)!.visibility,occurrenceKey:key};
  const next=row.frequency==='سفارشی'?new Date(Date.parse(`${due}T12:00:00Z`)+row.customDays!*86400000).toISOString().slice(0,10):nextDate(due,row.frequency,row.anchorDay);
  const result=linkOrPost(data,tx,opts,creator);
  return {...result,recurring:result.recurring.map(r=>r.id===id?{...r,nextDate:next}:r)};
}
export type DueItem={id:string;name:string;date:string;amount:number;currency:ObligationCurrency;kind:'check'|'installment'|'recurring';direction:'pay'|'receive';reminderDays:number[]};
export function dueItems(data: FinanceData, viewer: string, horizon = nextDate(canonicalDay(new Date()),'سالانه')): DueItem[] {
  const checks:DueItem[]=data.obligations.filter(o=>o.status==='pending'&&allowed(o,viewer)).map(o=>({...o,kind:'check',currency:o.currency??'IRT',reminderDays:o.reminderDays??[]}));
  const loans:DueItem[]=data.installments.filter(i=>!i.settled&&isoDay(i.date)).flatMap(i=>{const l=data.loans.find(l=>l.id===i.loanId&&!l.canceled&&!l.archived);return l&&(l.visibility?allowed(l as Loan & {visibility:string},viewer):true)?[{id:i.id,name:l.name,date:i.date,amount:add(i.amount,-(i.paidAmount??0)),currency:l.currency??'IRT',kind:'installment' as const,direction:l.direction==='lend'?'receive' as const:'pay' as const,reminderDays:l.reminderDays??[]}]:[];});
  const recurring:DueItem[]=data.recurring.filter(r=>!r.archived&&r.owner===viewer&&isoDay(r.nextDate)).flatMap(r=>{
    const rows:DueItem[]=[];let date=r.nextDate;
    for(let count=0;count<1200&&date<=horizon&&(!r.endDate||date<=r.endDate);count++){
      if(!data.transactions.some(t=>active(t)&&t.occurrenceKey===`${r.id}:${date}`))rows.push({id:`${r.id}:${date}`,name:r.name,date,amount:r.amount,currency:r.currency??'IRT',kind:'recurring',direction:r.transactionType==='income'?'receive':'pay',reminderDays:r.reminderDays??[]});
      try { const following=r.frequency==='سفارشی'&&r.customDays?new Date(Date.parse(`${date}T12:00:00Z`)+r.customDays*86400000).toISOString().slice(0,10):nextDate(date,r.frequency,r.anchorDay);if(following<=date)break;date=following; } catch { break; }
    }
    return rows;
  });
  return [...checks,...loans,...recurring].sort((a,b)=>a.date.localeCompare(b.date));
}
export function totals(rows: DueItem[], date: string) {
  const group=(list:DueItem[])=>Object.fromEntries(currencies.map(c=>[c,sum(list.filter(r=>r.currency===c&&r.direction==='pay').map(r=>r.amount))]));
  return {outstanding:group(rows.filter(r=>r.kind!=='recurring')),month:group(rows.filter(r=>periodKey(r.date)===periodKey(date))),overdue:group(rows.filter(r=>r.date<date))};
}
export function validateObligations(data: FinanceData) {
  for(const o of data.obligations){if(o.currency&&!currencies.includes(o.currency))throw new Error('ارز چک معتبر نیست.');o.reminderDays?.forEach(n=>amount(n,true));}
  for(const l of data.loans.filter(l=>l.managed)){
    amount(l.upfrontFee??0,true);
    common(data,{...l,amount:l.principalTotal??0},l.owner??'');day(l.startDate??'');day(l.repaymentStartDate??'');
    validateSchedule(l,data.installments.filter(i=>i.loanId===l.id));
  }
  for(const r of data.recurring.filter(r=>r.startDate)){common(data,r,r.owner);day(r.startDate!);day(r.nextDate);if(r.endDate)day(r.endDate);if(r.frequency==='سفارشی')amount(r.customDays??0);}
  const refreshed=refreshObligationLoans(data);
  for(const l of data.loans.filter(l=>l.managed)){const expected=refreshed.loans.find(x=>x.id===l.id)!;if(l.paid!==expected.paid||l.principalRemaining!==expected.principalRemaining||l.nextDate!==expected.nextDate||l.installment!==expected.installment||l.total!==sum(data.installments.filter(i=>i.loanId===l.id).map(i=>i.amount)))throw new Error('مانده وام با سابقه پرداخت سازگار نیست.');}
  for(const i of data.installments.filter(i=>data.loans.some(l=>l.id===i.loanId&&l.managed))){const expected=refreshed.installments.find(x=>x.id===i.id)!;if(i.paidAmount!==expected.paidAmount||i.principalPaid!==expected.principalPaid||i.interestPaid!==expected.interestPaid||i.feesPaid!==expected.feesPaid||i.settled!==expected.settled||i.paidAmount!>i.amount||i.principalPaid!>i.principal!||i.interestPaid!>(i.interest??0)||i.feesPaid!>(i.fees??0))throw new Error('سابقه پرداخت با برنامه اقساط سازگار نیست.');}
  for(const t of data.transactions.filter(t=>t.paymentAllocation)){
    const a=t.paymentAllocation!,l=data.loans.find(l=>l.id===a.loanId&&l.managed);
    if(!l||!data.installments.some(i=>i.id===a.installmentId&&i.loanId===a.loanId)||a.nativeAmount!==sum([a.principal,a.interest,a.fees])||a.currency!==(l.currency??'IRT')||t.type!==(l.direction==='lend'?'income':'expense'))throw new Error('ارتباط پرداخت قسط معتبر نیست.');
    [a.principal,a.interest,a.fees,a.expense].forEach(n=>amount(n,true));
    const expense=l.direction==='lend'?0:t.fx?converted(String(sum([a.interest,a.fees])),t.fx.rate):sum([a.interest,a.fees]);
    if(a.expense!==expense||(t.fx?converted(String(a.nativeAmount),t.fx.rate):a.nativeAmount)!==t.amount||(t.fx?.currency??'IRT')!==a.currency)throw new Error('مبلغ پرداخت قسط ناسازگار است.');
  }
  for(const o of data.obligations.filter(o=>o.status==='cleared'))if(!data.transactions.some(t=>t.id===o.transactionId&&t.obligationId===o.id&&active(t)))throw new Error('چک تسویه‌شده باید به پرداخت فعال مرتبط باشد.');
}
