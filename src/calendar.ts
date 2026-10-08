import { normalizeDigits } from './decimal';

const formatter = new Intl.DateTimeFormat('en-u-ca-persian', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric' });
export function jalaliParts(date: string) {
  const parts = formatter.formatToParts(new Date(`${date}T12:00:00+03:30`));
  const value = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}
export function canonicalDay(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function isoDay(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}
export function fromJalali(input: string): string {
  const normalized = normalizeDigits(input);
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(normalized);
  if (!match) throw new Error('تاریخ شمسی را مانند ۱۴۰۵/۰۷/۱۶ وارد کن.');
  const [, y, m, d] = match, year = Number(y), month = Number(m), day = Number(d);
  if (year < 1300 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 31) throw new Error('تاریخ شمسی معتبر نیست.');
  // Intl supplies the calendar conversion; searching avoids a second calendar algorithm.
  const start = Date.UTC(year + 621, 2, 18);
  for (let i = 0; i < 380; i++) {
    const candidate = new Date(start + i * 86400000).toISOString().slice(0, 10);
    const p = jalaliParts(candidate);
    if (p.year === year && p.month === month && p.day === day) return candidate;
  }
  throw new Error('این روز در تقویم شمسی وجود ندارد.');
}
export function jalaliInput(date: string): string {
  if (!isoDay(date)) return date;
  const p = jalaliParts(date);
  return `${p.year}/${String(p.month).padStart(2, '0')}/${String(p.day).padStart(2, '0')}`.replace(/\d/g, c => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]);
}
export function periodKey(date: string): string {
  const p = jalaliParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}
export function previousPeriod(date: string): string {
  const p = jalaliParts(date);
  return `${p.month === 1 ? p.year - 1 : p.year}-${String(p.month === 1 ? 12 : p.month - 1).padStart(2, '0')}`;
}
export function nextDate(date: string, frequency: string, anchorDay?: number): string {
  if (!isoDay(date)) throw new Error('سال و روز سررسید را تکمیل کن.');
  if (frequency === 'هفتگی') return new Date(Date.parse(`${date}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  if (frequency !== 'ماهانه' && frequency !== 'سالانه') throw new Error('برای دوره سفارشی، سررسید بعدی را تعیین کن.');
  const p = jalaliParts(date), month = frequency === 'سالانه' ? p.month : p.month === 12 ? 1 : p.month + 1;
  const year = p.year + (frequency === 'سالانه' || p.month === 12 ? 1 : 0);
  for (let day = anchorDay ?? p.day; day >= 1; day--) {
    try { return fromJalali(`${year}/${month}/${day}`); } catch { /* clamp month end */ }
  }
  throw new Error('سررسید معتبر نیست.');
}
