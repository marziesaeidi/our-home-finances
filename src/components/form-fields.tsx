import type { ComponentProps, ReactNode } from 'react';
import { FieldInput, FieldSelect } from './finance-ui';

export function FormField({ label, children, className = '' }: { label: ReactNode; children: ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}</label>;
}

export function LabeledInput({ label, value, onValueChange, optional = false, required, ...props }: Omit<ComponentProps<typeof FieldInput>, 'onChange'> & { label: string; onValueChange?: (value: string) => void; optional?: boolean }) {
  return <FormField label={label}><FieldInput {...props}
    required={required ?? (!!onValueChange && !optional)}
    inputMode={props.inputMode ?? (/مبلغ|تومان|اصل|سود|نرخ|تعداد|موجودی|مقدار|قیمت|کارمزد/.test(label) ? 'decimal' : undefined)}
    {...(onValueChange ? { value, onChange: e => onValueChange(e.target.value) } : { defaultValue: value })}/></FormField>;
}

type Option = string | [string, string];
export function LabeledSelect({ label, options, value = '', onValueChange, ...props }: Omit<ComponentProps<'select'>, 'onChange' | 'value' | 'children'> & { label: string; options: Option[]; value?: string; onValueChange?: (value: string) => void }) {
  return <FormField label={label}><FieldSelect {...props}
    {...(onValueChange ? { value, onChange: e => onValueChange(e.target.value) } : { defaultValue: value })}>
    {options.map(option => { const [id, text] = typeof option === 'string' ? [option, option === 'shared' ? 'مشترک' : option === 'private' ? 'شخصی' : option] : option;
      return <option key={id} value={id}>{text}</option>;
    })}
  </FieldSelect></FormField>;
}
