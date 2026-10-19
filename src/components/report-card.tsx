import type { ComponentProps, ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Receipt } from 'lucide-react';
import { Detail } from './content-state';
export { Empty } from './content-state';

export function ReportCard({title,description,icon=<Receipt/>,children,className='',...props}:Omit<ComponentProps<'div'>,'title'> & {title:ReactNode;description?:ReactNode;icon?:ReactNode}) {
  return <Card className={`ds-card report-card ${className}`} {...props}><CardHeader><CardTitle className="ds-title">{icon&&<span className="navigation-card-icon" aria-hidden="true">{icon}</span>}{title}</CardTitle>{description&&<CardDescription>{description}</CardDescription>}</CardHeader><CardContent>{children}</CardContent></Card>;
}
export { Amount } from './action-layout';
export function Metric({label,value,tone}:{label:string;value:string;tone?:string}) { return <Detail variant="metric" label={label} value={value} tone={tone}/>; }
