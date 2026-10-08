let preferences = { persianNumbers: true, calendar: 'persian' as 'persian' | 'gregory' };
export const displayPreferences = () => preferences;
export function configureDisplay(settings: { persianNumbers?: boolean; calendar?: 'persian' | 'gregory' }) {
  preferences = { persianNumbers: settings.persianNumbers !== false, calendar: settings.calendar ?? 'persian' };
}
export const fa = (n: number) => Math.round(n).toLocaleString(preferences.persianNumbers ? 'fa-IR' : 'en-US');
export const money = (n: number) => `${fa(n)} تومان`;
export const compact = (n: number) => n >= 1_000_000 ? `${fa(n / 1_000_000)} میلیون` : n >= 1_000 ? `${fa(n / 1_000)} هزار` : fa(n);
import { canonicalDay, isoDay, periodKey } from './calendar';
export const today = () => canonicalDay(new Date());
export const id = () => crypto.randomUUID();
export const persianDate = (value: string) => isoDay(value) ? new Date(`${value}T12:00:00+03:30`).toLocaleDateString(`fa-IR-u-ca-${preferences.calendar}-nu-${preferences.persianNumbers ? 'arabext' : 'latn'}`, { timeZone: 'Asia/Tehran', year: 'numeric', day: 'numeric', month: 'long' }) : value;
export const monthKey = periodKey;
