import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, KeyRound, Lock, Mail, UserRound } from 'lucide-react';
import { Action, FieldInput } from './components/finance-ui';
import { FormField } from './components/form-fields';
import { AccessShell } from './AccessShell';
import { api } from './remote-store';

// Only same-site app or invitation paths are valid destinations after login.
const destination = () => { const next = new URLSearchParams(location.search).get('next') ?? ''; return /^\/(app|invite)(\/|$)/.test(next) ? next : '/app'; };

export function AuthPage() {
 const [mode, setMode] = useState<'login' | 'signup'>(() => new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login');
 const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [repeat, setRepeat] = useState('');
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 const signup = mode === 'signup';
 const invited = destination().startsWith('/invite/');
 async function submit(event: FormEvent) {
  event.preventDefault(); setError('');
  if (signup && password !== repeat) { setError('رمز عبور و تکرار آن یکسان نیستند.'); return; }
  setBusy(true);
  try { await api(signup ? '/api/auth/signup' : '/api/auth/login', signup ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password }); location.replace(signup && destination() === '/app' ? '/welcome' : destination()); }
  catch (e) { setError((e as Error).message); setBusy(false); }
 }
 const field = (label: string, icon: ReactNode, input: ReactNode) => <FormField label={label}><div className="access-input">{icon}{input}</div></FormField>;
 return <AccessShell><section className="access-card" aria-labelledby="auth-title"><div className="access-icon"><KeyRound/></div><span className="access-eyebrow">{invited ? 'برای پیوستن به فضای مشترک، اول وارد شو' : 'حساب کاربری'}</span><h2 id="auth-title">{signup ? 'ساخت حساب تازه' : 'ورود به حساب'}</h2>
  <div role="tablist" aria-label="ورود یا ثبت‌نام" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:20}}>
   <Action role="tab" aria-selected={!signup} className={!signup ? 'primary' : 'outline'} onClick={() => { setMode('login'); setError(''); }}>ورود</Action>
   <Action role="tab" aria-selected={signup} className={signup ? 'primary' : 'outline'} onClick={() => { setMode('signup'); setError(''); }}>ثبت‌نام</Action>
  </div>
  <form onSubmit={submit}>
   {signup && field('نام و نام خانوادگی', <UserRound size={18}/>, <FieldInput autoComplete="name" required maxLength={60} placeholder="مثلاً سارا احمدی" value={name} onChange={e => setName(e.target.value)}/>)}
   {field('ایمیل', <Mail size={18}/>, <FieldInput type="email" autoComplete="email" dir="ltr" required maxLength={254} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}/>)}
   {field('رمز عبور', <Lock size={18}/>, <FieldInput type="password" dir="ltr" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : undefined} maxLength={200} value={password} onChange={e => setPassword(e.target.value)}/>)}
   {signup && field('تکرار رمز عبور', <Lock size={18}/>, <FieldInput type="password" dir="ltr" autoComplete="new-password" required minLength={8} maxLength={200} value={repeat} aria-invalid={!!repeat && repeat !== password} onChange={e => setRepeat(e.target.value)}/>)}
   {signup && <p className="access-consent">رمز عبور دست‌کم ۸ نویسه. فعلاً امکان بازیابی رمز وجود ندارد؛ آن را جایی امن نگه دار.</p>}
   <Action className="primary full access-submit" disabled={busy}>{busy ? 'لطفاً صبر کن…' : signup ? 'ساخت حساب' : 'ورود'}<ArrowLeft size={18}/></Action>
  </form>
  {error && <p role="alert" className="form-error">{error}</p>}
 </section></AccessShell>;
}
