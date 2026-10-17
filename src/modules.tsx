import { FormField } from './components/form-fields';
import { EditorForm as Editor } from './components/editor-form';
import { Action, Surface, FieldInput } from './components/finance-ui';

import { FinancialReports } from './BudgetReporting';
import { ForeignExpenses, ForeignExpenseReports } from './ForeignExpenses';
import { FinancialObligations } from './FinancialObligations';
import { AssetHoldings } from './SavingsAssets';
import { useState } from 'react';

import type { FinanceData, Transaction, Budget, Loan } from './types';
import { integer, normalizeDigits } from './decimal';
import { fromJalali, periodKey } from './calendar';
import { migrate, validate } from './store';
import { categories } from './data';
import { today } from './utils';

export type ModulePage = 'foreign' | 'foreign-reports' | 'folders' | 'assets' | 'obligations' | 'reports' | 'backup' | 'automation';
type Props = { onSelectLegacy?: (loan:Loan)=>void; page: ModulePage; data: FinanceData; viewer: Transaction['createdBy']; change: (next: FinanceData | ((d:FinanceData)=>FinanceData)) => void };

export function FinanceModules(props: Props) {
  const { page } = props;
  return page === 'foreign-reports' ? <ForeignExpenseReports {...props}/> : page === 'foreign' ? <ForeignExpenses {...props}/> : page === 'assets' ? <AssetHoldings {...props}/> : page === 'obligations' ? <FinancialObligations {...props}/> : page === 'reports' ? <FinancialReports {...props}/> : page === 'backup' ? <Backup {...props}/> : <FinancialObligations {...props} initialTab="recurring"/>;
}
export function BudgetHistory({ data, change }: { data: FinanceData; change: (d: FinanceData) => void }) {
  const [month, setMonth] = useState(periodKey(today())), [error, setError] = useState('');
  const key = (() => { try { return periodKey(fromJalali(`${month.replace('-', '/')}/1`)); } catch { return ''; } })();
  const budget = data.monthlyBudgets[key] ?? { total: 0, categories: Object.fromEntries(categories.map(c => [c, 0])) };
  const update = (next: Budget) => { if (!key) throw new Error('ماه معتبر وارد کن.'); change({ ...data, monthlyBudgets: { ...data.monthlyBudgets, [key]: next }, budget: key === periodKey(today()) ? next : data.budget }); };
  return <Surface as="section" className="card module-card"><h2>بودجه هر ماه</h2><FormField label="سال و ماه شمسی"><FieldInput value={month.replace('-', '/')} onChange={e => { const v = normalizeDigits(e.target.value).replace('/', '-'); setMonth(v); }} onBlur={() => { try { fromJalali(`${month.replace('-', '/')}/1`); setError(''); } catch (e) { setError((e as Error).message); } }}/></FormField>{error && <p className="form-error">{error}</p>}<Editor title="تنظیم سقف این ماه" onSubmit={() => { fromJalali(`${month.replace('-', '/')}/1`); update(budget); }}><FormField label="کل بودجه"><FieldInput value={budget.total} inputMode="numeric" onChange={e => { try { fromJalali(`${month.replace('-', '/')}/1`); update({ ...budget, total: integer(e.target.value, true) }); setError(''); } catch (err) { setError((err as Error).message); } }}/></FormField>{Object.entries(budget.categories).map(([name, limit]) => <label className="field" key={name}>{name}<FieldInput value={limit} onChange={e => { try { fromJalali(`${month.replace('-', '/')}/1`); update({ ...budget, categories: { ...budget.categories, [name]: integer(e.target.value, true) } }); setError(''); } catch (err) { setError((err as Error).message); } }}/></label>)}</Editor></Surface>;
}
function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Backup({ data, change }: Props) {
  const [incoming, setIncoming] = useState<FinanceData | null>(null), [message, setMessage] = useState('');
  return <><h1>نسخه پشتیبان</h1><Surface as="section" className="card module-card collection-card"><h2>ذخیره یک نسخه از اطلاعات</h2><p>این فایل همه اطلاعات و تنظیمات برنامه را نگه می‌دارد تا بعداً بتوانی آن‌ها را بازیابی کنی.</p><div className="detail-actions"><Action className="primary" onClick={() => { try { validate(data); download(`خانه-ما-${today()}.json`, JSON.stringify(data, null, 2)); setMessage('پشتیبان کامل برای دریافت آماده شد؛ فایل را در پوشه دانلود بررسی کن.'); } catch (err) { setMessage((err as Error).message); } }}>دریافت پشتیبان کامل</Action></div><label className="field backup-input">بررسی فایل پشتیبان<FieldInput type="file" accept=".json,application/json" onChange={async e => { try { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10_000_000) throw new Error('فایل بیش از ۱۰ مگابایت است.'); const candidate = migrate(JSON.parse(await file.text()), new Date().toISOString()); validate(candidate); setIncoming(candidate); setMessage('فایل بررسی شد. بازیابی پس از دریافت پشتیبان فعلی انجام می‌شود.'); } catch (err) { setIncoming(null); setMessage((err as Error).message); } }}/></label>{message && <p role="status">{message}</p>}{incoming && <div className="soft-note"><p>فایل شامل {incoming.transactions.length.toLocaleString('fa-IR')} تراکنش است. بازیابی، داده فعال را با این فایل جایگزین می‌کند؛ پشتیبان فعلی ابتدا دریافت می‌شود.</p><Action className="outline" onClick={() => { try { download(`پیش-از-بازیابی-${today()}.json`, JSON.stringify(data)); change(incoming); setIncoming(null); setMessage('پشتیبان بازیابی شد.'); } catch (err) { setMessage((err as Error).message); } }}>بازیابی این فایل</Action></div>}</Surface></>;
}
