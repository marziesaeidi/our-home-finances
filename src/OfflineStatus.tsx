import { useEffect, useState } from 'react';
import { Action } from './components/finance-ui';

export function OfflineStatus() {
  const [online, setOnline] = useState(navigator.onLine), [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    let mounted = true;
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
      const check = () => { if (mounted && navigator.serviceWorker.controller && registration.waiting) setWaiting(registration.waiting); };
      check();
      registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', check));
      return navigator.serviceWorker.ready;
    }).then(() => { if (mounted) setReady(true); }).catch(() => { /* Local financial writes remain available when app-shell caching is unsupported. */ });
    return () => { mounted = false; window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return <>{waiting && <div className="soft-note app-update" role="status"><span>نسخه تازه برنامه آماده است. ابتدا اطلاعات فرم باز را ثبت کنید.</span><Action className="outline" onClick={() => {
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  }}>نمایش نسخه تازه</Action></div>}{!online && <p className="soft-note" role="status">آفلاین هستی؛ ثبت و پشتیبان محلی کار می‌کند. نرخ تازه در دسترس نیست.{ready ? ' نسخه برنامه برای بازشدن آفلاین آماده است.' : ' برای بازشدن بعدی آفلاین، ابتدا نسخه برنامه باید ذخیره شود.'}</p>}</>;
}
