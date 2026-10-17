import { Landmark, CreditCard, Repeat } from 'lucide-react';
import { AppIcon } from './app-icon';

export function DetailHero({title,amount,caption,progress=0,kind='loan',symbol,metrics}:{title:string;amount:string;caption:string;progress?:number;kind?:'loan'|'check'|'recurring';symbol?:string;metrics:[string,string][]}){
 const Icon=kind==='loan'?Landmark:kind==='check'?CreditCard:Repeat;
 return <section className="ob-detail-hero"><h2>{title}</h2><span className="loan-progress-ring" style={{background:`conic-gradient(var(--success) ${Math.max(0,Math.min(1,progress))*360}deg,var(--muted) 0deg)`}}><span>{symbol ? <AppIcon symbol={symbol} size={30}/> : <Icon size={30}/>}</span></span><strong className="ob-detail-amount">{amount}</strong><p>{caption}</p><div className="ob-detail-metrics">{metrics.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>;
}
