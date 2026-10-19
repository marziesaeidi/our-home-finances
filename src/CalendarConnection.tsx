import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import type { FinanceData } from './types';
import { dueItems } from './obligations';
import { Action } from './components/finance-ui';
import { membersOf } from './household-access';

type Token = { access_token: string; expires_in: number; error?: string };
type GoogleAuth = { initTokenClient: (options: { client_id: string; scope: string; hint: string; callback: (token: Token) => void; error_callback: () => void }) => { requestAccessToken: () => void }; revoke: (token: string, done: () => void) => void };
declare global { interface Window { google?: { accounts: { oauth2: GoogleAuth } } } }
let loading: Promise<void> | undefined;
function loadGoogle() {
  if (window.google) return Promise.resolve();
  return loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = () => resolve(); script.onerror = () => { loading = undefined; script.remove(); reject(new Error('اتصال به گوگل برقرار نشد. دوباره تلاش کن.')); }; document.head.append(script);
  });
}
const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
export function CalendarConnection({ data, viewer, visible }: { data: FinanceData; viewer: string; change: (fn: (d: FinanceData) => FinanceData) => void; visible: boolean }) {
  const member = membersOf(data).find(m=>m.id===viewer&&!m.removed);
  const calendarEmail = member?.calendarEmail ?? (member?.role==='owner' ? data.settings.calendarEmail : undefined);
  const [target,setTarget] = useState<HTMLElement|null>(null);
  useEffect(()=>{setTarget(visible ? document.getElementById('member-calendar-connection') : null);},[visible,viewer]);
  const [session, setSession] = useState<{ token: string; until: number; viewer: string; email: string }>();
  const [status, setStatus] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  useEffect(() => {
    const run = ++generation.current; setBusy(false);
    if (!session || session.viewer !== viewer || session.email !== calendarEmail) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => { setSession(undefined); setStatus('مجوز گوگل منقضی شد؛ برای ادامه همگام‌سازی دوباره وصل شو.'); }, Math.max(0, session.until - Date.now()));
    const timer = window.setTimeout(async () => {
      setBusy(true);
      try {
        if (Date.now() >= session.until) throw new Error('برای ادامه، دوباره به گوگل وصل شو.');
        async function api(url: string, method = 'GET', body?: unknown): Promise<any> {
          const response = await fetch(url, { method, signal: controller.signal, headers: { Authorization: `Bearer ${session!.token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
          if (response.status === 409 && method === 'POST' && body && typeof body === 'object' && 'id' in body) return api(url + '/' + String(body.id), 'PUT', body);
          if (!response.ok) throw new Error(response.status === 401 ? 'مجوز گوگل منقضی شد؛ دوباره وصل شو.' : 'همگام‌سازی کامل نشد؛ اتصال و دسترسی تقویم را بررسی و دوباره تلاش کن.');
          return response.status === 204 ? {} : response.json();
        }
        // Isolate each workspace and viewer; never touch unrelated calendar events.
        const marker = `khaneh:${data.migratedAt}:${viewer}`;
        const existing = new Map<string, { id: string; description?: string }>();
        let page: string | undefined;
        do {
          const url = new URL(base); url.searchParams.set('privateExtendedProperty', `khaneh=${marker}`); url.searchParams.set('maxResults', '2500'); if (page) url.searchParams.set('pageToken', page);
          const result = await api(url.href);
          for (const item of result.items ?? []) if (item.extendedProperties?.private?.key) existing.set(item.extendedProperties.private.key, item);
          page = result.nextPageToken;
        } while (page);
        const rows = dueItems(data, viewer).filter(row => row.reminderDays.length);
        for (const row of rows) {
          const key = `${row.kind}:${row.id}`;
          const event = { summary: row.name, description: 'یادآوری خانه ما', start: { dateTime: `${row.date}T09:00:00+03:30`, timeZone: 'Asia/Tehran' }, end: { dateTime: `${row.date}T09:15:00+03:30`, timeZone: 'Asia/Tehran' }, reminders: { useDefault: false, overrides: [...new Set(row.reminderDays.map(days => Math.min(40320, days * 1440)))].sort((a,b)=>a-b).slice(0,5).map(minutes => ({ method: 'popup', minutes })) }, extendedProperties: { private: { khaneh: marker, key } } };
          const old = existing.get(key);
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(marker + ':' + key));
          const eventId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
          await api(old ? `${base}/${encodeURIComponent(old.id)}` : base, old ? 'PUT' : 'POST', old ? event : { ...event, id: eventId });
          existing.delete(key);
        }
        for (const old of existing.values()) await api(`${base}/${encodeURIComponent(old.id)}`, 'DELETE');
        if (generation.current === run) setStatus(`همگام شد · ${rows.length.toLocaleString('fa-IR')} موعد · ${new Date().toLocaleTimeString('fa-IR')}`);
      } catch (error) { if (!controller.signal.aborted && generation.current === run) setStatus((error as Error).message); }
      finally { if (generation.current === run) setBusy(false); }
    }, 1500);
    return () => { controller.abort(); clearTimeout(timer); clearTimeout(timeout); };
  }, [data, viewer, session, retry]);
  if (!visible || !target) return null;
  const connected = session?.viewer === viewer && session.email === calendarEmail;
  return createPortal(<div className="member-calendar-actions"><p className="field-hint">برای ثبت یادآوری‌ها، تقویم این عضو را وصل کن.</p><Action variant="default" className="primary full" disabled={!clientId || !calendarEmail || busy} onClick={async () => { setBusy(true); try { await loadGoogle(); window.google!.accounts.oauth2.initTokenClient({ client_id: clientId!, scope: 'https://www.googleapis.com/auth/calendar.events', hint: calendarEmail!, callback: token => { setBusy(false); if (token.error) { setStatus('اجازه دسترسی به تقویم داده نشد.'); return; } setSession({ token: token.access_token, until: Date.now() + (token.expires_in - 60) * 1000, viewer, email: calendarEmail! }); }, error_callback: () => { setBusy(false); setStatus('ورود به گوگل تکمیل نشد. دوباره تلاش کن.'); } }).requestAccessToken(); } catch (error) { setBusy(false); setStatus((error as Error).message); } }}>{connected ? 'تمدید اتصال گوگل' : 'اتصال به Google Calendar'}</Action>{connected && <><Action variant="outline" className="outline" disabled={busy} onClick={()=>setRetry(n=>n+1)}>همگام‌سازی دوباره</Action><Action variant="outline" className="outline" onClick={()=>{ const token=session!.token; setSession(undefined); setBusy(false); setStatus('همگام‌سازی متوقف شد؛ رویدادهای قبلی در تقویم باقی می‌مانند.'); window.google?.accounts.oauth2.revoke(token, ()=>{}); }}>قطع اتصال</Action></>}{!clientId && <p className="field-hint">اتصال گوگل هنوز راه‌اندازی نشده است.</p>}<p className="field-hint">همگام‌سازی هنگام باز بودن اپ انجام می‌شود؛ اعلان‌های تقویم گوشی یا سیستم را روشن کن.</p>{(busy || status) && <p role="status">{busy ? 'در حال اتصال یا همگام‌سازی…' : status}</p>}</div>,target);
}


