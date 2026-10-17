import type { ReactNode } from 'react';
import { ArrowUpLeft, ArrowDownRight, ArrowLeftRight, Sprout, BadgeDollarSign, CreditCard, Target, Repeat, Wallet } from 'lucide-react';
import { DateField } from '../DateField';
import { persianDate, today } from '../utils';

const themes:Record<string,{icon:string;title:string;hint:string}>={
 expense:{icon:'↗',title:'یک هزینه تازه',hint:'مبلغ را بنویس و بگو بابت چه چیزی پرداخت کردی.'},
 income:{icon:'↙',title:'یک درآمد تازه',hint:'مبلغ دریافتی و حسابی را که پول به آن واریز شده انتخاب کن.'},
 transfer:{icon:'↔',title:'پول را جابه‌جا کن',hint:'از کدام حساب به کدام حساب؟'},
 saving:{icon:'🌱',title:'یک قدم برای هدفت',hint:'مبلغی از پولت را به یک باکس پس‌انداز اختصاص بده.'},
 foreign:{icon:'💱',title:'خرید با ارز، پرداخت به تومان',hint:'دو مبلغ را وارد کن؛ نرخ واقعی خرید خودکار حساب می‌شود.'},
 installment:{icon:'💳',title:'یک قسط کمتر',hint:'قسط و حساب پرداخت را انتخاب کن.'},
 loan:{icon:'💳',title:'وامت را مرتب ثبت کن',hint:'مبلغ و برنامه اقساط را کنار هم داشته باش.'},
 goal:{icon:'🎯',title:'برای یک هدف تازه',hint:'نام هدف، مبلغ و زمان رسیدن به آن را مشخص کن.'},
 recurring:{icon:'↻',title:'پرداختی که تکرار می‌شود',hint:'مبلغ و زمان پرداخت را مشخص کن.'},
 account:{icon:'👛',title:'یک حساب تازه',hint:'نام حساب و موجودی اولیه‌اش را وارد کن.'},
};
export function ComposerIntro({kind}:{kind:string}){
 const theme=themes[kind]??themes.expense;
 const Icon=({expense:ArrowUpLeft,income:ArrowDownRight,transfer:ArrowLeftRight,saving:Sprout,foreign:BadgeDollarSign,installment:CreditCard,loan:CreditCard,goal:Target,recurring:Repeat,account:Wallet} as Record<string,typeof Wallet>)[kind]??ArrowUpLeft;
 return <header className="composer-intro"><span className="composer-emblem" aria-hidden="true"><Icon size={26}/></span><h2>{theme.title}</h2><p>{theme.hint}</p></header>;
}
export function ComposerFooter({children,summary}:{children:ReactNode;summary:string}){
 return <div className="composer-footer-space"><div className="composer-footer"><p className="composer-receipt" aria-live="polite" aria-atomic="true">{summary}</p>{children}</div></div>;
}
export function CompactDate({value,onChange,label='تاریخ'}:{value:string;onChange:(value:string)=>void;label?:string}){
 return <details className="composer-date"><summary><span aria-hidden="true">◷</span><span>{label}</span><strong>{value===today()?'امروز':persianDate(value)}</strong><span aria-hidden="true">⌄</span></summary><DateField label={label} value={value} onChange={onChange}/></details>;
}
