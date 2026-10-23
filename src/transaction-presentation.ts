import type { Transaction } from './types';

// Audit annotations belong to history, not to the user note displayed in rows and details.
export function transactionUserNote(note?: string): string {
  return (note ?? '').split('\n').filter(line =>
    !/^اصلاح مرتبط با .+$/.test(line.trim()) &&
    !/^برگشت در \d{4}-\d{2}-\d{2}T/.test(line.trim()) &&
    line.trim() !== 'بازمحاسبه بهای فروش پس از اصلاح موجودی افتتاحیه'
  ).join('\n').trim();
}

export function transactionTone(t: Transaction): string | undefined {
  if (t.assetId || t.type === 'asset-buy' || t.type === 'asset-sell' || t.type === 'saving') return '#2563eb';
  if (t.type === 'expense' || t.type === 'loan-payment' || t.foreignExpense) return 'var(--destructive)';
  if (t.type === 'income' || t.type === 'loan-receipt') return 'var(--success)';
  return undefined;
}
