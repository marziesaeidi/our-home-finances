import { ErrorNotice } from './components/error-notice';
import {useEffect,useState} from 'react';
import {ArrowLeft, Check, Clock3, ShieldCheck, Users} from 'lucide-react';
import {Action,FieldSelect} from './components/finance-ui';
import {FormField} from './components/form-fields';
import { AccessShell } from './AccessShell';
import type { HouseholdMember } from './types';
import { activeSpace, api, fetchSession, remoteRequest, setActiveSpace, type Session } from './remote-store';

type Status='none'|'pending'|'approved'|'rejected';

// Works for everyone holding the link: visitors are sent to log in or sign up first, then come back here.
export function InvitationAccess({token}:{token:string}){
 const [session,setSession]=useState<Session|null>(null),[status,setStatus]=useState<Status>('none'),[spaceId,setSpaceId]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{fetchSession().then(result=>{if(!result){location.replace('/login?next='+encodeURIComponent(location.pathname));return;}setSession(result);}).catch(e=>setError((e as Error).message));},[]);
 async function check(){try{const result=await api('/api/invitations/status',{token});setStatus(result.status);if(result.spaceId)setSpaceId(result.spaceId);setError('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{if(!session)return;void check();if(status!=='pending'&&status!=='none')return;const timer=setInterval(()=>{void check()},10000);return()=>clearInterval(timer)},[session,status]);
 async function join(){setBusy(true);setError('');try{const result=await api('/api/invitations/join',{token});setStatus(result.status);setSpaceId(result.spaceId);}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function enter(){const fresh=await fetchSession();const space=fresh?.spaces.find(s=>s.id===spaceId);if(fresh&&space)setActiveSpace(fresh.user.id,space);location.assign('/app');}
 if(!session)return <AccessShell><section className="access-card"><p role="status">{error||'در حال بررسی ورود…'}</p></section></AccessShell>;
 const title=status==='approved'?'درخواستت تأیید شد':status==='rejected'?'درخواست تأیید نشد':status==='pending'?'درخواستت ارسال شد':`${session.user.name}، به فضای مشترک دعوت شده‌ای`;
 const description=status==='approved'?'حالا می‌توانی وارد فضای مشترک شوی.':status==='rejected'?'برای اطلاعات بیشتر با مالک فضا در تماس باش.':status==='pending'?'به محض تأیید مالک، از همین صفحه می‌توانی وارد فضای مشترک شوی.':'با ارسال درخواست، نام و ایمیل حسابت برای مالک فضا نمایش داده می‌شود و پس از تأیید او به فضا دسترسی پیدا می‌کنی.';
 return <AccessShell><section className="access-card" aria-labelledby="access-title"><div className="access-icon">{status==='none'?<Users/>:<Clock3/>}</div><span className="access-eyebrow">دعوت به فضای مشترک</span><h2 id="access-title">{title}</h2><p className="access-description">{description}</p>
  {status==='none'?<><div className="access-note"><ShieldCheck size={20}/><p>ورود فقط پس از تأیید مالک فعال می‌شود.<br/><small>وارد شده با <span dir="ltr">{session.user.email}</span></small></p></div><Action className="primary full access-submit" style={{marginTop:20}} disabled={busy} onClick={join}>{busy?'در حال ارسال…':'ارسال درخواست عضویت'}<ArrowLeft size={18}/></Action></>
  :<div className="access-pending" role="status"><div><Check size={18}/> ارسال درخواست</div><div><Clock3 size={18}/> {status==='pending'?'در انتظار تأیید مالک':status==='approved'?'تأیید مالک دریافت شد':'درخواست رد شد'}</div>{status==='approved'&&<Action className="primary full" onClick={()=>void enter()}>ورود به فضای مشترک <ArrowLeft size={18}/></Action>}{status==='pending'&&<p className="access-consent">این صفحه هر ۱۰ ثانیه وضعیت درخواست را بررسی می‌کند.</p>}</div>}
  {error&&<ErrorNotice message={error}/>}<footer className="access-card-foot"><ShieldCheck size={15}/> <a href="/app">رفتن به فضای خودم</a></footer></section></AccessShell>;
}

export function AccessRequests({owner,onOpen}:{owner:boolean;onOpen?:()=>void}){
 const household=activeSpace()?.kind==='household';
 const [requests,setRequests]=useState<{id:string;name:string;email:string}[]>([]),[unlinked,setUnlinked]=useState<HouseholdMember[]>([]),[targets,setTargets]=useState<Record<string,string>>({}),[error,setError]=useState(''),[busy,setBusy]=useState('');
 async function load(){if(!owner||!household)return;try{const result=await remoteRequest('requests');setRequests(result.requests);setUnlinked(result.unlinked);setError('')}catch(e){setError((e as Error).message)}}
 useEffect(()=>{void load();const timer=setInterval(()=>{void load()},10000);return()=>clearInterval(timer)},[owner]);
 if(!owner||!household)return null;
 if(onOpen)return requests.length?<div className="access-notification" role="status"><Users size={18}/><span>{requests.length.toLocaleString('fa-IR')} درخواست عضویت در انتظار تأیید توست.</span><Action className="outline small" onClick={onOpen}>بررسی درخواست‌ها</Action></div>:null;
 return <>{requests.length>0&&<section className="card module-card collection-card" aria-live="polite"><h2>درخواست‌های عضویت <span className="badge">{requests.length.toLocaleString('fa-IR')}</span></h2><p>این افراد منتظر اجازه ورود تو هستند.</p>{requests.map(r=><article className="access-request" key={r.id}><div><strong>{r.name}</strong><p dir="ltr">{r.email}</p><small>دسترسی پس از تأیید: ثبت و ویرایش</small></div>{unlinked.length>0&&<FormField label="عضویت به‌عنوان"><FieldSelect value={targets[r.id]??''} onChange={e=>setTargets(t=>({...t,[r.id]:e.target.value}))}><option value="">عضو تازه</option>{unlinked.map(m=><option key={m.id} value={m.id}>{m.name} (عضو فعلی)</option>)}</FieldSelect></FormField>}<Action className="primary" disabled={!!busy} onClick={()=>decide(r.id,true)}>تأیید عضویت</Action><Action className="outline" disabled={!!busy} onClick={()=>decide(r.id,false)}>رد درخواست</Action></article>)}</section>}{error&&<ErrorNotice message={error}/>}</>;
 async function decide(requestId:string,approved:boolean){setBusy(requestId);try{await remoteRequest('decide',undefined,undefined,{requestId,approved,memberId:approved&&targets[requestId]?targets[requestId]:undefined});await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
}
