import { ErrorNotice } from './components/error-notice';
import { useEffect, useState, type ReactNode } from 'react';
import { LogOut, Plus } from 'lucide-react';
import type { FinanceData } from './types';
import { saveStore } from './store';
import { Action, FieldInput, FieldSelect } from './components/finance-ui';
import { activeSpace, api, fetchSession, lastSpace, logout, remoteRequest, setActiveSpace, spaceStorage, type Session } from './remote-store';

let session: Session | null = null;

// Explicit switches take priority; entry otherwise defaults to a shared household.
export function AppEntry({ children }: { children: (data: FinanceData) => ReactNode }) {
 const [data, setData] = useState<FinanceData | null>(null), [error, setError] = useState('');
 useEffect(() => { let active = true; void (async () => {
  try {
   const current = await fetchSession();
   if (!current) { location.replace('/login?next=' + encodeURIComponent(location.pathname)); return; }
   session = current;
   const explicit = sessionStorage.getItem('khaneh-space-switch');
   sessionStorage.removeItem('khaneh-space-switch');
   const preferred = lastSpace(current.user.id);
   const space = current.spaces.find(s => s.id === explicit) ?? current.spaces.find(s => s.id === preferred && s.kind === 'household') ?? current.spaces.find(s => s.kind === 'household') ?? current.spaces.find(s => s.kind === 'personal') ?? current.spaces[0];
   if (!space) throw new Error('هیچ فضای مالی برای این حساب پیدا نشد.');
   setActiveSpace(current.user.id, space);
   const result = await remoteRequest('read');
   if (!active) return;
   saveStore(spaceStorage, result.data);
   setData(result.data);
  } catch (e) { if (active) setError((e as Error).message); }
 })(); return () => { active = false; }; }, []);
 if (data) return children(data);
 return <main dir="rtl" className="access-page"><section className="card module-card"><h1>اتصال به فضای مالی</h1><p role="status">{error || 'در حال دریافت اطلاعات…'}</p>{error && <Action variant="outline" className="outline" type="button" onClick={() => location.reload()}>تلاش دوباره</Action>}</section></main>;
}

// Lists the personal space and every household the user belongs to; switching reloads the app for that space.
export function SpaceSwitcher({ beforeCreate }: { beforeCreate?: ReactNode } = {}) {
 const [creating, setCreating] = useState(false), [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
 const current = activeSpace();
 if (!session || !current) return null;
 const user = session.user;
 const label = (kind: string, spaceName: string) => kind === 'personal' ? `فضای شخصی · ${spaceName}` : spaceName;
 async function create() {
  setBusy(true); setError('');
  try { const { space } = await api('/api/spaces', { name: name.trim() }); setActiveSpace(user.id, space); sessionStorage.setItem('khaneh-space-switch',space.id); location.reload(); }
  catch (e) { setError((e as Error).message); setBusy(false); }
 }
 return <div className="space-switcher" style={{ display: 'grid', gap: 8, margin: '12px 0' }}>
  <small>{user.name} · <span dir="ltr">{user.email}</span></small>
  <FieldSelect aria-label="انتخاب فضای مالی" value={current.id} onChange={e => { const next = session!.spaces.find(s => s.id === e.target.value); if (next) { setActiveSpace(user.id, next); sessionStorage.setItem('khaneh-space-switch',next.id); location.reload(); } }}>
   {session.spaces.map(s => <option key={s.id} value={s.id}>{label(s.kind, s.name)}</option>)}
  </FieldSelect>
  {beforeCreate}
  {creating ? <form style={{ display: 'grid', gap: 8 }} onSubmit={e => { e.preventDefault(); void create(); }}><FieldInput aria-label="نام فضای مشترک" autoFocus required maxLength={60} placeholder="مثلاً خانه ما" value={name} onChange={e => setName(e.target.value)}/><Action variant="default" className="primary small" disabled={busy || !name.trim()}>ساخت فضای مشترک</Action><Action variant="outline" type="button" className="outline small" onClick={() => setCreating(false)}>انصراف</Action></form>
   : <Action variant="outline" className="outline small" onClick={() => setCreating(true)}><Plus size={16}/> فضای مشترک تازه</Action>}

  {error && <ErrorNotice message={error}/>}
 </div>;
}

export function LogoutButton() { return <Action variant="outline" className="outline small" onClick={() => void logout()}><LogOut size={16}/> خروج از حساب</Action>; }
