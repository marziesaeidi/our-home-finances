import type { FinanceData } from './types';
import { allowed } from './finance';

// Never detach posted or reversed financial history from its parent record.
export function removeAsset(data: FinanceData, id: string, viewer: string): FinanceData {
  const asset = data.assets.find(a => a.id === id);
  if (!asset || !allowed(asset, viewer)) throw new Error('دارایی در دسترس نیست.');
  if (data.transactions.some(t => t.assetId === id) || data.assetOpeningRevisions?.some(r => r.assetId === id))
    throw new Error('این دارایی سابقه معامله یا اصلاح دارد و قابل حذف نیست؛ سوابق مالی باید حفظ شوند.');
  return { ...data, assets: data.assets.filter(a => a.id !== id) };
}
export function removeGoal(data: FinanceData, id: string, viewer: string): FinanceData {
  const goal = data.goals.find(g => g.id === id);
  if (!goal || !allowed(goal, viewer)) throw new Error('باکس در دسترس نیست.');
  if (goal.saved || goal.openingSaved || data.transactions.some(t => t.goalId === id) || data.assets.some(a => a.goalId === id) || data.recurring.some(r => r.goalId === id))
    throw new Error('باکس دارای موجودی یا سابقه و پیوند مالی قابل حذف نیست؛ از بایگانی در تنظیمات باکس استفاده کن.');
  return { ...data, goals: data.goals.filter(g => g.id !== id) };
}
export function removeCheck(data: FinanceData, id: string, viewer: string): FinanceData {
  const check = data.obligations.find(o => o.id === id);
  if (!check || !allowed(check, viewer)) throw new Error('چک در دسترس نیست.');
  if (check.status === 'cleared' || check.transactionId || data.transactions.some(t => t.obligationId === id))
    throw new Error('چک دارای سابقه پرداخت قابل حذف نیست؛ سوابق مالی باید حفظ شوند.');
  return { ...data, obligations: data.obligations.filter(o => o.id !== id) };
}
export function removeLoan(data: FinanceData, id: string, viewer: string): FinanceData {
  const loan = data.loans.find(l => l.id === id);
  if (!loan || (loan.visibility ? !allowed({visibility:loan.visibility,owner:loan.owner},viewer) : loan.owner !== viewer)) throw new Error('وام در دسترس نیست.');
  if (loan.paid || loan.baselinePaid || data.transactions.some(t => t.loanId === id || t.paymentAllocation?.loanId === id) || data.installments.some(i => i.loanId === id && (i.settled || i.paidAmount || i.transactionId || i.transactionIds?.length)))
    throw new Error('وام دارای سابقه دریافت یا پرداخت قابل حذف نیست؛ از بایگانی وام استفاده کن.');
  return { ...data, loans: data.loans.filter(l => l.id !== id), installments: data.installments.filter(i => i.loanId !== id) };
}
