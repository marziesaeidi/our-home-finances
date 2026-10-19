import { ErrorNotice } from './components/error-notice';
import { Action, FieldInput } from './components/finance-ui';
import { useState } from 'react';
import { migrate, STORE_KEY, validate } from './store';

export function Recovery({ error }: { error: string }) {
  const [message, setMessage] = useState(error);
  const restore = (raw: string) => {
    const data = migrate(JSON.parse(raw), new Date().toISOString()); validate(data);
    const original = localStorage.getItem(STORE_KEY) ?? localStorage.getItem('khaneh-v1');
    if (original !== null) localStorage.setItem(`khaneh-recovery-original:${Date.now()}`, original);
    localStorage.setItem(STORE_KEY, JSON.stringify(data)); location.reload();
  };
  return <main><h1>بازیابی داده‌ها</h1><p>داده اصلی حفظ شده؛ برنامه آن را با داده نمونه جایگزین نکرده است.</p><ErrorNotice message={message} autoPopup={false} allowNavigation={false}/><Action variant="outline" className="outline full" onClick={() => { try { const raw = localStorage.getItem(STORE_KEY) ?? localStorage.getItem('khaneh-v1'); if (!raw) return; const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'داده-اصلی.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (err) { setMessage((err as Error).message); } }}>دریافت داده اصلی</Action><Action variant="outline" className="outline full" onClick={() => { try { const previous = localStorage.getItem('khaneh-v2-previous'); if (!previous) throw new Error('نسخه سالم قبلی موجود نیست.'); restore(previous); } catch (err) { setMessage((err as Error).message); } }}>بازگردانی آخرین نسخه سالم با حفظ فایل فعلی</Action><label className="field backup-input">بازیابی پشتیبان معتبر<FieldInput type="file" accept=".json,application/json" onChange={async e => { try { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10_000_000) throw new Error('فایل بیش از ۱۰ مگابایت است.'); restore(await file.text()); } catch (err) { setMessage((err as Error).message); } }}/></label></main>;
}
