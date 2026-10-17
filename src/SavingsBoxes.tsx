import { CollectionPreview } from './components/collection-preview';
import { DetailHero } from './components/detail-hero';
import { Progress } from './components/ui/progress';
import { ComposerIntro } from './components/transaction-composer';
import { EmojiPicker } from './components/emoji-picker';
import { FlowBack } from './components/flow-navigation';
import { FormField } from './components/form-fields';
import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Plus, PiggyBank, Settings2 } from 'lucide-react';
import { Action, FieldInput, FieldSelect, Surface } from './components/finance-ui';
import { Dialog } from './Dialog';
import { DateField } from './DateField';
import type { FinanceData, Goal, Transaction } from './types';
import { active, allowed, post, reverse } from './finance';
import { add, integer, normalizeDigits, sum } from './decimal';
import { saveGoal } from './savings';
import { periodKey } from './calendar';
import { id, money, persianDate, today } from './utils';

type Props = { data: FinanceData; viewer: Transaction['createdBy']; change: (data: FinanceData) => void; createOnly?: boolean; onCreated?: (goal: Goal) => void; onCancel?: () => void };
type Panel = 'create' | 'settings' | 'goal' | 'deposit' | 'withdraw' | null;
const statuses = { active: 'فعال', completed: 'تکمیل‌شده', archived: 'بایگانی‌شده' };
const icons = ['🌱', '🏠', '✈️', '🚗', '💅', '🎓', '🎁', '🛟'];

export function SavingsBoxes({ data, viewer, change, createOnly = false, onCreated, onCancel }: Props) {
 const [selected, setSelected] = useState('');
 const [panel, setPanel] = useState<Panel>(createOnly ? 'create' : null);
 const [error, setError] = useState('');
 const [name, setName] = useState(''), [icon, setIcon] = useState('🌱'), [color, setColor] = useState('#16a085'), [description, setDescription] = useState('');
 const [status, setStatus] = useState<NonNullable<Goal['status']>>('active');
 const [visibility, setVisibility] = useState<Goal['visibility']>('private');
 const [targetEnabled, setTargetEnabled] = useState(false), [target, setTarget] = useState('');
 const [hasDate, setHasDate] = useState(false), [targetDate, setTargetDate] = useState('');
 const [amount, setAmount] = useState(''), [account, setAccount] = useState(''), [day, setDay] = useState(today());
 const [month, setMonth] = useState(periodKey(today())), [plan, setPlan] = useState('0'), [monthly, setMonthly] = useState('0');
 const [showArchived, setShowArchived] = useState(false);
 const goals = data.goals.filter(g => allowed(g, viewer));
 const box = goals.find(g => g.id === selected);
 const accounts = data.accounts.filter(a => allowed(a, viewer) && a.currency === 'IRT');
 const events = box ? data.transactions.filter(t => t.goalId === box.id && allowed(t, viewer)) : [];
 const reserved = (accountId: string, goalId?: string) => sum(data.transactions.filter(t => active(t) && t.type === 'saving' && t.allocationOnly && t.accountId === accountId && (!goalId || t.goalId === goalId)).map(t => t.goalWithdrawal ? -t.amount : t.amount));
 const available = (accountId: string) => panel === 'withdraw' ? reserved(accountId, box?.id) : add(accounts.find(a => a.id === accountId)?.balance ?? 0, -reserved(accountId));
 const fundingAccounts = accounts.filter(a => panel !== 'withdraw' || reserved(a.id, box?.id) > 0);
 const open = (next: Panel) => {
  setError(''); setAmount(''); setDay(today());
  setAccount((next === 'withdraw' ? accounts.filter(a => reserved(a.id, box?.id) > 0) : accounts)[0]?.id ?? '');
  setName(box?.name ?? ''); setIcon(box?.icon ?? '🌱'); setColor(box?.color ?? '#16a085'); setDescription(box?.description ?? '');
  setStatus(box?.status ?? 'active'); setVisibility(box?.visibility ?? 'private');
  setTargetEnabled(!!box?.target); setTarget(box?.target ? String(box.target) : ''); setHasDate(/^\d{4}-\d{2}-\d{2}$/.test(box?.targetDate ?? '')); setTargetDate(/^\d{4}-\d{2}-\d{2}$/.test(box?.targetDate ?? '') ? box!.targetDate : '');
  setMonth(periodKey(today())); setPlan(String(box?.monthlyPlans?.[periodKey(today())] ?? box?.monthlyTarget ?? 0)); setMonthly(String(box?.monthlyTarget ?? 0));
  if (next === 'create') { setName(''); setIcon('🌱'); setColor('#16a085'); setDescription(''); setStatus('active'); setVisibility('private'); setTargetEnabled(false); setTarget(''); setHasDate(false); setTargetDate(''); }
  setPanel(next);
 };
 const submit = () => {
  try {
   if (panel === 'create' || panel === 'settings') {
    const goal: Goal = { ...(panel === 'settings' ? box : undefined), id: panel === 'settings' ? box!.id : id(), name, icon, color, description, status, visibility, owner: box?.owner ?? viewer, target: panel === 'settings' ? box!.target : targetEnabled ? integer(target) : 0, targetDate: panel === 'settings' ? box!.targetDate : targetEnabled && hasDate ? targetDate : '', saved: 0 };
    change(saveGoal(data, goal));
    if (panel === 'create') onCreated?.(goal);
   } else if (box && panel === 'goal') {
    change(saveGoal(data, { ...box, target: targetEnabled ? integer(target) : 0, targetDate: targetEnabled && hasDate ? targetDate : '' }));
   } else if (box && (panel === 'deposit' || panel === 'withdraw')) {
    if (!fundingAccounts.some(a => a.id === account)) throw new Error('حساب را انتخاب کن.');
    const value = integer(amount);
    if (value > available(account)) throw new Error(panel === 'withdraw' ? 'مبلغ از موجودی باکس در این حساب بیشتر است.' : 'پول آزاد این حساب کافی نیست.');
    change(post(data, { id: id(), title: `${panel === 'deposit' ? 'واریز به' : 'برداشت از'} باکس ${box.name}`, type: 'saving', amount: value, category: 'پس‌انداز', accountId: account, goalId: box.id, date: day, allocationOnly: true, goalWithdrawal: panel === 'withdraw', createdBy: viewer, visibility: data.accounts.find(a => a.id === account)!.visibility }));

   }
   setPanel(null); setError('');
  } catch (e) { setError((e as Error).message); }
 };
 const progress = (g: Goal) => Math.max(0, Math.min(100, g.target ? g.saved / g.target * 100 : 0));
 const heading = panel === 'create' ? 'باکس جدید' : panel === 'settings' ? 'تنظیمات باکس' : panel === 'goal' ? 'هدف باکس' : panel === 'withdraw' ? 'برداشت از باکس' : 'واریز به باکس';
 return <div className="savings-boxes">{!createOnly&&box&&<FlowBack label="بازگشت" onBack={()=>{setSelected('');setError('')}}/>}
  {!createOnly && (box ? <>

   <Surface as="section" className="card module-card ob-detail savings-box-detail">
   <DetailHero title={box.name} symbol={box.icon ?? '🌱'} amount={money(box.saved)} caption={box.description || 'موجودی باکس'} progress={progress(box)/100} metrics={[["هدف باکس",box.target>0?money(box.target):'بدون مبلغ هدف'],["مانده تا هدف",box.target>0?money(Math.max(0,box.target-box.saved)):'—']]}/>
   {box.status && box.status !== 'active' && <p className="muted">{statuses[box.status]}</p>}
   <div className="box-actions"><Action className="primary" disabled={(box.status ?? 'active') !== 'active'} onClick={() => open('deposit')}><Plus size={18}/> واریز</Action><Action className="outline" disabled={box.saved <= 0} onClick={() => open('withdraw')}><ArrowUpFromLine size={18}/> برداشت</Action><Action className="outline" aria-label="تنظیمات باکس" onClick={() => open('settings')}><Settings2 size={18}/></Action></div>
   <details className="planning-options"><summary>هدف باکس{box.targetDate ? ` · تا ${persianDate(box.targetDate)}` : ''}</summary><div className="box-option-content"><p>{box.target>0 ? `${money(Math.max(0,box.target-box.saved))} مانده تا هدف` : 'برای باکس خود هدف بگذار'}</p>{box.target>0&&<Progress aria-label="پیشرفت هدف باکس" value={progress(box)}/>}<Action className="outline" onClick={()=>open('goal')}>ویرایش هدف باکس</Action></div></details>
   <details className="planning-options box-plan" onToggle={e=>{if(e.currentTarget.open){setMonth(periodKey(today()));setPlan(String(box.monthlyPlans?.[periodKey(today())]??box.monthlyTarget??0));setMonthly(String(box.monthlyTarget??0));}}}><summary><span>برنامه پس‌انداز</span><small>{money(box.monthlyPlans?.[periodKey(today())]??box.monthlyTarget??0)} این ماه</small></summary>
    <form className="box-plan-form" onSubmit={e=>{e.preventDefault();try{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('ماه را مثل ۱۴۰۵/۰۷ وارد کن.');change(saveGoal(data,{...box,monthlyTarget:integer(monthly,true),monthlyPlans:{...box.monthlyPlans,[month]:integer(plan,true)}}));setError('');}catch(err){setError((err as Error).message);}}}>
     <FormField label="ماه برنامه (شمسی)"><FieldInput required value={month.replace('-','/')} onChange={e=>{const value=normalizeDigits(e.target.value).replace('/','-');setMonth(value);setPlan(String(box.monthlyPlans?.[value]??monthly));}}/></FormField>
     <FormField label="برنامه این ماه (تومان)"><FieldInput required inputMode="numeric" value={plan} onChange={e=>setPlan(e.target.value)}/></FormField>
     <FormField label="پیش‌فرض هر ماه (تومان)"><FieldInput required inputMode="numeric" value={monthly} onChange={e=>setMonthly(e.target.value)}/></FormField>
     <Action type="submit" className="primary">ذخیره برنامه</Action><p className="field-hint">این فقط برنامه است؛ واریز را خودت ثبت می‌کنی.</p>
    </form>
   </details>
   <section className="box-history"><h2>تراکنش‌های باکس</h2>{(box.openingSaved ?? 0) > 0 && <p className="soft-note">پس‌انداز قبلی: {money(box.openingSaved!)}؛ حساب این مبلغ در سوابق قدیمی مشخص نیست و از اینجا قابل برداشت نیست.</p>}{!events.length && <p className="empty">هنوز واریز یا برداشتی ثبت نشده است.</p>}{events.slice().sort((a,b) => b.date.localeCompare(a.date)).map(t => <div className="payment-row" key={t.id}><span className="box-feature-icon">{t.goalWithdrawal ? <ArrowUpFromLine size={20}/> : <ArrowDownToLine size={20}/>}</span><div className="row-main"><strong>{t.goalWithdrawal ? 'برداشت از باکس' : 'واریز به باکس'}</strong><small>{persianDate(t.date)} · {data.accounts.find(a => a.id === t.accountId)?.name} · {active(t) ? 'ثبت‌شده' : 'لغوشده'}</small></div><strong>{money(t.amount)}</strong>{active(t) && <Action className="outline" onClick={() => { try { change(reverse(data, t.id)); setError(''); } catch(e) { setError((e as Error).message); } }}>لغو ثبت</Action>}</div>)}</section>
   </Surface>
  </> : <>
   <div className="page-head savings-box-heading"><div><h1>باکس‌های پس‌انداز</h1><p className="muted">برای هر خواسته، یک باکس بساز.</p></div><Action className="primary" onClick={() => open('create')}><Plus size={18}/> باکس جدید</Action></div>
   <Surface className="box-total"><PiggyBank size={28}/><span>مجموع پس‌انداز</span><strong>{money(sum(goals.map(g => g.saved)))}</strong></Surface>
   <div className="obligation-tabs" aria-label="وضعیت باکس‌ها"><Action aria-pressed={!showArchived} className={!showArchived ? 'primary' : 'outline'} onClick={() => setShowArchived(false)}>باکس‌ها</Action><Action aria-pressed={showArchived} className={showArchived ? 'primary' : 'outline'} onClick={() => setShowArchived(true)}>بایگانی</Action></div>
   <div className="loan-cards">{goals.filter(g => (g.status === 'archived') === showArchived).map(g => <CollectionPreview key={g.id} kind="box" name={g.name} symbol={g.icon??'🌱'} accent={g.color} amount={money(g.saved)} footer={<><span>{g.target>0?`${money(Math.max(0,g.target-g.saved))} مانده تا هدف`:'بدون مبلغ هدف'}</span><span>{g.status==='completed'?'تکمیل‌شده':g.visibility==='shared'?'مشترک':'شخصی'}</span></>} onClick={()=>{setSelected(g.id);setError('');}}/>)}</div>
   {!goals.filter(g => (g.status === 'archived') === showArchived).length && <div className="box-empty"><PiggyBank size={48}/><h2>{showArchived ? 'باکس بایگانی‌شده‌ای نداری' : 'اولین باکست را بساز'}</h2><p>{showArchived ? 'باکس‌های بایگانی‌شده اینجا می‌آیند.' : 'مثلاً سفر، خرید خانه یا روز مبادا.'}</p>{!showArchived && <Action className="primary" onClick={() => open('create')}>ساخت باکس</Action>}</div>}
  </>)}
  {error && !panel && <p role="alert" className="form-error">{error}</p>}
  {panel && <Dialog title={heading} className="planning-editor-dialog" onClose={() => { setPanel(null); setError(''); if (createOnly) onCancel?.(); }}><form className="finance-form planning-form transaction-composer" onSubmit={e => { e.preventDefault(); submit(); }}><ComposerIntro kind={panel==='create'?'box':panel==='settings'?'box-settings':panel==='deposit'?'box-deposit':panel==='withdraw'?'box-withdraw':'goal'}/>
   {(panel === 'create' || panel === 'settings') && <><FormField label="نام باکس"><FieldInput required placeholder="مثلاً سفر" value={name} onChange={e => setName(e.target.value)}/></FormField><EmojiPicker label="نماد باکس" value={icon} onChange={setIcon} choices={icons}/><details className="planning-options"><summary>تنظیمات بیشتر</summary><div className="finance-form"><FormField label="توضیح (اختیاری)"><FieldInput value={description} onChange={e => setDescription(e.target.value)}/></FormField><FormField label="رنگ باکس"><FieldInput type="color" value={color} onChange={e => setColor(e.target.value)}/></FormField><FormField label="نمایش باکس"><FieldSelect value={visibility} onChange={e => setVisibility(e.target.value as Goal['visibility'])}><option value="private">شخصی</option><option value="shared">مشترک</option></FieldSelect></FormField>{panel === 'settings' && <FormField label="وضعیت"><FieldSelect value={status} onChange={e => setStatus(e.target.value as typeof status)}>{Object.entries(statuses).map(([v,n]) => <option value={v} key={v}>{n}</option>)}</FieldSelect></FormField>}</div></details></>}
   {(panel === 'create' || panel === 'goal') && <><label className="check-row"><FieldInput type="checkbox" checked={targetEnabled} onChange={e => setTargetEnabled(e.target.checked)}/> برای این باکس هدف دارم</label>{targetEnabled && <><FormField label="مبلغ هدف (تومان)"><FieldInput required inputMode="numeric" value={target} onChange={e => setTarget(e.target.value)}/></FormField><label className="check-row"><FieldInput type="checkbox" checked={hasDate} onChange={e => { setHasDate(e.target.checked); if (!targetDate) setTargetDate(today()); }}/> تاریخ هدف را مشخص می‌کنم</label>{hasDate && <DateField label="تاریخ هدف" value={targetDate} onChange={setTargetDate}/>}</>}</>}
   {(panel === 'deposit' || panel === 'withdraw') && <><p className="field-hint">{panel === 'deposit' ? 'این مبلغ از پول آزاد حساب برای باکس کنار گذاشته می‌شود.' : 'این مبلغ از باکس آزاد می‌شود و دوباره قابل خرج‌کردن است.'} پول در همان حساب می‌ماند.</p><label className="field">{panel === 'deposit' ? 'از کدام حساب؟' : 'پول باکس در کدام حساب است؟'}<FieldSelect required value={account} onChange={e => setAccount(e.target.value)}><option value="">انتخاب حساب</option>{fundingAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</FieldSelect></label>{account && <p className="field-hint">{panel === 'deposit' ? 'پول آزاد حساب' : 'قابل برداشت از این حساب'}: {money(available(account))}</p>}{!fundingAccounts.length && <p role="status">{panel === 'deposit' ? 'ابتدا یک حساب تومانی ثبت کن.' : 'واریز قابل برداشت در حساب‌های شما ثبت نشده است.'}</p>}<FormField label="مبلغ (تومان)"><FieldInput required inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}/></FormField><DateField value={day} onChange={setDay}/></>}

   {error && <p className="form-error" role="alert">{error}</p>}<div className="planning-footer"><p className="composer-receipt">{panel==='deposit'?'کنارگذاشتن پول در همین حساب':panel==='withdraw'?'آزادشدن پول باکس در همین حساب':'تنظیمات و برنامه باکس'}</p><Action className="primary full" disabled={(panel === 'deposit' || panel === 'withdraw') && !fundingAccounts.length}>{panel === 'create' ? 'ساخت باکس' : panel === 'deposit' ? 'ثبت واریز' : panel === 'withdraw' ? 'ثبت برداشت' : 'ذخیره'}</Action></div>
  </form></Dialog>}
 </div>;
}
