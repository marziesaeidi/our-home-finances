import type { ReactNode } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import './invitation-access.css';

// Shared frame for the public pages: landing, login/sign-up and invitations.
export function AccessShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
 return <main className="access-page" dir="rtl"><header className="access-brand"><img src="/group-wallet-logo.png" alt=""/><span>کیف پول مشترک<small>کنار هم، با خیال آسوده‌تر</small></span></header><div className="access-layout"><aside className="access-story"><span className="access-eyebrow">یک فضای مشترک، یک خیال راحت</span><h1>برنامه‌های مشترک،<br/>از همین‌جا شروع می‌شوند.</h1><p>هزینه‌ها، پس‌اندازها و هدف‌هایتان را کنار هم ببینید و برای روزهای پیش رو برنامه بریزید.</p><div className="access-art" aria-hidden="true"><div className="access-orbit"/><div className="access-wallet"><Users size={40}/><span>برای هدف‌های مشترک</span><b>قدم‌به‌قدم، کنار هم</b><div><i/><i/><i/></div></div><span className="access-seal"><ShieldCheck size={23}/> با تأیید مالک</span></div><div className="access-story-foot"><ShieldCheck size={20}/><span>مدیریت اعضا و دسترسی‌ها در اختیار مالک فضاست.</span></div></aside>{children}</div><footer className="access-footer">کیف پول مشترک · برای زندگی و هدف‌های مشترک{footer}</footer></main>;
}
