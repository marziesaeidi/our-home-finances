import type { ComponentProps, ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Receipt } from 'lucide-react';

export function ReportCard({title,description,icon=<Receipt/>,children,className='',...props}:Omit<ComponentProps<'div'>,'title'> & {title:ReactNode;description?:ReactNode;icon?:ReactNode}) {
  return <Card className={`ds-card report-card ${className}`} {...props}><CardHeader><CardTitle className="ds-title">{icon}{title}</CardTitle>{description&&<CardDescription>{description}</CardDescription>}</CardHeader><CardContent>{children}</CardContent></Card>;
}
export function Amount({children}:{children:ReactNode}) { return <bdi className="ds-amount">{children}</bdi>; }
export function Empty({children}:{children:ReactNode}) { return <p className="ds-empty">{children}</p>; }
export function Metric({label,value,tone}:{label:string;value:string;tone?:string}) { return <div className="ds-metric"><span>{label}</span><Amount><span className={tone}>{value}</span></Amount></div>; }
