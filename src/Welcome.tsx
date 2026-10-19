import { ErrorNotice } from './components/error-notice';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Copy, Home, Link2, UserRound, Users } from 'lucide-react';
import { Action, FieldInput } from './components/finance-ui';
import { FormField } from './components/form-fields';
import { AccessShell } from './AccessShell';
import { api, fetchSession, setActiveSpace, type Session, type SpaceSummary } from './remote-store';

type Step = 'choose' | 'household' | 'invite';

// Shown once after a sign-up that didn't come from an invitation: personal use, or a new household with invites.
export function Welcome() {
 const [session, setSession] = useState<Session | null>(null), [step, setStep] = useState<Step>('choose');
 const [name, setName] = useState(''), [space, setSpace] = useState<SpaceSummary | null>(null), [link, setLink] = useState('');
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
 useEffect(() => { fetchSession().then(result => { if (!result) location.replace('/login?next=/welcome'); else setSession(result); }).catch(e => setError((e as Error).message)); }, []);
 if (!session) return <AccessShell><section className="access-card"><p role="status">{error || 'در حال آماده‌سازی…'}</p></section></AccessShell>;
 const user = session.user;
 const enter = (target?: SpaceSummary) => { const personal = session.spaces.find(s => s.kind === 'personal'); const chosen = target ?? personal; if (chosen) setActiveSpace(user.id, chosen); location.replace('/app'); };
 async function run(task: () => Promise<void>) { setBusy(true); setError(''); try { await task(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
 const createHousehold = () => run(async () => { const result = await api('/api/spaces', { name: name.trim() }); setSpace(result.space); setStep('invite'); });
 const createLink = () => run(async () => { const result = await api(`/api/spaces/${space!.id}/invitations`); setLink(result.url); setMessage(''); });
 const copy = async () => { try { await navigator.clipboard.writeText(link); setMessage('لینک کپی شد.'); } catch { setMessage('لینک را از کادر بالا کپی کن.'); } };
 const choice = (icon: ReactNode, title: string, text: string, onClick: () => void) => <Action variant="outline" className="outline full" style={{ height: 'auto', padding: 16, justifyContent: 'flex-start', textAlign: 'right', gap: 14, whiteSpace: 'normal' }} disabled={busy} onClick={onClick}>{icon}<span style={{ display: 'grid', gap: 4 }}><b>{title}</b><small style={{ color: 'var(--muted-foreground)' }}>{text}</small></span></Action>;

 return <AccessShell><section className="access-card" aria-labelledby="welcome-title">
  {step === 'choose' && <><div className="access-icon"><Home/></div><span className="access-eyebrow">خوش آمدی، {user.name}</span><h2 id="welcome-title">می‌خواهی از برنامه چطور استفاده کنی؟</h2><p className="access-description">بعداً هم می‌توانی از بخش «مدیریت» فضای مشترک بسازی یا به فضای دیگران بپیوندی.</p>
   <div style={{ display: 'grid', gap: 12 }}>
    {choice(<UserRound size={24}/>, 'استفادهٔ شخصی', 'حساب‌ها و هزینه‌های خودت را در فضای شخصی ثبت کن؛ فقط خودت آن را می‌بینی.', () => enter())}
    {choice(<Users size={24}/>, 'ساخت فضای مشترک', 'برای خانواده یا هم‌خانه‌ها فضا بساز و با لینک دعوت، اعضا را اضافه کن.', () => setStep('household'))}
   </div></>}
  {step === 'household' && <><div className="access-icon"><Users/></div><span className="access-eyebrow">مرحلهٔ ۱ از ۲</span><h2 id="welcome-title">نام فضای مشترک</h2><p className="access-description">این نام برای همهٔ اعضا نمایش داده می‌شود و بعداً قابل تغییر است.</p>
   <form onSubmit={e => { e.preventDefault(); void createHousehold(); }}><FormField label="نام فضا"><FieldInput autoFocus required maxLength={60} placeholder="مثلاً خانه ما" value={name} onChange={e => setName(e.target.value)}/></FormField>
    <Action variant="default" className="primary full access-submit" disabled={busy || !name.trim()}>{busy ? 'در حال ساخت…' : 'ساخت فضای مشترک'}<ArrowLeft size={18}/></Action>
    <Action variant="outline" type="button" className="outline full" onClick={() => setStep('choose')}>بازگشت</Action></form></>}
  {step === 'invite' && space && <><div className="access-icon"><Link2/></div><span className="access-eyebrow">مرحلهٔ ۲ از ۲</span><h2 id="welcome-title">اعضا را دعوت کن</h2><p className="access-description">لینک را برای هر عضو بفرست. لینک یک‌بارمصرف است و ۷ روز اعتبار دارد؛ هر عضو پس از ورود یا ثبت‌نام درخواست می‌فرستد و تو آن را تأیید می‌کنی.</p>
   <div style={{ display: 'grid', gap: 12 }}>
    {link ? <><FormField label="لینک دعوت"><FieldInput readOnly dir="ltr" value={link} onFocus={e => e.target.select()}/></FormField><Action variant="outline" className="outline full" onClick={() => void copy()}><Copy size={18}/> کپی لینک</Action><Action variant="outline" className="outline full" disabled={busy} onClick={() => void createLink()}>لینک برای عضو دیگر</Action></>
     : <Action variant="outline" className="outline full" disabled={busy} onClick={() => void createLink()}><Link2 size={18}/> ساخت لینک دعوت</Action>}
    <Action variant="default" className="primary full access-submit" onClick={() => enter(space)}>ورود به {space.name}<ArrowLeft size={18}/></Action>
    {!link && <p className="access-consent">می‌توانی دعوت را بعداً از صفحهٔ «فضای مشترک» هم انجام دهی.</p>}
   </div></>}
  {message && <p role="status">{message}</p>}{error && <ErrorNotice message={error}/>}
 </section></AccessShell>;
}
