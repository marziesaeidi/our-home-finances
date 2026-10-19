import { ErrorNotice } from './components/error-notice';
import { EmojiPicker } from './components/emoji-picker';
import { AppIcon } from './components/app-icon';
import { FormField } from './components/form-fields';
import { Dialog } from './Dialog';
import { FlowBack } from './components/flow-navigation';

import { Surface, FieldInput, Action, AddAction, FieldSelect } from './components/finance-ui';
import { useState } from 'react';
import type { Category, FinanceData } from './types';
import { currencies } from './currencies';
import { saveCategory, deleteCategory } from './personalization';


export function Personalization({ data, change }: { data: FinanceData; change: (d: FinanceData | ((d: FinanceData) => FinanceData)) => void }) {
  const [categoryFlow, setCategoryFlow] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [name, setName] = useState(data.settings.name), [message, setMessage] = useState('');
  const setting = (next: Partial<FinanceData['settings']>) => { try { change(d => ({ ...d, settings: { ...d.settings, ...next } })); setMessage('تنظیمات ذخیره شد.'); } catch (error) { setMessage((error as Error).message); } };
  if (categoryFlow) {
    const category = data.categoryRecords.find(c => c.id === editingCategory);
    const editing = editingCategory !== null;
    const back = () => editing ? setEditingCategory(null) : setCategoryFlow(false);
    return <Surface as="section" className="card module-card collection-card">
      <FlowBack title={editing ? category ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی' : 'دسته‌بندی‌های درآمد و هزینه'} label={editing ? 'بازگشت به دسته‌بندی‌ها' : 'بازگشت به تنظیمات'} onBack={back}/>
      <h2>{editing ? category ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی' : 'دسته‌بندی‌های درآمد و هزینه'}</h2>
      {editing ? <CategoryEditor key={editingCategory} data={data} change={change} category={category} onDone={() => setEditingCategory(null)}/> : <div className="category-settings-list">
        <AddAction onClick={() => setEditingCategory('new')}>افزودن دسته‌بندی</AddAction>
        {data.categoryRecords.map(c => <div className="category-settings-row" key={c.id}><span><span style={{color:c.color}}><AppIcon symbol={c.icon}/></span> {c.name}{c.archived ? ' (بایگانی)' : ''}</span><Action className="outline small" aria-label={`ویرایش ${c.name}`} onClick={() => setEditingCategory(c.id)}>ویرایش</Action></div>)}
      </div>}

    </Surface>;
  }
  return <><Surface as="section" className="card module-card collection-card"><h2>ظاهر و ترجیحات</h2><form className="finance-form" onSubmit={e => { e.preventDefault(); if (!name.trim()) { setMessage('نام لازم است.'); return; } setting({ name: name.trim() }); }}><FormField label="نام فضای مالی"><FieldInput required value={name} onChange={e => setName(e.target.value)}/></FormField><Action className="primary">ذخیره نام</Action></form><FormField label="ظاهر برنامه"><FieldSelect value={data.settings.theme} onChange={e => setting({ theme: e.target.value as 'light' | 'dark' })}><option value="light">روشن</option><option value="dark">تیره</option></FieldSelect></FormField><FormField label="ارز پیش‌فرض فرم‌های چندارزی"><FieldSelect value={data.settings.preferredCurrency ?? 'USD'} onChange={e => setting({ preferredCurrency: e.target.value })}>{[...currencies, ...data.currencyDefinitions ?? []].map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</FieldSelect></FormField><p className="field-hint">این انتخاب فقط ارز پیش‌فرض فرم‌هاست؛ گزارش‌ها همچنان به تومان هستند.</p><FormField label="تقویم تاریخ‌ها"><FieldSelect value={data.settings.calendar ?? 'persian'} onChange={e => setting({ calendar: e.target.value as 'persian' | 'gregory' })}><option value="persian">شمسی</option><option value="gregory">میلادی</option></FieldSelect></FormField><p className="field-hint">دوره بودجه و موعد ماهانه همیشه شمسی است.</p><p className="field-hint">مبلغ‌ها و تاریخ‌ها با ارقام فارسی نمایش داده می‌شوند.</p>{message && <p role="status">{message}</p>}</Surface><Surface as="section" className="card module-card collection-card"><Action className="outline full" onClick={() => setCategoryFlow(true)}>دسته‌بندی‌های درآمد و هزینه</Action></Surface></>;
}

export function CategoryEditor({ data, change, category, initialKind = 'both', onDone }: { initialKind?: Category['kind']; onDone?: (name?: string) => void; data: FinanceData; change: (d: FinanceData | ((d: FinanceData) => FinanceData)) => void; category?: Category }) {
  const [name, setName] = useState(category?.name ?? ''), [icon, setIcon] = useState(category?.icon ?? '◌'), [color, setColor] = useState(category?.color ?? '#258575'), [kind, setKind] = useState<Category['kind']>(category?.kind ?? initialKind), [error, setError] = useState('');
  const [confirmDelete,setConfirmDelete]=useState(false);
  const count=category?data.transactions.filter(t=>t.categoryId===category.id||!t.categoryId&&t.category===category.name).length:0;
  return <details open={onDone?true:undefined} className="module-editor category-settings-editor"><summary hidden={!!onDone}>{category ? `${category.name}${category.archived ? ' (بایگانی)' : ''}` : 'افزودن دسته'}</summary><form className="finance-form" onSubmit={e => { e.preventDefault(); try { change(d => saveCategory(d, { id: category?.id ?? crypto.randomUUID(), name, icon, color, kind, archived: category?.archived ?? false })); if (!category) setName(''); setError('ذخیره شد.'); onDone?.(name.trim()); } catch (err) { setError((err as Error).message); } }}><FormField label="نام"><FieldInput required maxLength={80} value={name} onChange={e => setName(e.target.value)}/></FormField><EmojiPicker label="آیکن دسته‌بندی" value={icon} onChange={setIcon}/><FormField label="رنگ"><FieldInput type="color" value={color} onChange={e => setColor(e.target.value)}/></FormField><FormField label="نوع"><FieldSelect value={kind} onChange={e => setKind(e.target.value as Category['kind'])}><option value="both">درآمد و هزینه</option><option value="expense">هزینه</option><option value="income">درآمد</option></FieldSelect></FormField><div className="detail-actions"><Action className="primary">ذخیره دسته</Action>{category && <Action type="button" className="outline" disabled={!category.archived && data.categoryRecords.filter(c => !c.archived).length <= 1} onClick={() => { try { change(d => saveCategory(d, { ...category, archived: !category.archived })); } catch (err) { setError((err as Error).message); } }}>{category.archived ? 'بازگردانی' : 'بایگانی'}</Action>}{category&&<Action type="button" className="danger" onClick={()=>setConfirmDelete(true)}>حذف دسته‌بندی</Action>}</div>{error && (error==='ذخیره شد.'?<p role="status">{error}</p>:<ErrorNotice message={error}/>)}</form>{confirmDelete&&category&&<Dialog title="حذف دسته‌بندی" onClose={()=>setConfirmDelete(false)}><p>{count?`با دسته‌بندی «${category.name}» ${count} تراکنش ثبت کرده‌ای. مطمئنی می‌خواهی حذفش کنی؟ با حذف این دسته‌بندی تمام تراکنش‌های مربوط به آن نیز حذف می‌شوند و اثرشان از موجودی و گزارش‌ها برداشته می‌شود.`:`دسته‌بندی «${category.name}» حذف شود؟`}</p><p>بودجه و پرداخت‌های دوره‌ای این دسته‌بندی نیز حذف می‌شوند.</p><Action type="button" className="outline" onClick={()=>setConfirmDelete(false)}>انصراف</Action><Action type="button" className="danger" onClick={()=>{try{change(d=>deleteCategory(d,category.id));setConfirmDelete(false);onDone?.()}catch(err){setConfirmDelete(false);setError((err as Error).message)}}}>تأیید حذف</Action></Dialog>}</details>;
}

export function CategoryFlow({data,change,kind,onDone}:{data:FinanceData;change:(d:FinanceData)=>void;kind:'expense'|'income';onDone:(name?:string)=>void}) {
 return <Surface as="section" className="card module-card collection-card"><FlowBack title="افزودن دسته‌بندی" label="بازگشت به ثبت تراکنش" onBack={()=>onDone()}/><h2>تنظیمات دسته‌بندی جدید</h2><CategoryEditor data={data} change={next=>change(typeof next==='function'?next(data):next)} initialKind={kind} onDone={onDone}/><Action className="outline" onClick={()=>onDone()}>انصراف و بازگشت</Action></Surface>;
}
