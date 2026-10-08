import type { Data, Transaction } from './types';
import { today } from './utils';
import { canonicalDay } from './calendar';
const day = (offset: number) => canonicalDay(new Date(Date.now() - offset * 86400000));
const sample: [string,number,string,string,string,number,boolean?][] = [
 ['خرید سوپرمارکت',850000,'خوراک','shared','مرزیه',0],['بنزین',1200000,'حمل‌ونقل','shared','علی',1],['قسط خودرو',8000000,'اقساط','shared','مرزیه',2],['کافه',460000,'تفریح','private','مرزیه',3],['خرید میوه',680000,'خوراک','shared','علی',4],['اجاره خانه',15000000,'خانه','shared','علی',5],['تاکسی',230000,'حمل‌ونقل','shared','مرزیه',6],['داروخانه',380000,'سلامت','shared','مرزیه',7],['اینترنت خانه',490000,'قبوض','shared','علی',8],['رستوران',1350000,'تفریح','shared','علی',9],['خرید لباس',2100000,'خرید','private','مرزیه',10],['قبض برق',620000,'قبوض','shared','مرزیه',11],['سوپرمارکت',1250000,'خوراک','shared','علی',12],['سرویس خودرو',1800000,'حمل‌ونقل','shared','علی',13],['هدیه',900000,'خرید','private','مرزیه',14],['خرید خانه',760000,'خانه','shared','مرزیه',15],['بیمه',1650000,'سلامت','shared','علی',16],['سینما',420000,'تفریح','shared','مرزیه',17],['قسط وام بانک',3500000,'اقساط','shared','علی',18],['خرید هفتگی',1940000,'خوراک','shared','مرزیه',19],['حقوق مرزیه',32000000,'درآمد','private','مرزیه',2,true],['حقوق علی',23000000,'درآمد','shared','علی',4,true],['فروش وسیله',2500000,'درآمد','shared','مرزیه',16,true],['خرید ماه قبل',1800000,'خوراک','shared','علی',36],['اجاره ماه قبل',15000000,'خانه','shared','مرزیه',39],['حقوق ماه قبل',23000000,'درآمد','shared','علی',38,true]
];
const transactions: Transaction[] = sample.map(([title,amount,category,visibility,createdBy,offset,income],i) => ({ id:`seed-${i}`, title, amount, category, visibility:visibility as 'shared'|'private', createdBy:createdBy as 'مرزیه'|'علی', date:day(offset), type:income?'income':'expense', accountId: visibility==='private'?'personal':'shared' }));
export const initialData: Data = {
 transactions,
 accounts:[{id:'shared',name:'حساب مشترک',type:'حساب مشترک',balance:42000000,visibility:'shared'},{id:'personal',name:'کارت شخصی مرزیه',type:'حساب بانکی',balance:28000000,visibility:'private'},{id:'ali',name:'کارت شخصی علی',type:'حساب بانکی',balance:10500000,visibility:'private'},{id:'cash',name:'کیف پول',type:'نقدی',balance:2000000,visibility:'shared'}],
 loans:[{id:'car',name:'وام خودرو',total:96000000,installment:8000000,count:12,paid:4,nextDate:'۱۰ مهر',frequency:'ماهانه'},{id:'bank',name:'وام بانک',total:126000000,installment:3500000,count:36,paid:8,nextDate:'۱۵ مهر',frequency:'ماهانه'}],
 goals:[{id:'travel',name:'سفر شمال',target:120000000,saved:45000000,targetDate:'اسفند ۱۴۰۵',visibility:'shared'},{id:'emergency',name:'صندوق اضطراری',target:100000000,saved:32000000,targetDate:'خرداد ۱۴۰۶',visibility:'shared'}],
 recurring:[{id:'rent',name:'اجاره خانه',amount:15000000,frequency:'ماهانه',nextDate:'۱ آبان',category:'خانه',owner:'علی',reminder:true},{id:'internet',name:'اینترنت خانه',amount:490000,frequency:'ماهانه',nextDate:'۱۲ مهر',category:'قبوض',owner:'مرزیه',reminder:true},{id:'insurance',name:'بیمه',amount:1650000,frequency:'ماهانه',nextDate:'۲۰ مهر',category:'سلامت',owner:'علی',reminder:false}],
 budget:{total:50000000,categories:{'خوراک':15000000,'خانه':18000000,'حمل‌ونقل':5000000,'تفریح':5000000,'خرید':7000000}}
};
export const categories = ['خوراک','خرید','خانه','حمل‌ونقل','سلامت','تفریح','قبوض','سفر','اقساط','سایر'];
export const currentDate = today();
