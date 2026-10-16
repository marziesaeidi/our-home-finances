import type { ReactNode } from 'react';
import { AppIcon } from './app-icon';
import { Wallet, FolderOpen, Gem, ChartNoAxesCombined, CalendarDays } from 'lucide-react';

const icons = { account: Wallet, folder: FolderOpen, asset: Gem, report: ChartNoAxesCombined, budget: CalendarDays };
export function CollectionHeading({ kind, children, description, accent, symbol }: { kind: keyof typeof icons; children: ReactNode; description?: ReactNode; accent?: string; symbol?: string }) {
  const Icon = icons[kind];
  return <div className="collection-heading"><span className="collection-icon" style={accent ? { color: accent } : undefined} aria-hidden="true">{symbol ? <AppIcon symbol={symbol} size={28}/> : <Icon size={25}/>}</span><div className="collection-copy"><h2>{children}</h2>{description && <p>{description}</p>}</div></div>;
}
