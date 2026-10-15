import { useUIRequest } from './components/use-ui-request';
import { Surface, FieldInput, Action } from './components/finance-ui';
import { useState } from 'react';
import { allowed } from './finance';
import { nativeMoney } from './currencies';
import type { Account, FinanceData } from './types';

export function removeAccount(data: FinanceData, id: string): FinanceData {
  if (data.accounts.length <= 1 || data.accounts.find(a => a.id === id)?.balance !== 0 || data.transactions.some(t => t.accountId === id || t.toAccountId === id) || data.accountEntries.some(e => e.accountId === id) || data.recurring.some(r => r.accountId === id || r.toAccountId === id) || data.obligations.some(o => o.accountId === id) || data.loans.some(l => l.accountId === id || l.disbursementAccountId === id)) throw new Error('فقط حساب صفر و بدون سابقه یا پیوند قابل حذف است؛ آخرین حساب حفظ می‌شود.');
  return { ...data, accounts: data.accounts.filter(a => a.id !== id) };
}
export function AccountManager({ data, viewer, change }: { data: FinanceData; viewer: string; change: (d: FinanceData | ((d: FinanceData) => FinanceData)) => void }) {
  return <>{data.accounts.filter(a => allowed(a, viewer)).map(a => <AccountEditor key={a.id + a.name} account={a} data={data} change={change}/>)}</>;
}
function AccountEditor({ account, data, change }: { account: Account; data: FinanceData; change: (d: FinanceData | ((d: FinanceData) => FinanceData)) => void }) {
  const { requestConfirmation, requestDialog } = useUIRequest();
  const [name, setName] = useState(account.name), [type, setType] = useState(account.type), [error, setError] = useState('');
  return <Surface as="section" className="card module-card"><h2>{account.name}</h2><p><bdi>{nativeMoney(account.balance, account.currency ?? 'IRT', data.currencyDefinitions)}</bdi> · {account.visibility === 'shared' ? 'مشترک' : 'شخصی'}</p><details><summary>ویرایش حساب</summary><form className="finance-form" onSubmit={e => { e.preventDefault(); try { if (!name.trim() || !type.trim()) throw new Error('نام و نوع حساب لازم است.'); change(d => ({ ...d, accounts: d.accounts.map(a => a.id === account.id ? { ...a, name: name.trim(), type: type.trim() } : a) })); setError('ذخیره شد.'); } catch (err) { setError((err as Error).message); } }}><label className="field">نام حساب<FieldInput required value={name} onChange={e => setName(e.target.value)}/></label><label className="field">نوع حساب<FieldInput required value={type} onChange={e => setType(e.target.value)}/></label><Action className="primary">ذخیره</Action><p className="field-hint">ارز و موجودی شروعِ حساب دارای سابقه قابل تغییر نیست. برای اصلاح موجودی، تراکنش ثبت کن.</p><Action type="button" className="danger" onClick={async () => { try { if (await requestConfirmation('حساب صفر و بدون سابقه حذف شود؟')) change(d => removeAccount(d, account.id)); } catch (err) { setError((err as Error).message); } }}>حذف حساب بدون سابقه</Action>{error && <p role="status">{error}</p>}</form></details>{requestDialog}</Surface>;
}
