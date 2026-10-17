import { useRef, useState } from 'react';
import type { Account } from '../types';
import { integer } from '../decimal';
import { Action, FieldInput, FieldSelect } from './finance-ui';
import { FormField } from './form-fields';
import { ComposerFooter } from './transaction-composer';

export function ComposerAccountForm({viewer,onSave,onCancel}:{viewer:string;onSave:(account:Account)=>void;onCancel:()=>void}) {
 const [name,setName]=useState(''),[amount,setAmount]=useState('0'),[type,setType]=useState('حساب بانکی'),[visibility,setVisibility]=useState<Account['visibility']>('shared'),[error,setError]=useState('');
 const submitted=useRef(false);
 const [id]=useState(()=>crypto.randomUUID());
 return <form className="finance-form" onSubmit={event=>{
  event.preventDefault();
  if(submitted.current)return;
  try {
   if(!name.trim())throw new Error('نام حساب را وارد کن.');
   const balance=integer(amount,true);
   submitted.current=true;
   onSave({id,name:name.trim(),type,balance,openingBalance:balance,baselineAt:new Date().toISOString(),currency:'IRT',visibility,owner:viewer});
  } catch(cause) { submitted.current=false;setError((cause as Error).message); }
 }}>
  <h3>افزودن حساب</h3>
  <FormField label="نام حساب"><FieldInput required value={name} onChange={e=>setName(e.target.value)}/></FormField>
  <FormField label="موجودی اولیه به تومان"><FieldInput required inputMode="numeric" min={0} value={amount} onChange={e=>setAmount(e.target.value)}/></FormField>
  <FormField label="نوع حساب"><FieldSelect value={type} onChange={e=>setType(e.target.value)}>{['حساب بانکی','نقدی','حساب پس‌انداز','حساب مشترک','سایر'].map(item=><option key={item}>{item}</option>)}</FieldSelect></FormField>
  <FormField label="نمایش"><FieldSelect value={visibility} onChange={e=>setVisibility(e.target.value as Account['visibility'])}><option value="shared">مشترک</option><option value="private">خصوصی</option></FieldSelect></FormField>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <Action type="button" className="outline" onClick={onCancel}>بازگشت به خرید ارزی</Action>
  <ComposerFooter summary="حساب جدید پس از ثبت برای پرداخت خرید انتخاب می‌شود."><Action type="submit" className="primary full submit">ثبت حساب</Action></ComposerFooter>
 </form>;
}
