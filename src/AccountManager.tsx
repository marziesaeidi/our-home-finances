import { Empty } from './components/content-state';
import { ErrorNotice } from './components/error-notice';
import { CollectionPreview } from './components/collection-preview';
import { EditorForm } from './components/editor-form';
import { FlowBack } from './components/flow-navigation';
import { FieldSelect } from './components/finance-ui';
import { active } from './finance';
import { money, persianDate } from './utils';
import { CollectionHeading } from './components/collection-heading';
import { FormField } from './components/form-fields';
import { useUIRequest } from './components/use-ui-request';
import { Surface, FieldInput, Action } from './components/finance-ui';
import { useState } from 'react';
import { allowed } from './finance';
import { nativeMoney } from './currencies';
import type { Account, FinanceData, Transaction } from './types';

export function removeAccount(data: FinanceData, id: string): FinanceData {
  if (data.accounts.length <= 1 || data.accounts.find(a => a.id === id)?.balance !== 0 || data.transactions.some(t => t.accountId === id || t.toAccountId === id) || data.accountEntries.some(e => e.accountId === id) || data.recurring.some(r => r.accountId === id || r.toAccountId === id) || data.obligations.some(o => o.accountId === id) || data.loans.some(l => l.accountId === id || l.disbursementAccountId === id)) throw new Error('فقط حساب صفر و بدون سابقه یا پیوند قابل حذف است؛ آخرین حساب حفظ می‌شود.');
  return { ...data, accounts: data.accounts.filter(a => a.id !== id) };
}
export function AccountManager({ data, viewer, change, onTransaction }: { onTransaction: (transaction: Transaction) => void; data: FinanceData; viewer: string; change: (d: FinanceData | ((d: FinanceData) => FinanceData)) => void }) {
 const [selected,setSelected]=useState('');const [showAll,setShowAll]=useState(false);
 const accounts=data.accounts.filter(a=>allowed(a,viewer)),account=accounts.find(a=>a.id===selected);
 return account?<><FlowBack label="بازگشت به حساب‌ها" onBack={()=>setSelected('')}/><AccountEditor key={account.id+account.name} account={account} data={data} change={change}/><Surface className="card module-card"><h2>{showAll?'همه تراکنش‌های این حساب':'تراکنش‌های اخیر این حساب'}</h2>{data.transactions.filter(t=>active(t)&&allowed(t,viewer)&&(t.accountId===account.id||t.toAccountId===account.id)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,showAll?undefined:5).map(t=><Action type="button" variant="ghost" className="transaction-row" key={t.id} onClick={()=>onTransaction(t)}><span className="row-main"><strong title={t.title}>{t.title}</strong><small>{persianDate(t.date)}</small></span><span className="row-end"><strong>{money(t.amount)}</strong></span></Action>)}<Action type="button" variant="outline" className="full" onClick={()=>setShowAll(v=>!v)}>{showAll?'نمایش تراکنش‌های اخیر':'نمایش همه تراکنش‌های حساب'}</Action>{!data.transactions.some(t=>active(t)&&allowed(t,viewer)&&(t.accountId===account.id||t.toAccountId===account.id))&&<Empty variant="panel">هنوز تراکنشی برای این حساب ثبت نشده است.</Empty>}</Surface></>:<div className="loan-cards">{accounts.map(a=><CollectionPreview key={a.id} kind="account" name={a.name} amount={<bdi>{nativeMoney(a.balance,a.currency??'IRT',data.currencyDefinitions)}</bdi>} footer={<><span>{a.type}</span><span>{a.visibility==='shared'?'مشترک':'شخصی'}</span></>} onClick={()=>{setSelected(a.id);setShowAll(false)}}/>)}{!accounts.length&&<Empty variant="panel">اولین حساب را با نام و موجودی فعلی‌اش اضافه کن.</Empty>}</div>;
}
function AccountEditor({ account, data, change }: { account: Account; data: FinanceData; change: (d: FinanceData | ((d: FinanceData) => FinanceData)) => void }) {
 const {requestConfirmation,requestDialog}=useUIRequest();
 const [name,setName]=useState(account.name),[type,setType]=useState(account.type),[error,setError]=useState('');
 return <Surface as="section" className="card module-card collection-card"><CollectionHeading kind="account" description={account.type}>{account.name}</CollectionHeading><p className="collection-balance"><bdi>{nativeMoney(account.balance,account.currency??'IRT',data.currencyDefinitions)}</bdi> · {account.visibility==='shared'?'مشترک':'شخصی'}</p>
 <EditorForm title="ویرایش مشخصات حساب" submitLabel="ذخیره مشخصات" summary="موجودی و سوابق حساب حفظ می‌شوند." onSubmit={()=>{if(!name.trim()||!type.trim())throw new Error('نام و نوع حساب لازم است.');change(d=>({...d,accounts:d.accounts.map(a=>a.id===account.id?{...a,name:name.trim(),type:type.trim()}:a)}));}}><FormField label="نام حساب"><FieldInput required value={name} onChange={e=>setName(e.target.value)}/></FormField><FormField label="نوع حساب"><FieldSelect value={type} onChange={e=>setType(e.target.value)}>{[...new Set([account.type,'حساب بانکی','نقدی','حساب پس‌انداز','حساب مشترک','سایر'])].map(t=><option key={t}>{t}</option>)}</FieldSelect></FormField><p className="field-hint">ارز و موجودی شروعِ حساب دارای سابقه قابل تغییر نیست. برای اصلاح موجودی، تراکنش ثبت کن.</p></EditorForm>
 <details className="planning-options"><summary>مدیریت حساب</summary><p className="field-hint">حساب فقط وقتی موجودی صفر و هیچ سابقه یا پیوندی ندارد قابل حذف است.</p><Action variant="destructive" type="button" className="danger" onClick={async()=>{try{if(await requestConfirmation('حساب صفر و بدون سابقه حذف شود؟'))change(d=>removeAccount(d,account.id));}catch(err){setError((err as Error).message);}}}>حذف حساب بدون سابقه</Action>{error&&<ErrorNotice message={error}/>}</details>{requestDialog}</Surface>;
}
