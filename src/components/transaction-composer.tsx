import { ActionFooter } from './action-layout';
import type { ReactNode } from 'react';
import { ArrowUpLeft, ArrowDownRight, ArrowLeftRight, Sprout, BadgeDollarSign, CreditCard, Target, Repeat, Wallet, CalendarDays, ChevronDown } from 'lucide-react';
import { DateField } from '../DateField';
import { persianDate, today } from '../utils';

const themes:Record<string,{icon:string;title:string;hint:string}>={
 'account-edit':{icon:'◈',title:'مشخصات حسابت',hint:'نام و نوع حساب را تغییر بده؛ مانده و سابقه تراکنش‌ها حفظ می‌شوند.'},
 'box-settings':{icon:'🌱',title:'باکس به سلیقه تو',hint:'نام، نماد و تنظیمات نمایش باکس را تغییر بده.'},
 'box-plan':{icon:'🌱',title:'این ماه چقدر کنار می‌گذاری؟',hint:'برنامه پس‌انداز را مشخص کن؛ واریز پول را جدا ثبت می‌کنی.'},
 box:{icon:'🌱',title:'برای یک خواسته، یک باکس',hint:'نام باکس را بنویس؛ مبلغ هدف و تاریخ را می‌توانی بعداً مشخص کنی.'},
 'box-deposit':{icon:'↙',title:'برای هدفت کنار بگذار',hint:'حساب و مبلغ را انتخاب کن؛ پول در همان حساب می‌ماند.'},
 'box-withdraw':{icon:'↗',title:'پول باکس را آزاد کن',hint:'مبلغی از سهم باکس را دوباره برای خرج‌کردن آزاد کن.'},
 asset:{icon:'◈',title:'یک دارایی تازه',hint:'نوع و محل نگهداری را مشخص کن؛ دارایی قبلی را جدا از خرید تازه ثبت می‌کنی.'},
 trade:{icon:'↔',title:'خرید یا فروش دارایی',hint:'مقدار معامله و مبلغ واقعی پرداخت یا دریافت را وارد کن.'},
 valuation:{icon:'◈',title:'دارایی‌ات چقدر می‌ارزد؟',hint:'قیمت هر واحد را ثبت کن؛ موجودی حساب تغییر نمی‌کند.'},
 opening:{icon:'◈',title:'اصلاح دارایی اولیه',hint:'مشخصات، مقدار و هزینه قبلی را اصلاح کن؛ سابقه حفظ می‌شود.'},
 check:{icon:'▤',title:'یک چک جدید',hint:'مبلغ، طرف چک و سررسید را وارد کن؛ پرداخت را پس از انجام ثبت می‌کنی.'},
 budget:{icon:'◎',title:'سقف خرج این ماه',hint:'کل بودجه را مشخص کن؛ سقف دسته‌ها و پوشه‌ها اختیاری است.'},
 folder:{icon:'▣',title:'هزینه‌های یک موضوع، کنار هم',hint:'یک نام انتخاب کن؛ مثلاً سفر، خانه یا یک پروژه.'},

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
 const Icon=({box:Sprout,'box-deposit':Sprout,'box-withdraw':ArrowUpLeft,asset:Wallet,trade:ArrowLeftRight,valuation:Target,opening:Wallet,check:CreditCard,budget:Target,folder:Wallet,expense:ArrowUpLeft,income:ArrowDownRight,transfer:ArrowLeftRight,saving:Sprout,foreign:BadgeDollarSign,installment:CreditCard,loan:CreditCard,goal:Target,recurring:Repeat,account:Wallet} as Record<string,typeof Wallet>)[kind]??ArrowUpLeft;
 return <header className="composer-intro"><span className="composer-emblem" aria-hidden="true"><Icon size={26}/></span><h2>{theme.title}</h2><p>{theme.hint}</p></header>;
}
export function ComposerFooter({children,summary}:{children:ReactNode;summary:string}){
 return <div className="composer-footer-space"><ActionFooter className="composer-footer app-action-footer"><p className="composer-receipt" aria-live="polite" aria-atomic="true">{summary}</p>{children}</ActionFooter></div>;
}
export function CompactDate({value,onChange,label='تاریخ'}:{value:string;onChange:(value:string)=>void;label?:string}){
 return <details className="composer-date"><summary><CalendarDays className="composer-date-icon" size={22} aria-hidden="true"/><span>{label}</span><strong>{value===today()?'امروز':persianDate(value)}</strong><ChevronDown className="disclosure-arrow" size={18} aria-hidden="true"/></summary><DateField label={label} value={value} onChange={onChange}/></details>;
}
