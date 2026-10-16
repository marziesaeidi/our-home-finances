import { EmojiPicker } from './components/emoji-picker';
import { AppIcon } from './components/app-icon';
import { FlowBack } from './components/flow-navigation';
import { FormField } from './components/form-fields';
import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, Plus, PiggyBank, Flag, Settings2, CalendarDays } from 'lucide-react';
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
type Panel = 'create' | 'settings' | 'goal' | 'deposit' | 'withdraw' | 'plan' | null;
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
   } else if (box && panel === 'plan') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('ماه را مثل ۱۴۰۵/۰۷ وارد کن.');
    change(saveGoal(data, { ...box, monthlyTarget: integer(monthly, true), monthlyPlans: { ...box.monthlyPlans, [month]: integer(plan, true) } }));
   }
   setPanel(null); setError('');
  } catch (e) { setError((e as Error).message); }
 };
 const progress = (g: Goal) => Math.max(0, Math.min(100, g.target ? g.saved / g.target * 100 : 0));
 const heading = panel === 'create' ? 'باکس جدید' : panel === 'settings' ? 'تنظیمات باکس' : panel === 'goal' ? 'هدف باکس' : panel === 'plan' ? 'برنامه پس‌انداز' : panel === 'withdraw' ? 'برداشت از باکس' : 'واریز به باکس';
 return <div className="savings-boxes">{!createOnly&&(panel||box)&&<FlowBack label="بازگشت" onBack={()=>{if(panel)setPanel(null);else setSelected('');setError('')}}/>}
  {!createOnly && (box ? <>
   <Action className="outline box-back" onClick={() => { setSelected(''); setError(''); }}><ChevronLeft size={18}/> همه باکس‌ها</Action>
   <header className="box-hero"><span className="box-symbol" style={{ background: `${box.color ?? '#16a085'}18` }}><AppIcon symbol={box.icon ?? '🌱'}/></span><h1>{box.name}</h1><strong>{money(box.saved)}</strong><p>موجودی باکس</p>{box.description && <p>{box.description}</p>}{box.status && box.status !== 'active' && <span>{statuses[box.status]}</span>}</header>
   <div className="box-actions"><Action className="primary" disabled={(box.status ?? 'active') !== 'active'} onClick={() => open('deposit')}><Plus size={18}/> واریز</Action><Action className="outline" disabled={box.saved <= 0} onClick={() => open('withdraw')}><ArrowUpFromLine size={18}/> برداشت</Action><Action className="outline" aria-label="تنظیمات باکس" onClick={() => open('settings')}><Settings2 size={18}/></Action></div>
   <Surface as="button" className="box-feature" onClick={() => open('goal')}><span className="box-feature-icon"><Flag/></span><span className="box-feature-copy"><strong>هدف باکس</strong>{box.target > 0 ? <><span>{money(box.target)}</span><small>{money(Math.max(0, box.target - box.saved))} مانده تا هدف</small></> : <span>برای باکس خود هدف بگذار</span>}</span>{box.target > 0 ? <span className="box-ring" style={{ '--box-progress': `${progress(box)}%` } as import('react').CSSProperties}>{Math.floor(progress(box)).toLocaleString('fa-IR')}٪</span> : <Plus/>}</Surface>
   {box.target > 0 && <progress className="savings-progress" aria-label="پیشرفت هدف باکس" value={Math.min(box.saved, box.target)} max={box.target}/>}
   {box.targetDate && <p className="muted">تا {persianDate(box.targetDate)}</p>}
   <Surface as="button" className="box-feature" onClick={() => open('plan')}><span className="box-feature-icon"><CalendarDays/></span><span className="box-feature-copy"><strong>برنامه پس‌انداز</strong><span>{(box.monthlyPlans?.[periodKey(today())] ?? box.monthlyTarget ?? 0) > 0 ? `${money(box.monthlyPlans?.[periodKey(today())] ?? box.monthlyTarget ?? 0)} برای این ماه` : 'هر ماه چقدر کنار می‌گذاری؟'}</span></span><ChevronLeft/></Surface>
   <section className="box-history"><h2>تراکنش‌های باکس</h2>{(box.openingSaved ?? 0) > 0 && <p className="soft-note">پس‌انداز قبلی: {money(box.openingSaved!)}؛ حساب این مبلغ در سوابق قدیمی مشخص نیست و از اینجا قابل برداشت نیست.</p>}{!events.length && <p className="empty">هنوز واریز یا برداشتی ثبت نشده است.</p>}{events.slice().sort((a,b) => b.date.localeCompare(a.date)).map(t => <div className="payment-row" key={t.id}><span className="box-feature-icon">{t.goalWithdrawal ? <ArrowUpFromLine size={20}/> : <ArrowDownToLine size={20}/>}</span><div className="row-main"><strong>{t.goalWithdrawal ? 'برداشت از باکس' : 'واریز به باکس'}</strong><small>{persianDate(t.date)} · {data.accounts.find(a => a.id === t.accountId)?.name} · {active(t) ? 'ثبت‌شده' : 'لغوشده'}</small></div><strong>{money(t.amount)}</strong>{active(t) && <Action className="outline" onClick={() => { try { change(reverse(data, t.id)); setError(''); } catch(e) { setError((e as Error).message); } }}>لغو ثبت</Action>}</div>)}</section>
  </> : <>
   <div className="section-heading"><div><h1>باکس‌های پس‌انداز</h1><p className="muted">برای هر خواسته، یک باکس بساز.</p></div><Action className="primary" onClick={() => open('create')}><Plus size={18}/> باکس جدید</Action></div>
   <Surface className="box-total"><PiggyBank size={28}/><span>مجموع پس‌انداز</span><strong>{money(sum(goals.map(g => g.saved)))}</strong></Surface>
   <div className="segment"><Action className={!showArchived ? 'selected' : ''} onClick={() => setShowArchived(false)}>باکس‌ها</Action><Action className={showArchived ? 'selected' : ''} onClick={() => setShowArchived(true)}>بایگانی</Action></div>
   <div className="box-grid">{goals.filter(g => (g.status === 'archived') === showArchived).map(g => <Surface as="button" className="box-card" key={g.id} onClick={() => { setSelected(g.id); setError(''); }}><span className="box-symbol" style={{ background: `${g.color ?? '#16a085'}18` }}><AppIcon symbol={g.icon ?? '🌱'}/></span><span className="box-feature-copy"><strong>{g.name}</strong><b>{money(g.saved)}</b><small>{g.target > 0 ? `${money(Math.max(0, g.target - g.saved))} مانده تا هدف` : 'بدون مبلغ هدف'}{g.status === 'completed' ? ' · تکمیل‌شده' : ''}</small></span><ChevronLeft/>{g.target > 0 && <progress aria-label={`پیشرفت ${g.name}`} max={g.target} value={Math.min(g.saved, g.target)}/>}</Surface>)}</div>
   {!goals.filter(g => (g.status === 'archived') === showArchived).length && <div className="box-empty"><PiggyBank size={48}/><h2>{showArchived ? 'باکس بایگانی‌شده‌ای نداری' : 'اولین باکست را بساز'}</h2><p>{showArchived ? 'باکس‌های بایگانی‌شده اینجا می‌آیند.' : 'مثلاً سفر، خرید خانه یا روز مبادا.'}</p>{!showArchived && <Action className="primary" onClick={() => open('create')}>ساخت باکس</Action>}</div>}
  </>)}
  {error && !panel && <p role="alert" className="form-error">{error}</p>}
  {panel && <Dialog title={heading} onClose={() => { setPanel(null); setError(''); if (createOnly) onCancel?.(); }}><form className="finance-form" onSubmit={e => { e.preventDefault(); submit(); }}>
   {(panel === 'create' || panel === 'settings') && <><FormField label="نام باکس"><FieldInput required placeholder="مثلاً سفر" value={name} onChange={e => setName(e.target.value)}/></FormField><EmojiPicker label="نماد باکس" value={icon} onChange={setIcon} choices={icons}/><details><summary>تنظیمات بیشتر</summary><div className="finance-form"><FormField label="توضیح (اختیاری)"><FieldInput value={description} onChange={e => setDescription(e.target.value)}/></FormField><FormField label="رنگ باکس"><FieldInput type="color" value={color} onChange={e => setColor(e.target.value)}/></FormField><FormField label="نمایش باکس"><FieldSelect value={visibility} onChange={e => setVisibility(e.target.value as Goal['visibility'])}><option value="private">شخصی</option><option value="shared">مشترک</option></FieldSelect></FormField>{panel === 'settings' && <FormField label="وضعیت"><FieldSelect value={status} onChange={e => setStatus(e.target.value as typeof status)}>{Object.entries(statuses).map(([v,n]) => <option value={v} key={v}>{n}</option>)}</FieldSelect></FormField>}</div></details></>}
   {(panel === 'create' || panel === 'goal') && <><label className="check-row"><FieldInput type="checkbox" checked={targetEnabled} onChange={e => setTargetEnabled(e.target.checked)}/> برای این باکس هدف دارم</label>{targetEnabled && <><FormField label="مبلغ هدف (تومان)"><FieldInput required inputMode="numeric" value={target} onChange={e => setTarget(e.target.value)}/></FormField><label className="check-row"><FieldInput type="checkbox" checked={hasDate} onChange={e => { setHasDate(e.target.checked); if (!targetDate) setTargetDate(today()); }}/> تاریخ هدف را مشخص می‌کنم</label>{hasDate && <DateField label="تاریخ هدف" value={targetDate} onChange={setTargetDate}/>}</>}</>}
   {(panel === 'deposit' || panel === 'withdraw') && <><p className="field-hint">{panel === 'deposit' ? 'این مبلغ از پول آزاد حساب برای باکس کنار گذاشته می‌شود.' : 'این مبلغ از باکس آزاد می‌شود و دوباره قابل خرج‌کردن است.'} پول در همان حساب می‌ماند.</p><label className="field">{panel === 'deposit' ? 'از کدام حساب؟' : 'پول باکس در کدام حساب است؟'}<FieldSelect required value={account} onChange={e => setAccount(e.target.value)}><option value="">انتخاب حساب</option>{fundingAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</FieldSelect></label>{account && <p className="field-hint">{panel === 'deposit' ? 'پول آزاد حساب' : 'قابل برداشت از این حساب'}: {money(available(account))}</p>}{!fundingAccounts.length && <p role="status">{panel === 'deposit' ? 'ابتدا یک حساب تومانی ثبت کن.' : 'واریز قابل برداشت در حساب‌های شما ثبت نشده است.'}</p>}<FormField label="مبلغ (تومان)"><FieldInput required inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}/></FormField><DateField value={day} onChange={setDay}/></>}
   {panel === 'plan' && <><p className="field-hint">این فقط برنامه است؛ واریز را خودت ثبت می‌کنی.</p><FormField label="برنامه هر ماه (تومان)"><FieldInput required inputMode="numeric" value={monthly} onChange={e => setMonthly(e.target.value)}/></FormField><FormField label="ماه دلخواه (مثلاً ۱۴۰۵/۰۷)"><FieldInput required value={month.replace('-', '/')} onChange={e => { const value = normalizeDigits(e.target.value).replace('/', '-'); setMonth(value); setPlan(String(box?.monthlyPlans?.[value] ?? monthly)); }}/></FormField><FormField label="برنامه این ماه (تومان)"><FieldInput required inputMode="numeric" value={plan} onChange={e => setPlan(e.target.value)}/></FormField></>}
   {error && <p className="form-error" role="alert">{error}</p>}<Action className="primary full" disabled={(panel === 'deposit' || panel === 'withdraw') && !fundingAccounts.length}>{panel === 'create' ? 'ساخت باکس' : panel === 'deposit' ? 'ثبت واریز' : panel === 'withdraw' ? 'ثبت برداشت' : 'ذخیره'}</Action>
  </form></Dialog>}
 </div>;
}
