import { useEffect, useRef, useState } from 'react';
import { fromJalali, jalaliInput } from './calendar';

export function DateField({ value, onChange, label = 'تاریخ شمسی' }: { value: string; onChange: (date: string) => void; label?: string }) {
  const [text, setText] = useState(jalaliInput(value));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (document.activeElement !== input.current) setText(jalaliInput(value)); }, [value]);
  return <label className="field"><span>{label}</span><input ref={input} required aria-label={label} value={text} placeholder="۱۴۰۵/۰۷/۱۶" inputMode="numeric" onBlur={() => { if (value) setText(jalaliInput(value)); }} onChange={e => {
    setText(e.target.value);
    try { onChange(fromJalali(e.target.value)); e.target.setCustomValidity(''); } catch { onChange(''); e.target.setCustomValidity('تاریخ کامل و معتبر شمسی وارد کن.'); }
  }}/><small className="field-hint">سال / ماه / روز</small></label>;
}
