import type { ReactNode } from 'react';
import { Wallet, FolderOpen, Gem, ChartNoAxesCombined, CalendarDays } from 'lucide-react';

const icons = { account: Wallet, folder: FolderOpen, asset: Gem, report: ChartNoAxesCombined, budget: CalendarDays };
export function CollectionHeading({ kind, children, description, accent }: { kind: keyof typeof icons; children: ReactNode; description?: ReactNode; accent?: string }) {
  const Icon = icons[kind];
  return <div className="collection-heading"><span className="collection-icon" style={accent ? { color: accent } : undefined} aria-hidden="true"><Icon size={25}/></span><div className="collection-copy"><h2>{children}</h2>{description && <p>{description}</p>}</div></div>;
}
