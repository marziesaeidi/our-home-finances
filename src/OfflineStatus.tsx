import { useEffect, useState } from 'react';

export function OfflineStatus() {
  const [online, setOnline] = useState(navigator.onLine), [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(() => { if (mounted) setReady(true); }).catch(() => { /* Local financial writes remain available when app-shell caching is unsupported. */ });
    return () => { mounted = false; window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return !online ? <p className="soft-note" role="status">آفلاین هستی؛ ثبت و پشتیبان محلی کار می‌کند. نرخ تازه در دسترس نیست.{ready ? ' نسخه برنامه برای بازشدن آفلاین آماده است.' : ' برای بازشدن بعدی آفلاین، ابتدا نسخه برنامه باید ذخیره شود.'}</p> : null;
}
