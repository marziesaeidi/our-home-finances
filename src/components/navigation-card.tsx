import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Surface } from './finance-ui';

export function NavigationCard({ icon, title, description, onClick }: {
  icon: ReactNode;
  title: string;
  description?: string;
  onClick: () => void;
}) {
  return <Surface as="button" className="card navigation-card" onClick={onClick}>
    <span className="navigation-card-icon" aria-hidden="true">{icon}</span>
    <span className="navigation-card-copy">
      <strong>{title}</strong>
      {description && <small>{description}</small>}
    </span>
    <ChevronLeft className="navigation-card-arrow" size={18} aria-hidden="true"/>
  </Surface>;
}
