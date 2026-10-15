import { useState } from 'react';
import type { FinanceData } from './types';
import { Action, Surface } from './components/finance-ui';

export function DatabasePanel({ data }: { data: FinanceData }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function save() {
    setBusy(true); setMessage('');
    try {
      const current = await fetch('/api/database', { cache: 'no-store' });
      if (!current.ok) throw new Error('سرویس دیتابیس در دسترس نیست؛ npm run database را اجرا کنید.');
      const { revision } = await current.json();
      const result = await fetch('/api/database', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, revision }) });
      if (!result.ok) throw new Error(result.status === 409 ? 'دیتابیس هم‌زمان تغییر کرد؛ دوباره تلاش کنید.' : 'ذخیره در دیتابیس انجام نشد.');
      setMessage('نسخه کامل اطلاعات در SQLite ذخیره شد.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <Surface as="section" className="card module-card"><h2>دیتابیس SQLite</h2><p>یک نسخه کامل از اطلاعات فعلی را در دیتابیس این کامپیوتر ذخیره کنید. ذخیره روزمره برنامه همچنان در مرورگر انجام می‌شود؛ برای به‌روزکردن نسخه دیتابیس، دوباره این دکمه را بزنید.</p><Action className="primary" disabled={busy} onClick={save}>{busy ? 'در حال ذخیره…' : 'ذخیره نسخه در SQLite'}</Action>{message && <p role="status">{message}</p>}</Surface>;
}
