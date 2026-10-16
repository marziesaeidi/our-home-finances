import type { ReactNode } from 'react';
import { Action } from './finance-ui';

export function Empty({ children, title, desc, action, onClick }: { children?: ReactNode; title?: string; desc?: string; action?: string; onClick?: () => void }) {
  if (!title && !desc && !action) return <p className="ds-empty">{children}</p>;
  return <div className="empty"><span aria-hidden="true">◌</span>{title && <strong>{title}</strong>}{(desc || children) && <p>{desc ?? children}</p>}{action && <Action type="button" className="primary" onClick={onClick}>{action}</Action>}</div>;
}

export function Detail({ label, value, variant = 'detail', tone }: { label: ReactNode; value: ReactNode; variant?: 'detail' | 'metric'; tone?: string }) {
  return <div className={variant === 'metric' ? 'ds-metric' : 'detail-row'}><span>{label}</span>{variant === 'metric' ? <bdi className="ds-amount"><span className={tone}>{value}</span></bdi> : <strong>{value}</strong>}</div>;
}
