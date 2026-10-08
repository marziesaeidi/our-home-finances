import type { FinanceData, Transaction, Loan, Installment } from './types';
import { add, apportion, converted, decimal, integer, multiply, pricePerUnit, proportional, quantityAdd, split, sum } from './decimal';
import { canonicalDay, isoDay, jalaliParts, nextDate } from './calendar';

export const active = (t: Transaction) => t.status !== 'reversed';
export const allowed = (x: { visibility: string; owner?: string; createdBy?: string }, viewer: string) => x.visibility === 'shared' || (x.owner ?? x.createdBy) === viewer;
export const earnedIncome = (t: Transaction) => active(t) && t.type === 'income' ? t.paymentAllocation ? add(t.amount,-(t.fx ? converted(String(t.paymentAllocation.principal),t.fx.rate) : t.paymentAllocation.principal)) : t.amount : 0;
export const consumption = (t: Transaction) => active(t) ? t.paymentAllocation ? t.paymentAllocation.expense : t.type === 'expense' ? t.amount : t.type === 'loan-payment' ? sum([t.interest ?? 0, t.fee ?? 0]) : t.type === 'asset-buy' || t.type === 'asset-sell' ? t.fee ?? 0 : 0 : 0;
export const remainingLoan = (data: FinanceData, loan: Loan) => {
  if (loan.canceled) return 0;
  const schedule = data.installments.filter(i => i.loanId === loan.id && !i.settled);
  return data.installments.some(i => i.loanId === loan.id) ? sum(schedule.map(i => add(i.amount,-(i.paidAmount??0)))) : multiply(loan.count - loan.paid, loan.installment);
};
export function scheduleLoan(loan: Loan): Installment[] {
  if (!isoDay(loan.nextDate)) return [];
  const amounts = loan.legacy ? Array.from({ length: loan.count }, () => loan.installment) : split(loan.total, loan.count), principals = loan.principalTotal === undefined ? undefined : apportion(loan.principalTotal, amounts);
  let date = loan.nextDate;
  const anchor = jalaliParts(date).day;
  return amounts.map((amount, index) => {
    if (index > loan.paid && loan.frequency !== 'سفارشی') date = nextDate(date, loan.frequency, anchor);
    return { id: `${loan.id}:${index}`, loanId: loan.id, index, amount, principal: principals?.[index], interest: principals ? add(amount, -principals[index]) : undefined, date: index < loan.paid ? '' : date, settled: index < loan.paid, legacy: index < loan.paid };
  });
}
export function registerLoan(data: FinanceData, loan: Loan, date: string, creator: Transaction['createdBy']): FinanceData {
  if (!isoDay(loan.nextDate) || loan.total < loan.count || loan.paid < 0 || loan.paid > loan.count) throw new Error('مبلغ، تعداد اقساط و تاریخ وام معتبر نیست.');
  const installments = scheduleLoan(loan);
  const borrowing = !!loan.disbursementAccountId;
  if (borrowing && (loan.paid !== 0 || !loan.principalTotal)) throw new Error('برای دریافت وام جدید، اصل وام را تعیین کن و تعداد پرداخت‌شده را صفر بگذار.');
  const updated = { ...loan, principalRemaining: loan.principalTotal === undefined ? undefined : borrowing ? 0 : sum(installments.filter(i => !i.settled).map(i => i.principal ?? 0)) };
  let result: FinanceData = { ...data, loans: [updated, ...data.loans], installments: [...data.installments, ...installments] };
  if (borrowing) result = post(result, { id: `loan-receipt:${loan.id}`, title: `دریافت ${loan.name}`, amount: loan.principalTotal!, type: 'loan-receipt', category: 'وام', accountId: loan.disbursementAccountId!, loanId: loan.id, date, createdBy: creator, visibility: data.accounts.find(a => a.id === loan.disbursementAccountId)?.visibility ?? 'private' });
  return result;
}
function effects(data: FinanceData, t: Transaction, direction: 1 | -1): FinanceData {
  const inflow = ['income', 'asset-sell', 'loan-receipt'].includes(t.type);
  const cash = t.allocationOnly ? 0 : add(t.amount, inflow ? -(t.fee ?? 0) : t.type === 'loan-payment' ? 0 : t.fee ?? 0);
  const entries = data.accounts.flatMap(a => {
    const delta = a.id === t.accountId ? direction * (inflow ? cash : -cash) : a.id === t.toAccountId ? direction * t.amount : 0;
    return delta ? [{ id: `${t.id}:${direction}:${a.id}:${data.accountEntries.length}`, transactionId: t.id, accountId: a.id, delta, operation: direction === 1 ? 'post' as const : 'reverse' as const, at: new Date().toISOString() }] : [];
  });
  const accountEntries = [...data.accountEntries, ...entries];
  const accounts = data.accounts.map(a => ({ ...a, balance: sum([a.openingBalance ?? a.balance, ...accountEntries.filter(e => e.accountId === a.id).map(e => e.delta)]) }));
  const goals = data.goals.map(g => g.id === t.goalId ? { ...g, saved: add(g.saved, direction * (t.goalWithdrawal ? -t.amount : t.amount)) } : g);
  const loans = data.loans.map(l => l.id === t.loanId ? {
    ...l, paid: add(l.paid, t.type === 'loan-receipt' ? 0 : direction),
    principalRemaining: l.principalRemaining === undefined ? undefined : add(l.principalRemaining, direction * (t.type === 'loan-receipt' ? t.amount : -(t.principal ?? 0)))
  } : l);
  const installments = data.installments.map(i => i.id === t.installmentId ? { ...i, settled: direction === 1, transactionId: direction === 1 ? t.id : undefined } : i);
  const scheduledLoans = loans.map(l => {
    const next = installments.find(i => i.loanId === l.id && !i.settled);
    return next ? { ...l, nextDate: next.date, installment: next.amount } : l;
  });
  const assets = data.assets.map(a => {
    if (a.id !== t.assetId || !t.quantity) return a;
    const buying = t.type === 'asset-buy';
    return { ...a, quantity: quantityAdd(a.quantity, t.quantity, buying ? direction === -1 : direction === 1), cost: add(a.cost, direction * (buying ? t.amount : -(t.costBasis ?? 0))) };
  });
  return refreshObligationLoans({ ...data, accounts, accountEntries, goals, loans: scheduledLoans, installments, assets }, direction === 1 ? [t,...data.transactions] : data.transactions.filter(x=>x.id!==t.id));
}
export function post(data: FinanceData, transaction: Transaction, financialDay = canonicalDay(new Date())): FinanceData {
  if (data.transactions.some(t => t.id === transaction.id || active(t) && transaction.occurrenceKey && t.occurrenceKey === transaction.occurrenceKey)) return data;
  const category = data.categoryRecords.find(c=>c.name===transaction.category) ?? { id: `category:${crypto.randomUUID()}`, name: transaction.category, archived: false };
  const categoryRecords = data.categoryRecords.some(c=>c.id===category.id) ? data.categoryRecords : [...data.categoryRecords,category];
  const t = { ...transaction, categoryId: category.id, currency: 'IRT' as const, status: 'posted' as const, legacy: false };
  integer(String(t.amount));
  integer(String(t.fee ?? 0), true);
  if (t.allocationOnly && !['saving','asset-buy','asset-sell'].includes(t.type)) throw new Error('ثبت بدون حرکت وجه نقد فقط برای تخصیص یا اصلاح دارایی است.');
  if (t.allocationOnly && t.assetId && t.fee) throw new Error('اصلاح بدون حرکت وجه نقد کارمزد نقدی ندارد.');
  if (!isoDay(t.date)) throw new Error('تاریخ معتبر لازم است.');
  if (t.date > financialDay) throw new Error('پرداخت آینده را در چک‌ها و تعهدات ثبت کن؛ هنوز از موجودی کم نمی‌شود.');
  if (!data.accounts.some(a => a.id === t.accountId)) throw new Error('حساب معتبر انتخاب کن.');
  if (t.type === 'transfer' && (!data.accounts.some(a => a.id === t.toAccountId) || t.accountId === t.toAccountId)) throw new Error('مبدأ و مقصد انتقال باید دو حساب متفاوت باشند.');
  if (t.type !== 'transfer' && t.toAccountId) throw new Error('حساب مقصد فقط برای انتقال داخلی است.');
  if (t.folderId && !data.folders.some(f => f.id === t.folderId && !f.archived)) throw new Error('پوشه معتبر نیست.');
  if (t.type === 'saving' && !t.goalId) throw new Error('برای تخصیص پس‌انداز، هدف انتخاب کن.');
  if (t.type === 'saving' && !t.allocationOnly || t.goalId && t.type !== 'saving') throw new Error('هدف پس‌انداز فقط به تخصیص پول موجود مرتبط می‌شود.');
  if (['asset-buy','asset-sell'].includes(t.type) && !t.assetId || t.assetId && !['asset-buy','asset-sell'].includes(t.type)) throw new Error('خرید یا فروش باید به دارایی مرتبط باشد.');
  if (['loan-receipt','loan-payment'].includes(t.type) && !t.loanId) throw new Error('رویداد وام باید به بدهی مرتبط باشد.');
  if (t.type === 'loan-payment' && (t.principal === undefined || t.interest === undefined || sum([t.principal,t.interest,t.fee??0]) !== t.amount || t.principal < 0 || t.interest < 0)) throw new Error('جمع اصل، سود و کارمزد باید برابر مبلغ پرداخت باشد.');
  if (t.goalId) {
    const goal = data.goals.find(g => g.id === t.goalId);
    if (!goal) throw new Error('هدف معتبر نیست.');
    if (!t.goalWithdrawal && goal.status && goal.status !== 'active') throw new Error('هدف تکمیل‌شده یا بایگانی‌شده را ابتدا فعال کن.');
    if (t.goalWithdrawal && goal.saved < t.amount) throw new Error('مبلغ برداشت بیشتر از پس‌انداز هدف است.');
    if (t.allocationOnly && t.goalWithdrawal) {
      const funded = sum(data.transactions.filter(x => active(x) && x.allocationOnly && x.accountId === t.accountId && x.goalId === t.goalId).map(x => x.goalWithdrawal ? -x.amount : x.amount));
      if (funded < t.amount) throw new Error('برداشت باید از تخصیص ثبت‌شده همین حساب باشد؛ پس‌انداز افتتاحیه محل تأمین مشخصی ندارد.');
    }
    if (t.allocationOnly && !t.goalWithdrawal) {
      const reserved = sum(data.transactions.filter(x => active(x) && x.allocationOnly && x.accountId === t.accountId).map(x => x.goalWithdrawal ? -x.amount : x.amount));
      if (add(reserved, t.amount) > data.accounts.find(a => a.id === t.accountId)!.balance) throw new Error('موجودی آزاد این حساب برای تخصیص کافی نیست.');
    }
  }
  if (t.assetId) {
    const asset = data.assets.find(a => a.id === t.assetId);
    if (!asset || !t.quantity || decimal(t.quantity).units <= 0n) throw new Error('دارایی و مقدار معتبر لازم است.');
    if (t.type === 'asset-buy' && !t.allocationOnly) {
      const reserved = sum(data.transactions.filter(x => active(x) && x.type === 'saving' && x.allocationOnly && x.accountId === t.accountId).map(x => x.goalWithdrawal ? -x.amount : x.amount));
      if (add(t.amount,t.fee??0) > add(data.accounts.find(a=>a.id===t.accountId)!.balance,-reserved)) throw new Error('موجودی آزاد حساب کافی نیست؛ تخصیص مرتبط را آزاد کن یا هدف تأمین را انتخاب کن.');
    }
    if (t.type === 'asset-buy') t.unitPrice = pricePerUnit(t.fx?.originalAmount ?? String(t.amount), t.quantity);
    if (t.type === 'asset-sell') { quantityAdd(asset.quantity, t.quantity, true); t.costBasis = proportional(asset.cost, t.quantity, asset.quantity); }
  }
  if (t.installmentId && !data.installments.some(i => i.id === t.installmentId && !i.settled)) throw new Error('این قسط قبلاً پرداخت شده است.');
  if (t.loanId && data.loans.some(l=>l.id===t.loanId&&l.managed)) throw new Error('برای وام جدید از تسویه قسط استفاده کن.');
  if (t.loanId && !data.loans.some(l => l.id === t.loanId && !l.archived && !l.canceled && (t.type === 'loan-receipt' || l.paid < l.count))) throw new Error('وام معتبر و فعال انتخاب کن.');
  const result = effects({...data,categoryRecords}, t, 1);
  return { ...result, transactions: [t, ...result.transactions] };
}
export function reverse(data: FinanceData, transactionId: string): FinanceData {
  const t = data.transactions.find(x => x.id === transactionId);
  if (!t || !active(t)) return data;
  if (t.id.endsWith(':release') && data.transactions.some(x=>x.id===t.id.slice(0,-8)&&active(x))) throw new Error('آزادسازی تخصیص به خرید مرتبط است؛ ابتدا همان خرید را برگشت بده.');
  // Later sales depend on cost and quantity. Require undoing the newer asset event first.
  if (t.assetId && data.transactions.slice(0, data.transactions.indexOf(t)).some(x => active(x) && x.assetId === t.assetId)) throw new Error('ابتدا رویدادهای جدیدتر این دارایی را برگشت بده.');
  if (t.type === 'loan-receipt' && data.transactions.some(x => active(x) && x.loanId === t.loanId && x.type !== 'loan-receipt')) throw new Error('ابتدا پرداخت‌های این وام را برگشت بده.');
  if (t.occurrenceKey && data.transactions.slice(0, data.transactions.indexOf(t)).some(x => active(x) && x.occurrenceKey?.split(':')[0] === t.occurrenceKey?.split(':')[0])) throw new Error('ابتدا پرداخت‌های جدیدتر این الگو را برگشت بده.');
  const result = effects(data, t, -1);
  if (t.type === 'loan-receipt') result.loans = result.loans.map(l=>l.id===t.loanId?{...l,canceled:true}:l);
  if (result.goals.some(g => g.saved < 0)) throw new Error('ابتدا برداشت‌های مرتبط با این هدف را برگشت بده.');
  const reversed: FinanceData = { ...result, transactions: result.transactions.map(x => x.id === t.id ? { ...x, status: 'reversed', note: `${x.note ?? ''}\nبرگشت در ${new Date().toISOString()}` } : x), obligations: result.obligations.map(o => o.transactionId === t.id ? { ...o, status: 'pending', transactionId: undefined } : o), recurring: result.recurring.map(r => t.occurrenceKey?.startsWith(`${r.id}:`) ? { ...r, nextDate: t.occurrenceKey.slice(r.id.length + 1) } : r) };
  return t.assetId && reversed.transactions.some(x=>x.id===`${t.id}:release` && active(x)) ? reverse(reversed,`${t.id}:release`) : reversed;
}
export function revise(data: FinanceData, transactionId: string, title: string, amount: number): FinanceData {
  const t = data.transactions.find(x => x.id === transactionId);
  if (!t || !active(t)) throw new Error('تراکنش فعال نیست.');
  if (t.id.endsWith(':release')) throw new Error('این تخصیص وابسته به خرید است؛ خرید مرتبط را اصلاح کن.');
  if (t.paymentAllocation || t.assetId || t.loanId || t.obligationId || t.occurrenceKey || t.fx) throw new Error('برای اصلاح این رویداد، آن را برگشت بده و دوباره ثبت کن.');
  integer(String(amount));
  const undone = effects(data, t, -1);
  const revised = { ...t, title, amount, revisions: [...(t.revisions ?? []), { title: t.title, amount: t.amount, at: new Date().toISOString() }] };
  if (t.legacy) {
    // Historical saving events debited cash. Preserve that meaning when correcting them.
    const result = effects(undone,revised,1);
    if (result.goals.some(g=>g.saved<0)) throw new Error('اصلاح با تخصیص‌های بعدی هدف سازگار نیست.');
    return { ...result, transactions: data.transactions.map(x=>x.id===t.id?revised:x) };
  }
  const validated = post({ ...undone, transactions: undone.transactions.filter(x => x.id !== t.id) }, { ...revised, folderId: undefined });
  return { ...validated, transactions: data.transactions.map(x => x.id === t.id ? revised : x) };
}
export function loanPayment(data: FinanceData, loanId: string, accountId: string, date: string, creator: Transaction['createdBy'], expectedPaid?: number): FinanceData {
  const loan = data.loans.find(l => l.id === loanId && !l.archived && !l.canceled);
  if (loan?.managed) throw new Error('این وام را از ماژول تعهدات و برنامه اقساط پرداخت کن.');
  if (!loan || loan.paid >= loan.count) throw new Error('وام تسویه شده است.');
  if (expectedPaid !== undefined && loan.paid !== expectedPaid) throw new Error('این پرداخت قبلاً ثبت شده؛ وضعیت وام به‌روز شد.');
  const installment = data.installments.find(i => i.loanId === loanId && !i.settled);
  const key = installment?.id ?? `${loan.id}:${loan.paid}`;
  const previous = data.transactions.filter(t => t.id.startsWith(`loan-payment:${key}:`)).length;
  return post(data, { id: `loan-payment:${key}:${previous}`, title: `قسط ${loan.name}`, type: installment?.principal === undefined ? 'expense' : 'loan-payment', amount: installment?.amount ?? loan.installment, principal: installment?.principal, interest: installment?.interest, category: 'اقساط', accountId, date, createdBy: creator, visibility: data.accounts.find(a => a.id === accountId)?.visibility ?? 'private', loanId, installmentId: installment?.id });
}

export function settleObligation(data: FinanceData, obligationId: string, date: string, creator: Transaction['createdBy']): FinanceData {
  const o = data.obligations.find(x => x.id === obligationId);
  if (!o) throw new Error('تعهد معتبر نیست.');
  if (o.currency && o.currency !== 'IRT') throw new Error('برای چک ارزی از تسویه ماژول تعهدات استفاده کن.');
  if (o.status === 'cleared') return data;
  if (o.status !== 'pending') throw new Error('تعهد در انتظار پرداخت نیست.');
  const count = data.transactions.filter(t => t.obligationId === o.id).length;
  const t: Transaction = { id: `obligation:${o.id}:${count}`, title: o.name, type: o.direction === 'pay' ? 'expense' : 'income', amount: o.amount, category: o.category, accountId: o.accountId, date, createdBy: creator, visibility: o.visibility, obligationId: o.id };
  const next = post(data, t);
  return { ...next, obligations: next.obligations.map(x => x.id === o.id ? { ...x, status: 'cleared', transactionId: t.id } : x) };
}
export function payRecurring(data: FinanceData, templateId: string, dueDate: string, paidDate: string, creator: Transaction['createdBy']): FinanceData {
  const r = data.recurring.find(x => x.id === templateId && !x.archived);
  if (!r || !r.accountId || !isoDay(dueDate) || dueDate > paidDate) throw new Error('الگو، حساب و سررسید معتبر لازم است.');
  if (!r.transactionType) throw new Error('نوع رویداد این الگوی قدیمی را تکمیل کن.');
  if (r.currency && r.currency !== 'IRT') throw new Error('برای پرداخت ارزی از ماژول تعهدات استفاده کن.');
  if (r.foreignCurrency) throw new Error('پرداخت ارزی جدید را با مبلغ اصلی و نرخ تاریخی جدید از فرم هزینه ثبت کن؛ سپس سررسید الگو را تغییر بده.');
  const key = `${r.id}:${dueDate}`;
  if (data.transactions.some(t => active(t) && t.occurrenceKey === key)) return data;
  if (r.nextDate !== dueDate) throw new Error('سررسید تغییر کرده است.');
  const count = data.transactions.filter(t => t.occurrenceKey === key).length;
  const t: Transaction = { id: `recurring:${key}:${count}`, title: r.name, type: r.transactionType, amount: r.amount, category: r.category, accountId: r.accountId, toAccountId: r.transactionType==='transfer'?r.toAccountId:undefined, goalId:r.transactionType==='saving'?r.goalId:undefined, allocationOnly:r.transactionType==='saving', goalWithdrawal:r.goalWithdrawal, date: paidDate, createdBy: creator, visibility: data.accounts.find(a => a.id === r.accountId)!.visibility, occurrenceKey: key };
  const result = post(data, t);
  const following = r.frequency === 'سفارشی' ? '' : nextDate(dueDate, r.frequency, r.anchorDay);
  return { ...result, recurring: result.recurring.map(x => x.id === r.id ? { ...x, nextDate: following } : x) };
}

// Managed schedules derive their progress from active historical allocations.
export function refreshObligationLoans(data: FinanceData, transactions = data.transactions): FinanceData {
  const installments = data.installments.map(i => {
    if (!data.loans.some(l=>l.id===i.loanId && l.managed)) return i;
    const payments = transactions.filter(t=>active(t)&&t.paymentAllocation?.installmentId===i.id);
    const paidAmount = sum(payments.map(t=>t.paymentAllocation!.nativeAmount));
    return {...i,paidAmount,principalPaid:sum(payments.map(t=>t.paymentAllocation!.principal)),interestPaid:sum(payments.map(t=>t.paymentAllocation!.interest)),feesPaid:sum(payments.map(t=>t.paymentAllocation!.fees)),settled:paidAmount===i.amount,transactionIds:payments.map(t=>t.id),transactionId:payments.at(-1)?.id};
  });
  const loans = data.loans.map(l=> {
    if (!l.managed) return l;
    const rows = installments.filter(i=>i.loanId===l.id), next = [...rows].filter(i=>!i.settled).sort((a,b)=>a.date.localeCompare(b.date))[0];
    return {...l,paid:rows.filter(i=>i.settled).length,principalRemaining:sum(rows.map(i=>add(i.principal??0,-(i.principalPaid??0)))),nextDate:next?.date??'',installment:next?add(next.amount,-(next.paidAmount??0)):0};
  });
  return {...data,loans,installments};
}
