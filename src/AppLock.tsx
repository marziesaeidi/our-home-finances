import { ErrorNotice } from './components/error-notice';
import { FormField } from './components/form-fields';
import { Surface, FieldInput, Action } from './components/finance-ui';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { enableLock, LOCK_KEY, readLock, verifyLock } from './lock';

export function LockSettings() {
  const [enabled, setEnabled] = useState(() => !!readLock(localStorage)), [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const supported = !!globalThis.crypto?.subtle;
  return <Surface as="section" className="card module-card"><h2>قفل اختیاری دستگاه</h2><p>این قفل فقط صفحه برنامه را می‌پوشاند. داده مرورگر و فایل پشتیبان رمزگذاری نشده‌اند. رمز قفل در پشتیبان مالی قرار نمی‌گیرد. پس از پنج دقیقه بی‌کاری یا پنهان‌شدن صفحه، قفل می‌شود.</p>{!supported ? <p>قفل در این محیط پشتیبانی نمی‌شود؛ از localhost یا HTTPS استفاده کن.</p> : <form className="finance-form" onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true);
    try {
      if (enabled) { if (!await verifyLock(localStorage, password)) throw new Error('رمز نادرست است.'); localStorage.removeItem(LOCK_KEY); }
      else { if (password !== confirm) throw new Error('تکرار رمز همخوان نیست.'); await enableLock(localStorage, password); }
      setEnabled(!enabled); setPassword(''); setConfirm(''); setMessage(enabled ? 'قفل غیرفعال شد.' : 'قفل فعال شد. رمز را در محل امن نگه دار.'); window.dispatchEvent(new Event('khaneh-lock-changed'));
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }}><label className="field">{enabled ? 'رمز فعلی' : 'رمز جدید'}<FieldInput type="password" autoComplete={enabled ? 'current-password' : 'new-password'} required minLength={enabled ? undefined : 8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)}/></label>{!enabled && <FormField label="تکرار رمز"><FieldInput type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)}/></FormField>}<Action variant="outline" className="outline" disabled={busy}>{enabled ? 'غیرفعال‌کردن قفل' : 'فعال‌کردن قفل'}</Action>{enabled && <Action variant="outline" type="button" className="outline" onClick={() => window.dispatchEvent(new Event('khaneh-lock-now'))}>قفل اکنون</Action>}</form>}{message && <p role="status">{message}</p>}</Surface>;
}

export function AppLock({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => { try { return !!readLock(localStorage); } catch { return true; } }), [password, setPassword] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [retryAt, setRetryAt] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const lock = () => { try { if (readLock(localStorage)) { setLocked(true); setPassword(''); } } catch { setLocked(true); } };
    const reset = () => { clearTimeout(timer); timer = setTimeout(lock, 5 * 60_000); };
    const visibility = () => { if (document.hidden) lock(); };
    const storage = (e: StorageEvent) => { if (e.key === LOCK_KEY) lock(); };
    document.addEventListener('visibilitychange', visibility); window.addEventListener('storage', storage);
    window.addEventListener('khaneh-lock-now', lock); window.addEventListener('khaneh-lock-changed', reset);
    for (const event of ['pointerdown', 'keydown']) window.addEventListener(event, reset);
    reset();
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('storage', storage); window.removeEventListener('khaneh-lock-now', lock); window.removeEventListener('khaneh-lock-changed', reset); for (const event of ['pointerdown', 'keydown']) window.removeEventListener(event, reset); };
  }, []);
  // Keep the current durable snapshot and unfinished forms mounted through a screen lock.
  // Hidden/inert removes the app from display, keyboard focus and the accessibility tree.
  return <><div hidden={locked} inert={locked}>{children}</div>{locked && <main className="lock-screen"><Surface as="section" className="card module-card"><h1>برنامه قفل است</h1><form className="finance-form" onSubmit={async e => {
    e.preventDefault(); if (busy || Date.now() < retryAt) return; setBusy(true);
    try { if (!await verifyLock(localStorage, password)) throw new Error('رمز نادرست است؛ چند ثانیه بعد دوباره تلاش کن.'); setLocked(false); setPassword(''); setMessage(''); }
    catch (error) { setMessage((error as Error).message); setRetryAt(Date.now() + 3000); } finally { setBusy(false); }
  }}><FormField label="رمز دستگاه"><FieldInput type="password" required autoFocus autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}/></FormField><Action variant="default" className="primary" disabled={busy}>بازکردن قفل</Action>{message && <ErrorNotice message={message}/>}</form><p className="field-hint">این قفل رمزگذاری داده نیست. برای بازیابی رمز فراموش‌شده، راهنمای برنامه را بخوان.</p></Surface></main>}</>;
}
