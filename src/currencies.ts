import { formatNumericInput } from './input-format';
import { checked, decimal } from './decimal';
export type CurrencyDefinition = { code: string; label: string; decimals: number };
export const currencies: CurrencyDefinition[] = [
  {code:'IRT',label:'تومان (واحد برنامه)',decimals:0}, {code:'IRR',label:'ریال ایران',decimals:0},
  {code:'USD',label:'دلار آمریکا',decimals:2}, {code:'EUR',label:'یورو',decimals:2},
  {code:'AED',label:'درهم امارات',decimals:2}, {code:'TRY',label:'لیر ترکیه',decimals:2},
];
export function currencyDefinition(code: string, extra: CurrencyDefinition[] = []) {
  const result = [...currencies,...extra].find(c=>c.code===code);
  if (!result) throw new Error('ارز در تنظیمات تعریف نشده است.');
  return result;
}
export function minorUnits(value: string, code: string, extra: CurrencyDefinition[] = []) {
  const d=decimal(value), scale=10n**BigInt(currencyDefinition(code,extra).decimals);
  if (d.units*scale%d.scale) throw new Error('دقت مبلغ با واحد ارز سازگار نیست.');
  return checked(d.units*scale/d.scale);
}
export function nativeText(units: number, code: string, extra: CurrencyDefinition[] = []) {
  const digits=currencyDefinition(code,extra).decimals, negative=units<0;
  const text=String(Math.abs(units)).padStart(digits+1,'0');
  return (negative?'-':'')+(digits?`${text.slice(0,-digits)}.${text.slice(-digits)}`:text);
}
export const nativeMoney = (units: number, code: string, extra: CurrencyDefinition[] = []) => `${formatNumericInput(nativeText(units,code,extra))} ${code==='IRT'?'تومان':code==='IRR'?'ریال':code}`;
