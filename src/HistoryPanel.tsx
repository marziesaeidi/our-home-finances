import { Action, Surface } from './components/finance-ui';
import type { FinanceData, Transaction } from './types';
import { active, allowed } from './finance';
import { money, persianDate } from './utils';

export function HistoryPanel({ data, viewer, select, change }: { data: FinanceData; viewer: string; select: (t: Transaction) => void; change: (d: FinanceData) => void }) {
  const reversed = data.transactions.filter(t => !active(t) && allowed(t, viewer));
  const archived = data.loans.filter(l => l.archived);
  return <>{reversed.length > 0 && <Surface as="details" className="card module-editor archive-list"><summary>سوابق لغوشده ({reversed.length.toLocaleString('fa-IR')})</summary>{reversed.map(t => <Action variant="ghost" className="transaction-row" key={t.id} onClick={() => select(t)}><span className="row-main"><strong>{t.title}</strong><small>{persianDate(t.date)} · لغوشده</small></span><span>{money(t.amount)}</span></Action>)}</Surface>}{archived.length > 0 && <Surface as="details" className="card module-editor archive-list"><summary>وام‌های بایگانی‌شده</summary>{archived.map(l => <div className="archive-row" key={l.id}><b>{l.name}</b><Action variant="outline" className="outline" onClick={() => change({ ...data, loans: data.loans.map(x => x.id === l.id ? { ...x, archived: false } : x) })}>نمایش دوباره</Action></div>)}</Surface>}</>;
}
