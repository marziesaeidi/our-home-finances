import type { FinanceData, ObligationCurrency } from './types';
import { active, allowed, loanPayment } from './finance';
import { add } from './decimal';
import { isoDay } from './calendar';
import { settleCheck, settleInstallment, settleRecurring, type Settlement } from './obligations';

export type PaymentKind = 'installment' | 'check' | 'recurring';
export type ExpensePayment = { key: string; id: string; kind: PaymentKind; name: string; date: string; amount: number; currency: ObligationCurrency; accountId?: string; legacy?: boolean };
export function expensePayments(data: FinanceData, viewer: string): ExpensePayment[] {
  const rows: ExpensePayment[] = [];
  for (const loan of data.loans.filter(l => !l.archived && !l.canceled && l.direction !== 'lend' && (!l.visibility || allowed({...l, visibility:l.visibility}, viewer)))) {
    for (const i of data.installments.filter(i => i.loanId === loan.id && !i.settled)) rows.push({key:`installment:${i.id}`,id:i.id,kind:'installment',name:`${loan.name} · قسط ${i.index + 1}`,date:i.date,amount:add(i.amount,-(i.paidAmount??0)),currency:loan.currency??'IRT',accountId:loan.accountId,legacy:!loan.managed});
  }
  for (const o of data.obligations.filter(o => o.direction === 'pay' && o.status === 'pending' && allowed(o,viewer))) rows.push({key:`check:${o.id}`,id:o.id,kind:'check',name:o.name,date:o.date,amount:o.amount,currency:o.currency??'IRT',accountId:o.accountId});
  for (const r of data.recurring.filter(r => r.owner === viewer && !r.archived && r.transactionType === 'expense' && !r.foreignCurrency && isoDay(r.nextDate) && (!r.endDate || r.nextDate <= r.endDate) && !data.transactions.some(t => active(t) && t.occurrenceKey === `${r.id}:${r.nextDate}`))) rows.push({key:`recurring:${r.id}:${r.nextDate}`,id:r.id,kind:'recurring',name:r.name,date:r.nextDate,amount:r.amount,currency:r.currency??'IRT',accountId:r.accountId});
  return rows.sort((a,b) => a.date.localeCompare(b.date));
}
export function payExpenseObligation(data: FinanceData, viewer: string, key: string, opts: Settlement): FinanceData {
  const row = expensePayments(data,viewer).find(r => r.key === key);
  if (!row) throw new Error('تعهد انتخاب‌شده دیگر قابل پرداخت نیست. دوباره انتخاب کن.');
  if (row.kind === 'check') return settleCheck(data,row.id,opts,viewer);
  if (row.kind === 'recurring') return settleRecurring(data,row.id,row.date,opts,viewer);
  const i = data.installments.find(i => i.id === row.id)!;
  if (row.legacy) {
    const loan = data.loans.find(l => l.id === i.loanId)!;
    const next = data.installments.find(i => i.loanId === loan.id && !i.settled);
    if (next?.id !== i.id) throw new Error('برای وام قدیمی، ابتدا قسط قبلی را پرداخت کن.');
    return loanPayment(data,loan.id,opts.accountId,opts.date,viewer,loan.paid);
  }
  return settleInstallment(data,row.id,{...opts,principal:opts.principal??add(i.principal??0,-(i.principalPaid??0)),interest:opts.interest??add(i.interest??0,-(i.interestPaid??0)),fees:opts.fees??add(i.fees??0,-(i.feesPaid??0))},viewer);
}
