import type { FinanceData, Folder, Transaction } from './types';
import { active, allowed } from './finance';
import { add, sum } from './decimal';
import { periodKey } from './calendar';

// Projects classify existing events; they never post account entries.
export const folderSpending = (t: Transaction) => active(t) && t.type === 'expense' ? t.paymentAllocation?.expense ?? t.amount : 0;
export function folderReport(data: FinanceData, folderId: string, viewer: string) {
  const transactions = data.transactions.filter(t => active(t) && allowed(t, viewer) && t.folderId === folderId).sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const categories: Record<string, number> = {}, months: Record<string, number> = {};
  for (const t of transactions) {
    const amount = folderSpending(t);
    if (!amount) continue;
    categories[t.category] = add(categories[t.category] ?? 0, amount);
    const month = periodKey(t.date);
    months[month] = add(months[month] ?? 0, amount);
  }
  return { transactions, total: sum(transactions.map(folderSpending)), categories, months };
}
export function saveFolder(data: FinanceData, folder: Folder, viewer: string): FinanceData {
  const previous = data.folders.find(f => f.id === folder.id);
  if (previous && !allowed(previous, viewer) || !allowed(folder, viewer)) throw new Error('پوشه در دسترس نیست.');
  if (!folder.name.trim() || folder.budget !== undefined && (!Number.isSafeInteger(folder.budget) || folder.budget < 0)) throw new Error('نام و بودجه پوشه معتبر نیست.');
  return { ...data, folders: previous ? data.folders.map(f => f.id === folder.id ? { ...folder, name: folder.name.trim() } : f) : [...data.folders, { ...folder, name: folder.name.trim() }] };
}
export function linkFolder(data: FinanceData, transactionId: string, folderId: string | undefined, viewer: string): FinanceData {
  const transaction = data.transactions.find(t => t.id === transactionId);
  if (!transaction || !allowed(transaction, viewer)) throw new Error('تراکنش در دسترس نیست.');
  const folder = data.folders.find(f => f.id === folderId);
  if (folderId && (!folder || !allowed(folder, viewer) || folder.archived && transaction.folderId !== folderId)) throw new Error('پوشه فعال و قابل دسترس انتخاب کن.');
  return { ...data, transactions: data.transactions.map(t => t.id === transactionId ? { ...t, folderId } : t) };
}
export function deleteFolder(data: FinanceData, folderId: string, viewer: string): FinanceData {
  const folder = data.folders.find(f => f.id === folderId);
  if (!folder || !allowed(folder, viewer)) throw new Error('پوشه در دسترس نیست.');
  return { ...data, folders: data.folders.filter(f => f.id !== folderId), transactions: data.transactions.map(t => t.folderId === folderId ? { ...t, folderId: undefined } : t) };
}
