import { Detail } from './components/content-state';
import { ErrorNotice } from './components/error-notice';
import { Action, Surface } from './components/finance-ui';
import { useState } from 'react';
import type { FinanceData, Loan } from './types';
import { DateField } from './DateField';
import { isoDay } from './calendar';
import { scheduleLoan } from './finance';
import { money, persianDate, today } from './utils';

export function LoanSchedule({ loan, data, change }: { loan: Loan; data: FinanceData; change: (d: FinanceData) => void }) {
  const [date, setDate] = useState(isoDay(loan.nextDate) ? loan.nextDate : today()), [error, setError] = useState('');
  const schedule = data.installments.filter(i => i.loanId === loan.id);
  return <><Surface as="details" className="module-editor card"><summary>برنامه اقساط و سررسیدها</summary>{schedule.map(i => <Detail key={i.id} label={<>قسط {(i.index + 1).toLocaleString('fa-IR')}· {i.settled ? 'پرداخت‌شده' : persianDate(i.date)}</>} value={<>{money(i.amount)}</>}/>)}{!schedule.length && <form className="finance-form" onSubmit={e => { e.preventDefault(); try { if (!isoDay(date)) throw new Error('تاریخ معتبر لازم است.'); const updated = { ...loan, nextDate: date }; change({ ...data, loans: data.loans.map(l => l.id === loan.id ? updated : l), installments: [...data.installments, ...scheduleLoan(updated)] }); setError(''); } catch (err) { setError((err as Error).message); } }}><p className="field-hint">تاریخ نخستین قسط پرداخت‌نشده را تعیین کن. تاریخ اقساط پرداخت‌شده قدیمی حدس زده نمی‌شود.</p><DateField label="قسط بعدی" value={date} onChange={setDate}/>{error && <ErrorNotice message={error}/>}<Action variant="outline" type="submit" className="outline">تکمیل برنامه اقساط</Action></form>}</Surface>{loan.principalRemaining !== undefined && <Detail  label={<>اصل بدهی باقی‌مانده</>} value={<>{money(loan.principalRemaining)}</>}/>}</>;
}
