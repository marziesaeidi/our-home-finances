import { useEffect, useRef, useState } from 'react';
import { fromJalali, jalaliInput } from './calendar';
import { displayPreferences } from './utils';
import { isoDay } from './calendar';

export function DateField({ value, onChange, label }: { value: string; onChange: (date: string) => void; label?: string }) {
  const gregorian = displayPreferences().calendar === 'gregory';
  const title = label ?? (gregorian ? 'تاریخ میلادی' : 'تاریخ شمسی');
  const format = (date: string) => gregorian ? date : jalaliInput(date);
  const [text, setText] = useState(format(value));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (document.activeElement !== input.current) setText(gregorian ? value : jalaliInput(value)); }, [value, gregorian]);
  return <label className="field"><span>{title}</span><input ref={input} type={gregorian ? 'date' : 'text'} required aria-label={title} value={text} placeholder="۱۴۰۵/۰۷/۱۶" inputMode="numeric" onBlur={() => { if (value) setText(format(value)); }} onChange={e => {
    setText(e.target.value);
    try { const date = gregorian ? e.target.value : fromJalali(e.target.value); if (!isoDay(date)) throw new Error(); onChange(date); e.target.setCustomValidity(''); } catch { onChange(''); e.target.setCustomValidity('تاریخ کامل و معتبر وارد کن.'); }
  }}/><small className="field-hint">{gregorian ? 'میلادی' : 'سال / ماه / روز'}</small></label>;
}
