import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/utils';

/** Shared layout only; each flow owns its actions, busy state and submission. */
export function ActionGroup({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('detail-actions', className)} {...props}/>;
}

export function ActionFooter({ className, children, ...props }: ComponentProps<'div'>) {
  return <div className={cn('app-action-footer', className)} {...props}>{children}</div>;
}

/** Filter groups use pressed buttons; navigation tabs retain their own semantics. */
export function ChoiceGroup({ className, role = 'group', ...props }: ComponentProps<'div'>) {
  return <div role={role} className={className} {...props}/>;
}

export function StatusBadge({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('badge', className)} {...props}/>;
}

/** Preserve native progress semantics and each feature's value/max units. */
export function Meter({ className, ...props }: ComponentProps<'progress'>) {
  return <progress aria-label="پیشرفت" className={cn('app-meter', className)} {...props}/>;
}

export function Amount({ children }: { children: ReactNode }) {
  return <bdi className="ds-amount">{children}</bdi>;
}
