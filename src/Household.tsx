import { useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { Surface, Action, FieldInput, FieldSelect } from './components/finance-ui';
import { FormField } from './components/form-fields';
import { Dialog } from './Dialog';
import type { FinanceData, HouseholdMember } from './types';

import { membersOf } from './household-access';
export function Household({data,viewer,change}:{data:FinanceData;viewer:string;change:(fn:(d:FinanceData)=>FinanceData)=>void}) {
 const [name,setName]=useState(''),[message,setMessage]=useState(''),[removing,setRemoving]=useState<HouseholdMember|null>(null);
 const members=membersOf(data), owner=members.some(m=>m.id===viewer&&m.role==='owner'&&!m.removed);
 function update(fn:(members:HouseholdMember[])=>HouseholdMember[]) { try { change(d=>({...d,settings:{...d.settings,members:fn(membersOf(d))}}));setMessage('تغییرات ذخیره شد.'); } catch(e) {setMessage((e as Error).message);} }
 async function photo(member:HouseholdMember,file?:File) {
  if(!file)return;
  try { if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>300000)throw new Error('عکس JPG، PNG یا WebP تا ۳۰۰ کیلوبایت انتخاب کن.');
   const value=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});
   update(rows=>rows.map(m=>m.id===member.id?{...m,avatar:value}:m));
  }catch(e){setMessage((e as Error).message);}
 }
 return <><div className="page-head"><div><h1>فضای مشترک</h1><p>اعضا و دسترسی‌های فضای مالی را مدیریت کن.</p></div></div>
 <Surface as="section" className="card module-card collection-card household-summary"><span className="navigation-card-icon"><Users/></span><div><h2>{data.settings.name}</h2><p>{members.filter(m=>!m.removed).length.toLocaleString('fa-IR')} عضو · حساب‌ها و برنامه‌های مشترک در یک جا</p></div></Surface>
 <div className="section-heading"><h2>اعضای فضای مشترک</h2></div><div className="member-card-grid">{members.filter(m=>!m.removed).map(m=><Surface as="section" className="card module-card collection-card" key={m.id}><div className="member-profile"><span className="avatar">{m.avatar?<img src={m.avatar} alt=""/>:m.name.slice(0,1)}</span><div><h3>{m.name}</h3><small>{m.role==='owner'?'مالک':m.role==='reader'?'فقط مشاهده':'ثبت و ویرایش'}</small></div></div>
 {(owner||viewer===m.id)&&<div className="member-photo"><span>تصویر پروفایل</span><label className="profile-upload">انتخاب تصویر<FieldInput aria-label={`تصویر پروفایل ${m.name}`} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{void photo(m,e.target.files?.[0]);e.target.value='';}}/></label></div>}
 {owner&&m.role!=='owner'&&<><FormField label="دسترسی"><FieldSelect value={m.role} onChange={e=>update(rows=>rows.map(row=>row.id===m.id?{...row,role:e.target.value as 'editor'|'reader'}:row))}><option value="editor">ثبت و ویرایش</option><option value="reader">فقط مشاهده</option></FieldSelect></FormField><Action className="danger" onClick={()=>setRemoving(m)}>حذف عضو</Action></>}
 </Surface>)}</div>
 {owner&&<Surface as="section" className="card module-card collection-card"><h2>افزودن عضو</h2><form className="finance-form" onSubmit={e=>{e.preventDefault();const trimmed=name.trim();if(!trimmed)return;if(members.some(m=>m.name===trimmed)){setMessage('عضوی با این نام وجود دارد.');return;}update(rows=>[...rows,{id:trimmed,name:trimmed,role:'editor'}]);setName('');}}><FormField label="نام عضو"><FieldInput required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></FormField><Action className="primary"><Plus size={18}/>افزودن عضو</Action></form><p className="field-hint">عضو به همین مرورگر اضافه می‌شود. اتصال اعضا از دستگاه‌های دیگر هنوز فعال نیست.</p></Surface>}
 {message&&<p role="status">{message}</p>}{removing&&<Dialog title="حذف عضو" onClose={()=>setRemoving(null)}><p>دسترسی {removing.name} به این فضا حذف شود؟ سوابق مالی او حفظ می‌شود.</p><Action className="outline" onClick={()=>setRemoving(null)}>انصراف</Action><Action className="danger" onClick={()=>{update(rows=>rows.map(m=>m.id===removing.id?{...m,removed:true}:m));setRemoving(null);}}>حذف عضو</Action></Dialog>}</>;
}
