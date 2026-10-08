import { nativeText } from './currencies';
import { ForeignExpenses } from './ForeignExpenses';
import { FinancialObligations } from './FinancialObligations';
import { AssetHoldings } from './SavingsAssets';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { FinanceData, Transaction, Budget } from './types';
import { add, converted, integer, normalizeDigits, sum } from './decimal';
import { active, allowed, consumption, earnedIncome, remainingLoan } from './finance';
import { fromJalali, periodKey } from './calendar';
import { migrate, validate } from './store';
import { categories } from './data';
import { money, persianDate, today } from './utils';

export type ModulePage = 'foreign' | 'folders' | 'assets' | 'obligations' | 'reports' | 'backup' | 'automation';
type Props = { page: ModulePage; data: FinanceData; viewer: Transaction['createdBy']; change: (next: FinanceData | ((d:FinanceData)=>FinanceData)) => void };
function Field({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string }) {
  return <label className="field"><span>{label}</span><input required value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}/></label>;
}
function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (s: string) => void; options: [string, string][] }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}
function Editor({ title, children, onSubmit }: { title: string; children: ReactNode; onSubmit: () => void }) {
  const [error, setError] = useState('');
  return <details className="card module-editor"><summary>{title}</summary><form className="finance-form" onSubmit={(e: FormEvent) => { e.preventDefault(); try { onSubmit(); setError(''); } catch (err) { setError(err instanceof Error ? err.message : 'ثبت انجام نشد.'); } }}>{children}{error && <p role="alert" className="form-error">{error}</p>}<button className="primary" type="submit">ثبت</button></form></details>;
}
export function FinanceModules(props: Props) {
  const { page } = props;
  return page === 'foreign' ? <ForeignExpenses {...props}/> : page === 'assets' ? <AssetHoldings {...props}/> : page === 'obligations' ? <FinancialObligations {...props}/> : page === 'reports' ? <Reports {...props}/> : page === 'backup' ? <Backup {...props}/> : <FinancialObligations {...props} initialTab="recurring"/>;
}
function Reports({ data, viewer }: Props) {
  const [month, setMonth] = useState(periodKey(today()));
  const transactions = data.transactions.filter(t => active(t) && allowed(t, viewer) && periodKey(t.date) === month);
  const unvaluedAccounts=data.accounts.filter(a=>allowed(a,viewer)&&a.currency!=='IRT');
  const cash = sum(data.accounts.filter(a => allowed(a, viewer) && (a.currency??'IRT')==='IRT').map(a => a.balance));
  const assets = data.assets.filter(a => allowed(a, viewer)), priced = assets.filter(a => a.quote), unknown = assets.filter(a => !a.quote);
  const liabilities = sum(data.loans.filter(l=>l.direction!=='lend'&&(!l.currency||l.currency==='IRT')).map(l => remainingLoan(data, l)));
  const knownPrincipal = sum(data.loans.filter(l => l.direction!=='lend'&&(!l.currency||l.currency==='IRT')&&l.principalRemaining !== undefined).map(l => l.principalRemaining!));
  const unknownPrincipal = data.loans.filter(l => remainingLoan(data,l) > 0 && (l.principalRemaining === undefined || l.currency&&l.currency!=='IRT'));
  const value = sum(priced.map(a => converted(a.quantity, a.quote!)));
  const expenses = sum(transactions.map(consumption));
  const income = sum(transactions.map(earnedIncome));
  const cashOut = sum(transactions.filter(t => !t.allocationOnly && ['expense', 'asset-buy', 'loan-payment'].includes(t.type)).map(t => t.foreignExpense ? converted(nativeText(add(t.foreignExpense.debitMinor,t.foreignExpense.feeMinor),t.foreignExpense.paymentCurrency,data.currencyDefinitions),t.foreignExpense.paymentRate) : add(t.amount, t.fee ?? 0)));
  const cashIn = sum(transactions.filter(t => !t.allocationOnly && ['income', 'asset-sell', 'loan-receipt'].includes(t.type)).map(t => add(t.amount, -(t.fee ?? 0))));
  const months = [...new Set([periodKey(today()), ...data.transactions.map(t => periodKey(t.date))])].sort().reverse();
  const grouped = new Map<string, number>();
  transactions.forEach(t => { const amount = consumption(t); if (amount) grouped.set(t.category, add(grouped.get(t.category) ?? 0, amount)); });
  return <>{unvaluedAccounts.length>0&&<p className="field-hint">موجودی {unvaluedAccounts.map(a=>a.name).join("، ")} به ارز حساب نمایش داده می‌شود و بدون نرخ ارزش‌گذاری امروز در مجموع دارایی تومانی نیست.</p>}<h1>گزارش‌های مالی</h1><Choice label="ماه شمسی" value={month} onChange={setMonth} options={months.map(m => [m, m.replace(/\d/g, c => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]).replace('-', ' / ')])}/><div className="two-stats report-stats">{[['درآمد', income], ['هزینه ثبت‌شده', expenses], ['ورود نقد واقعی', cashIn], ['خروج نقد واقعی', cashOut], ['خرید سرمایه‌گذاری', sum(transactions.filter(t => !t.allocationOnly && t.type === 'asset-buy').map(t => t.amount))], ['سود تحقق‌یافته فروش', sum(transactions.filter(t => !t.allocationOnly && t.type === 'asset-sell').map(t => sum([t.amount, -(t.costBasis ?? 0), -(t.fee ?? 0)]))) ]].map(([label, amount]) => <div className="stat-card" key={String(label)}><span>{label}</span><strong>{money(Number(amount))}</strong></div>)}</div><section className="card module-card"><h2>دارایی و بدهی فعلی</h2><div className="detail-row"><span>موجودی حساب‌ها</span><strong>{money(cash)}</strong></div><div className="detail-row"><span>دارایی‌های قیمت‌گذاری‌شده</span><strong>{money(value)}</strong></div><div className="detail-row"><span>تعهد قراردادی وام‌ها</span><strong>{money(liabilities)}</strong></div><div className="detail-row"><span>اصل بدهی مشخص‌شده</span><strong>{money(knownPrincipal)}</strong></div><div className="detail-row"><span>دارایی خالص</span><strong>{unknown.length||unknownPrincipal.length||unvaluedAccounts.length?"نیازمند تکمیل قیمت یا اصل بدهی":money(sum([cash,value,-knownPrincipal,...data.loans.filter(l=>l.direction==='lend'&&l.currency==='IRT').map(l=>l.principalRemaining??0)]))}</strong></div><p className="field-hint">هدف‌های پس‌انداز دوباره به دارایی‌ها اضافه نشده‌اند. تعهد قراردادی ممکن است سود آینده داشته باشد و با اصل بدهی متفاوت است. تا مشخص‌شدن اصل همه بدهی‌ها و قیمت دارایی‌ها، دارایی خالص قطعی نمایش داده نمی‌شود. چک‌ها جداگانه نمایش داده می‌شوند تا بدهی یک خرید دوباره شمرده نشود.</p>{unknown.length > 0 && <p className="form-error">قیمت {unknown.map(a => a.name).join('، ')} ثبت نشده؛ ارزش آن‌ها صفر فرض نشده است.</p>}<p className="field-hint">اقساط قدیمی با همان طبقه‌بندی هزینه قبلی نمایش داده می‌شوند. اقساط جدید دارای تفکیک اصل و سود، فقط سود و کارمزد را در هزینه می‌آورند.</p></section><section className="card module-card"><h2>هزینه‌ها بر اساس دسته</h2>{[...grouped].sort((a, b) => b[1] - a[1]).map(([name, amount]) => <div className="detail-row" key={name}><span>{name}</span><strong>{money(amount)}</strong></div>)}{!grouped.size && <p className="muted">هزینه‌ای در این ماه ثبت نشده است.</p>}</section></>;
}
export function BudgetHistory({ data, change }: { data: FinanceData; change: (d: FinanceData) => void }) {
  const [month, setMonth] = useState(periodKey(today())), [error, setError] = useState('');
  const key = (() => { try { return periodKey(fromJalali(`${month.replace('-', '/')}/1`)); } catch { return ''; } })();
  const budget = data.monthlyBudgets[key] ?? { total: 0, categories: Object.fromEntries(categories.map(c => [c, 0])) };
  const update = (next: Budget) => { if (!key) throw new Error('ماه معتبر وارد کن.'); change({ ...data, monthlyBudgets: { ...data.monthlyBudgets, [key]: next }, budget: key === periodKey(today()) ? next : data.budget }); };
  return <section className="card module-card"><h2>بودجه مستقل هر ماه شمسی</h2><label className="field">سال و ماه شمسی<input value={month.replace('-', '/')} onChange={e => { const v = normalizeDigits(e.target.value).replace('/', '-'); setMonth(v); }} onBlur={() => { try { fromJalali(`${month.replace('-', '/')}/1`); setError(''); } catch (e) { setError((e as Error).message); } }}/></label>{error && <p className="form-error">{error}</p>}<Editor title="تنظیم سقف این ماه" onSubmit={() => { fromJalali(`${month.replace('-', '/')}/1`); update(budget); }}><label className="field">کل بودجه<input value={budget.total} inputMode="numeric" onChange={e => { try { fromJalali(`${month.replace('-', '/')}/1`); update({ ...budget, total: integer(e.target.value, true) }); setError(''); } catch (err) { setError((err as Error).message); } }}/></label>{Object.entries(budget.categories).map(([name, limit]) => <label className="field" key={name}>{name}<input value={limit} onChange={e => { try { fromJalali(`${month.replace('-', '/')}/1`); update({ ...budget, categories: { ...budget.categories, [name]: integer(e.target.value, true) } }); setError(''); } catch (err) { setError((err as Error).message); } }}/></label>)}</Editor></section>;
}
function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Backup({ data, change }: Props) {
  const [incoming, setIncoming] = useState<FinanceData | null>(null), [message, setMessage] = useState(''), [name, setName] = useState(data.settings.name);
  const csv = () => {
    const cell = (v: string) => `"${(/^[=+@\-\t\r]/.test(v) ? "'" : '') + v.replace(/"/g, '""')}"`;
    const header = ['شناسه', 'عنوان', 'نوع', 'مبلغ تومان', 'تاریخ شمسی', 'وضعیت', 'حساب', 'پوشه', 'ارز اصلی', 'مبلغ اصلی', 'نرخ تاریخی'];
    const labels: Record<Transaction['type'], string> = { expense: 'هزینه', income: 'درآمد', transfer: 'انتقال', saving: 'تخصیص پس‌انداز', 'asset-buy': 'خرید دارایی', 'asset-sell': 'فروش دارایی', 'loan-receipt': 'دریافت وام', 'loan-payment': 'پرداخت وام' };
    const rows = data.transactions.map(t => [t.id, t.title, labels[t.type], String(t.amount), persianDate(t.date), active(t) ? 'ثبت‌شده' : 'برگشت‌شده', data.accounts.find(a => a.id === t.accountId)?.name ?? t.accountId, data.folders.find(f => f.id === t.folderId)?.name ?? '', t.fx?.currency ?? 'تومان', t.fx?.originalAmount ?? String(t.amount), t.fx?.rate ?? '']);
    download(`تراکنش‌ها-${today()}.csv`, '\uFEFF' + [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  return <><h1>پشتیبان‌گیری و تنظیمات</h1><section className="card module-card"><p>پشتیبان کامل، همه سوابق و تنظیمات را نگه می‌دارد. خروجی جدول برای بررسی تراکنش‌هاست.</p><div className="detail-actions"><button className="primary" onClick={() => download(`خانه-ما-${today()}.json`, JSON.stringify(data, null, 2))}>دریافت پشتیبان کامل</button><button className="outline" onClick={csv}>خروجی جدول تراکنش‌ها</button></div><label className="field backup-input">بررسی فایل پشتیبان<input type="file" accept=".json,application/json" onChange={async e => { try { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10_000_000) throw new Error('فایل بیش از ۱۰ مگابایت است.'); const candidate = migrate(JSON.parse(await file.text()), new Date().toISOString()); validate(candidate); setIncoming(candidate); setMessage('فایل بررسی شد. بازیابی پس از دریافت پشتیبان فعلی انجام می‌شود.'); } catch (err) { setIncoming(null); setMessage((err as Error).message); } }}/></label>{message && <p role="status">{message}</p>}{incoming && <div className="soft-note"><p>فایل شامل {incoming.transactions.length.toLocaleString('fa-IR')} تراکنش است. بازیابی، داده فعال را با این فایل جایگزین می‌کند؛ پشتیبان فعلی ابتدا دریافت می‌شود.</p><button className="outline" onClick={() => { try { download(`پیش-از-بازیابی-${today()}.json`, JSON.stringify(data)); change(incoming); setIncoming(null); setMessage('پشتیبان بازیابی شد.'); } catch (err) { setMessage((err as Error).message); } }}>بازیابی این فایل</button></div>}</section><Editor title="شخصی‌سازی" onSubmit={() => { if (!name.trim()) throw new Error('نام لازم است.'); change({ ...data, settings: { ...data.settings, name: name.trim() } }); }}><Field label="نام فضای مالی" value={name} onChange={setName}/><Choice label="ظاهر برنامه" value={data.settings.theme} onChange={v => change({ ...data, settings: { ...data.settings, theme: v as 'light' | 'dark' } })} options={ [['light', 'روشن'], ['dark', 'تیره']] }/><p className="field-hint">واحد پیش‌فرض: تومان · تقویم: شمسی · منطقه زمانی: تهران</p></Editor><section className="card module-card"><h2>وضعیت مهاجرت</h2>{data.migrationWarnings.map((w, i) => <p className="field-hint" key={i}>{w}</p>)}</section></>;
}
