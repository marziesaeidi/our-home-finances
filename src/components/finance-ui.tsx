import type { ComponentProps, ElementType } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { cn } from '../lib/utils';

/** Native form contracts are preserved, including submit defaults and refs. */
export function Action({ className = '', ...props }: ComponentProps<'button'>) {
  const variant = /\b(primary|add-main)\b/.test(className) ? 'default'
    : /\b(danger|plain-danger)\b/.test(className) ? 'destructive'
    : /\boutline\b/.test(className) ? 'outline' : 'ghost';
  return <Button variant={variant} className={cn('finance-action', className)} {...props}/>;
}

export function FieldInput(props: ComponentProps<'input'>) {
  // Native checkboxes, color pickers and file controls retain browser behavior.
  if (['checkbox', 'radio', 'color', 'file', 'range'].includes(props.type ?? ''))
    return <input data-slot="native-input" {...props}/>;
  return <Input {...props}/>;
}

export function FieldSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="select-trigger" className={cn('finance-select', className)} {...props}/>;
}

export function FieldTextarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn('finance-textarea', className)} {...props}/>;
}

export function Surface({ as: Tag = 'div', className, ...props }: ComponentProps<'div'> & { as?: ElementType }) {
  return <Card asChild className="finance-surface"><Tag className={className} {...props}/></Card>;
}
