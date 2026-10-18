import { useEffect } from 'react';
import { ArrowLeft, ArrowUpLeft, Linkedin, ShieldCheck, Wallet } from 'lucide-react';
import { AccessShell } from './AccessShell';
import { fetchSession } from './remote-store';

export function Landing() {
 // The server already redirects signed-in visitors; this covers the Vite dev server.
 useEffect(() => { fetchSession().then(session => { if (session) location.replace('/app'); }).catch(() => {}); }, []);
 return <AccessShell footer={<p className="access-credit">دیزاین و توسعه:<a href="https://www.linkedin.com/in/marziesaeidi" target="_blank" rel="noopener noreferrer" aria-label="مرضیه سعیدی در لینکدین (در پنجرهٔ تازه)"><Linkedin size={14} aria-hidden="true"/>مرضیه سعیدی<ArrowUpLeft size={13} aria-hidden="true" className="access-credit-arrow"/></a></p>}><section className="access-card" aria-labelledby="landing-title"><div className="access-icon"><Wallet/></div><span className="access-eyebrow">مدیریت مالی شخصی و خانوادگی</span><h2 id="landing-title">حساب‌وکتاب خانه، ساده و امن</h2><p className="access-description">هزینه‌ها، حساب‌ها، وام‌ها و هدف‌های پس‌انداز را در فضای شخصی خودت ثبت کن و با دعوت اعضای خانواده، فضای مشترک بساز.</p><div className="access-note"><ShieldCheck size={20}/><p>هر کس فقط اطلاعات فضای شخصی خودش و فضاهای مشترکی را می‌بیند که به آن‌ها دعوت شده است.</p></div><a className="action primary full access-submit" style={{marginTop:24,alignItems:'center',textDecoration:'none'}} href="/login">ورود یا ثبت‌نام <ArrowLeft size={18}/></a></section></AccessShell>;
}
