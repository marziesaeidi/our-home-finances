import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { dueItems, type DueItem } from './obligations';
import type { FinanceData } from './types';
import { fa, persianDate, today } from './utils';
import { obligationMoney } from './FinancialObligations';
import { Empty } from './components/content-state';
import { Surface } from './components/finance-ui';

function ReminderCard({ row, past = false }: { row: DueItem; past?: boolean }) {
  return <Surface as="article" className="card module-card collection-card reminder-card">
    <span className="navigation-card-icon"><Bell size={20}/></span>
    <div><h2>{row.name}</h2><p>{obligationMoney(row.amount, row.currency)} · {persianDate(row.date)}</p>
      <span className="badge">{past ? 'سررسید گذشته' : 'نزدیک به موعد'}</span>
    </div>
  </Surface>;
}

export function Reminders({ data, viewer }: { data: FinanceData; viewer: string }) {
  const [day, setDay] = useState(today);
  useEffect(() => {
    const refresh = () => setDay(today());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const rows = dueItems(data, viewer);
  const upcoming = rows.filter(row => row.date >= day && (row.date === day || row.reminderDays.some(days =>
    Date.parse(row.date + 'T12:00:00Z') - Date.parse(day + 'T12:00:00Z') <= days * 86400000)));
  const past = rows.filter(row => row.date < day).sort((a, b) => b.date.localeCompare(a.date));
  return <div className="reminder-card-list">
    {upcoming.length ? upcoming.map(row => <ReminderCard key={row.kind + row.id} row={row}/>)
      : <Empty title="یادآوری تازه‌ای نداری" desc="وقتی موعد پرداختی نزدیک شود، اینجا نمایش داده می‌شود."/>}
    <Surface as="section" className="card module-card">
      <details>
        <summary>یادآوری‌های گذشته ({fa(past.length)})</summary>
        <p className="field-hint">یادآوری‌هایی که تاریخشان گذشته است؛ گذشتن تاریخ به معنی ثبت پرداخت نیست.</p>
        {past.length ? <div className="reminder-card-list">{past.map(row => <ReminderCard key={row.kind + row.id} row={row} past/>)}</div>
          : <Empty title="یادآوری گذشته‌ای نداری"/>}
      </details>
    </Surface>
  </div>;
}
