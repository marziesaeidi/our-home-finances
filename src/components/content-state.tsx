import type { ReactNode } from 'react';
import { Action } from './finance-ui';

export function Empty({ children, title, desc, action, onClick, variant = 'panel', role }: { children?: ReactNode; title?: string; desc?: string; action?: string; onClick?: () => void; variant?: 'inline' | 'panel'; role?: string }) {
  if (variant === 'inline') return <p className="ds-empty" role={role}>{children ?? desc ?? title}{action && <Action type="button" variant="default" onClick={onClick}>{action}</Action>}</p>;
  return <div className="empty" role={role}><span aria-hidden="true">◌</span>{title && <strong>{title}</strong>}{(desc || children) && <p>{desc ?? children}</p>}{action && <Action variant="default" type="button" className="primary" onClick={onClick}>{action}</Action>}</div>;
}

export function Detail({ label, value, variant = 'detail', tone, as: Tag = 'div', ...props }: { label: ReactNode; value: ReactNode; variant?: 'detail' | 'metric'; tone?: string; as?: 'div' | 'span'; role?: string; 'aria-live'?: 'polite' | 'assertive' | 'off' }) {
  return <Tag className={variant === 'metric' ? 'ds-metric' : 'detail-row'} {...props}><span>{label}</span>{variant === 'metric' ? <bdi className="ds-amount"><span className={tone}>{value}</span></bdi> : <strong className={tone}><bdi>{value}</bdi></strong>}</Tag>;
}
