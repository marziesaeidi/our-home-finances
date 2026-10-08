import { Action } from './components/finance-ui';
import type { FinanceData, Transaction } from './types';
import { active, allowed } from './finance';
import { money, persianDate } from './utils';

export function HistoryPanel({ data, viewer, select, change }: { data: FinanceData; viewer: string; select: (t: Transaction) => void; change: (d: FinanceData) => void }) {
  const reversed = data.transactions.filter(t => !active(t) && allowed(t, viewer));
  const archived = data.loans.filter(l => l.archived);
  return <>{reversed.length > 0 && <details className="card module-editor archive-list"><summary>سوابق برگشت‌شده ({reversed.length.toLocaleString('fa-IR')})</summary>{reversed.map(t => <Action className="transaction-row" key={t.id} onClick={() => select(t)}><span className="row-main"><strong>{t.title}</strong><small>{persianDate(t.date)} · برگشت‌شده</small></span><span>{money(t.amount)}</span></Action>)}</details>}{archived.length > 0 && <details className="card module-editor archive-list"><summary>وام‌های بایگانی‌شده</summary>{archived.map(l => <div className="archive-row" key={l.id}><b>{l.name}</b><Action className="outline" onClick={() => change({ ...data, loans: data.loans.map(x => x.id === l.id ? { ...x, archived: false } : x) })}>نمایش دوباره</Action></div>)}</details>}</>;
}
