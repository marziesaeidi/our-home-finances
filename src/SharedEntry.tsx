import { InvitationAccess } from './InvitationAccess';
import { useEffect, useState, type ReactNode } from 'react';
import type { FinanceData } from './types';
import { saveStore, validate } from './store';
import { remoteRequest } from './remote-store';

export const publicShare = !!document.querySelector('meta[name="khaneh-public-share"]') || !['localhost','127.0.0.1','[::1]'].includes(location.hostname);
export const recoveredInvitation = document.querySelector<HTMLMetaElement>('meta[name="khaneh-invitation"]')?.content || '';

export function LocalEntry({load,children}:{load:()=>FinanceData;children:(data:FinanceData)=>ReactNode}) {
  const [data,setData]=useState<FinanceData|null>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;void(async()=>{
    try{
      const local=load();
      let response:Response;
      try{response=await fetch('/api/database/local-session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});}
      catch{if(active)setData(local);return;}
      if(!response.ok)throw new Error('اتصال به فضای دیتابیس انجام نشد. سرویس برنامه را بررسی کن.');
      const session=await response.json();if(!active)return;
      if(!session.data){setData(local);return;}
      validate(session.data);
      const previous=localStorage.getItem('khaneh-v2');
      if(previous&&previous!==JSON.stringify(session.data)&&!localStorage.getItem('khaneh-before-server-sync'))localStorage.setItem('khaneh-before-server-sync',previous);
      localStorage.setItem('khaneh-owner-key',session.ownerKey);
      localStorage.setItem('khaneh-viewer',session.member.id);
      saveStore(localStorage,session.data);setData(session.data);
    }catch(error){if(active)setError((error as Error).message);}
  })();return()=>{active=false}},[]);
  if(data)return children(data);
  return <main dir="rtl" className="access-page"><section className="card module-card"><h1>اتصال به فضای مالی</h1><p role="status">{error||'در حال دریافت اطلاعات…'}</p>{error&&<button onClick={()=>location.reload()}>تلاش دوباره</button>}</section></main>;
}

export function SharedEntry({children,localOwner=false}:{children:(data:FinanceData)=>ReactNode;localOwner?:boolean}) {
  const [data,setData]=useState<FinanceData|null>(null),[error,setError]=useState(''),[invitation,setInvitation]=useState<{token?:string}|null>(null);
  useEffect(()=>{let active=true;void (async()=>{
    try {
      if(localOwner){const result=await remoteRequest('read');if(!active)return;saveStore(localStorage,result.data);localStorage.setItem('khaneh-viewer',result.member.id);setData(result.data);return;}
      const identity=await fetch('/api/share/session',{cache:'no-store'});
      if(identity.ok){
        const session=await identity.json();
        if(session.status==='approved'&&session.member){validate(session.data);if(!active)return;saveStore(localStorage,session.data);localStorage.setItem('khaneh-viewer',session.member.id);setData(session.data);return;}
        if(active)setInvitation({token:session.token});return;
      }
      const token=localStorage.getItem('khaneh-approved-access')||sessionStorage.getItem('khaneh-approved-access');
      if(!token)throw new Error('برای ورود، لینک دعوت کامل را از مالک بگیر و درخواست عضویت بفرست.');
      const response=await fetch('/api/database/access/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
      const result=await response.json();
      if(!response.ok||result.status!=='approved'||!result.member)throw new Error('ورود فقط پس از تأیید درخواست توسط مالک امکان‌پذیر است.');
      validate(result.data);
      if(!active)return;
      // Establish the same baseline that App uses for optimistic local writes.
      // saveStore retains the previous snapshot for recovery.
      saveStore(localStorage,result.data);
      localStorage.setItem('khaneh-viewer',result.member.id);
      if(active)setData(result.data);
    }catch(e){if(active)setError((e as Error).message);}
  })();return()=>{active=false}},[]);
  if(invitation)return <InvitationAccess initialToken={invitation.token}/>;
  if(!data)return <main dir="rtl" className="access-page"><section className="card module-card"><h1>ورود به فضای مشترک</h1><p role="status">{error||'در حال بررسی تأیید مالک…'}</p>{error&&<button type="button" onClick={()=>location.reload()}>تلاش دوباره</button>}</section></main>;
  return children(data);
}
