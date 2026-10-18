import { ChevronLeft, Plus } from 'lucide-react';
import { useId, useState, type ComponentProps, type ElementType } from 'react';
import { normalizeDigits } from '../decimal';
import { formatNumericInput, rawNumericInput } from '../input-format';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { cn } from '../lib/utils';

function revealFormError(form: HTMLFormElement) {
  requestAnimationFrame(() => {
    const invalid = form.querySelector<HTMLElement>(':invalid');
    const message = form.querySelector<HTMLElement>('.field-error, .form-error, [role="alert"]');
    if (!invalid && !message) return;
    let parent = (invalid ?? message)?.parentElement;
    while(parent){ if(parent instanceof HTMLDetailsElement) parent.open=true; parent=parent.parentElement; }
    invalid?.focus({ preventScroll: true });
    (invalid?.closest('label, fieldset') ?? message ?? invalid)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/** Native form contracts are preserved, including submit defaults and refs. */
export function Action({ className = '', onClick, ...props }: ComponentProps<'button'>) {
  const variant = /\b(primary|add-main)\b/.test(className) ? 'default'
    : /\b(danger|plain-danger)\b/.test(className) ? 'destructive'
    : /\boutline\b/.test(className) ? 'outline'
    : /\bsecondary\b/.test(className) ? 'secondary' : 'ghost';
  return <Button variant={variant} className={cn('finance-action', className)} {...props} onClick={event => { const form = event.currentTarget.form; onClick?.(event); if (form && event.currentTarget.type === 'submit' && !event.defaultPrevented) revealFormError(form); }}/>;
}

/** Uniform back control; the destination remains available to assistive technology. */
export function BackButton({ label = 'بازگشت', className, ...props }: ComponentProps<'button'> & { label?: string }) {
  return <Action type="button" {...props} className={cn('outline top-back', className)} aria-label={label} title={label}><ChevronLeft className="back-arrow" size={18}/>بازگشت</Action>;
}

/** Shared entry point for creating a record, matching the new-account action. */
export function AddAction({ children, className, variant = 'primary', ...props }: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' }) {
  return <Action type="button" {...props} className={cn(variant, 'small app-add-action', className)}><Plus size={17} aria-hidden="true"/>{children}</Action>;
}

export function FieldInput({ error, ...props }: ComponentProps<'input'> & { error?: string }) {
  const errorId = useId();
  const [validation, setValidation] = useState('');
  const numeric = typeof props.value === 'number' || typeof props.defaultValue === 'number' || props.type === 'number' || props.inputMode === 'numeric' || props.inputMode === 'decimal';
  const message = error || validation;
  const validate = (node: HTMLInputElement) => {
    const raw = rawNumericInput(node.value);
    let next = '';
    if (props.required && !node.value.trim()) next = 'این فیلد را تکمیل کن.';
    else if (numeric && raw && !/^-?\d+(\.\d+)?$/.test(raw)) next = 'یک عدد معتبر وارد کن.';
    else if (numeric && raw && props.min !== undefined && Number(raw) < Number(props.min)) next = `حداقل مقدار ${formatNumericInput(String(props.min))} است.`;
    else if (numeric && raw && props.max !== undefined && Number(raw) > Number(props.max)) next = `حداکثر مقدار ${formatNumericInput(String(props.max))} است.`;
    else if (numeric && raw && props.type === 'number' && (!props.step || props.step === 1 || props.step === '1') && !Number.isInteger(Number(raw))) next = 'عدد صحیح و بدون اعشار وارد کن.';
    node.setCustomValidity(next);
    setValidation(next);
  };
  if (['checkbox', 'radio', 'color', 'file', 'range'].includes(props.type ?? ''))
    return <input data-slot="native-input" {...props}/>;
  return <span className={numeric ? 'input-control numeric-input-control' : 'input-control'}><Input {...props}
    type={numeric ? 'text' : props.type}
    inputMode={numeric ? (props.inputMode ?? 'decimal') : props.inputMode}
    defaultValue={numeric && props.defaultValue !== undefined ? formatNumericInput(String(props.defaultValue)) : props.defaultValue}
    value={numeric && props.value !== undefined ? formatNumericInput(String(props.value)) : props.value}
    aria-invalid={message ? true : props['aria-invalid']}
    aria-describedby={[props['aria-describedby'], message ? errorId : ''].filter(Boolean).join(' ') || undefined}
    onInvalid={e => { e.preventDefault(); if(e.currentTarget.form) revealFormError(e.currentTarget.form); validate(e.currentTarget); if (!e.currentTarget.validity.valid) setValidation(e.currentTarget.validationMessage || 'مقدار معتبر وارد کن.'); props.onInvalid?.(e); }}
    onBlur={e => { validate(e.currentTarget); props.onBlur?.(e); }}
    onChange={e => {
      if (numeric) {
        const node = e.currentTarget;
        const position = node.selectionStart ?? node.value.length;
        const prefix = normalizeDigits(node.value.slice(0, position)).replace(/[,٬،]/g, '');
        node.value = rawNumericInput(node.value);
        props.onChange?.(e);
        const formatted = formatNumericInput(node.value);
        node.value = formatted;
        let digits = 0, caret = 0;
        while (caret < formatted.length && digits < prefix.length) { if (!/[,٬،]/.test(formatted[caret])) digits++; caret++; }
        node.setSelectionRange(caret, caret);
      } else props.onChange?.(e);
      if (numeric || validation) validate(e.currentTarget);
      else { e.currentTarget.setCustomValidity(''); setValidation(''); }
    }}/>{message && <small id={errorId} className="field-error" role="alert">{message}</small>}</span>;
}

export function FieldSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="select-trigger" className={cn('finance-select', className)} {...props}/>;
}

export function FieldTextarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn('finance-textarea', className)} {...props}/>;
}

export function Surface<T extends ElementType = 'div'>({ as, className, ...props }: { as?: T; className?: string } & Omit<ComponentProps<T>, 'as' | 'className'>) {
  const Tag = as ?? 'div';
  return <Card asChild className="finance-surface"><Tag className={className} {...(Tag === 'button' ? { type: 'button' } : {})} {...props}/></Card>;
}
