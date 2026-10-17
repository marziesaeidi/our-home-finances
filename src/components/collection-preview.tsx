import type { ReactNode } from 'react';
import { ChevronLeft, FolderOpen, Gem, Wallet, PiggyBank } from 'lucide-react';
import { AppIcon } from './app-icon';
import { Surface } from './finance-ui';

const icons = { account: Wallet, folder: FolderOpen, asset: Gem, box: PiggyBank };

export function CollectionPreview({ kind, name, amount, footer, symbol, accent, onClick }: {
  kind: keyof typeof icons;
  name: string;
  amount: ReactNode;
  footer: ReactNode;
  symbol?: string;
  accent?: string;
  onClick: () => void;
}) {
  const Icon = icons[kind];
  return <Surface as="button" type="button" className="card loan-preview collection-preview" onClick={onClick}>
    <div className="loan-preview-top">
      <span className="loan-progress-ring collection-preview-icon" aria-hidden="true">
        <span style={accent ? { color: accent } : undefined}>{symbol ? <AppIcon symbol={symbol} size={25}/> : <Icon size={25}/>}</span>
      </span>
      <span className="loan-preview-name"><strong>{name}</strong><small>{amount}</small></span>
      <span className="loan-preview-link">جزئیات <ChevronLeft size={18}/></span>
    </div>
    <div className="loan-preview-footer">{footer}</div>
  </Surface>;
}
