import { normalizeDigits } from './decimal';
export const persianDigits = (value: string) => value.replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
export const rawNumericInput = (value: string) => normalizeDigits(value).replace(/[,٬،]/g, '');
export function formatNumericInput(value: string): string {
  const raw = rawNumericInput(value);
  const [whole, ...fraction] = raw.split('.');
  return persianDigits(whole.replace(/\B(?=(\d{3})+(?!\d))/g, '٬') + (fraction.length ? '.' + fraction.join('.') : ''));
}
