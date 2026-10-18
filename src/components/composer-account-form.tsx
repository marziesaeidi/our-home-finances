import { useRef, useState } from 'react';
import type { Account } from '../types';
import { integer } from '../decimal';
import { Action, FieldInput, FieldSelect } from './finance-ui';
import { FormField } from './form-fields';
import { FlowBack } from './flow-navigation';
import { ComposerIntro, ComposerFooter } from './transaction-composer';

export function ComposerAccountForm({viewer,onSave,onCancel,cancelLabel='بازگشت به خرید ارزی'}:{viewer:string;onSave:(account:Account)=>void;onCancel?:()=>void;cancelLabel?:string}) {
 const [name,setName]=useState(''),[amount,setAmount]=useState('0'),[type,setType]=useState('حساب بانکی'),[visibility,setVisibility]=useState<Account['visibility']>('shared'),[error,setError]=useState('');
 const submitted=useRef(false);
 const [id]=useState(()=>crypto.randomUUID());
 return <form className="finance-form transaction-composer account-composer" onSubmit={event=>{
  event.preventDefault();
  if(submitted.current)return;
  try {
   if(!name.trim())throw new Error('نام حساب را وارد کن.');
   const balance=integer(amount,true);
   submitted.current=true;
   onSave({id,name:name.trim(),type,balance,openingBalance:balance,baselineAt:new Date().toISOString(),currency:'IRT',visibility,owner:viewer});
  } catch(cause) { submitted.current=false;setError((cause as Error).message); }
 }}>
  <>{onCancel&&<FlowBack label={cancelLabel} onBack={onCancel}/>}<ComposerIntro kind="account"/></>
  <FormField label="نام حساب"><FieldInput required placeholder="مثلاً حساب بلو یا پول نقد" value={name} onChange={e=>setName(e.target.value)}/></FormField>
  <FormField label="موجودی اولیه به تومان"><FieldInput required inputMode="numeric" min={0} value={amount} onChange={e=>setAmount(e.target.value)}/></FormField>
  <p className="field-hint">موجودی فعلی حساب را وارد کن؛ این مبلغ درآمد جدید نیست. حساب بدون موجودی را با صفر ثبت کن.</p>
  <details className="planning-options"><summary>نوع حساب و دسترسی اعضا</summary><FormField label="نوع حساب"><FieldSelect value={type} onChange={e=>setType(e.target.value)}>{['حساب بانکی','نقدی','حساب پس‌انداز','حساب مشترک','سایر'].map(item=><option key={item}>{item}</option>)}</FieldSelect></FormField>
  <FormField label="نمایش"><FieldSelect value={visibility} onChange={e=>setVisibility(e.target.value as Account['visibility'])}><option value="shared">مشترک</option><option value="private">خصوصی</option></FieldSelect></FormField>
  </details>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <ComposerFooter summary={`${name||'حساب جدید'} · ${visibility==='shared'?'مشترک':'شخصی'} · موجودی اولیه به تومان`}><Action type="submit" className="primary full submit">ثبت حساب</Action>{onCancel&&<Action type="button" className="outline full" onClick={onCancel}>انصراف</Action>}</ComposerFooter>
 </form>;
}
