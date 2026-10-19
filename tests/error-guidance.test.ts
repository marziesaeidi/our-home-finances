import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {errorGuidance, type ErrorDestination} from '../src/error-guidance';
import {ErrorNotice,ErrorNavigationContext} from '../src/components/error-notice';

test('insufficient funds gives one clear income action without posting money',()=>{
 const guide=errorGuidance('برای این خرید با کارمزد ۵۱۰ تومان لازم است؛ مبلغ قابل استفاده از حساب ۴۰۰ تومان است.');
 assert.equal(guide.popup,true);
 assert.deepEqual(guide.actions?.map(a=>a.destination),['income']);
 assert.match(guide.solution,/واقعاً/);
 assert.match(guide.solution,/همین حساب/);assert.equal(guide.title,'موجودی حساب کافی نیست');assert.equal(guide.hideTechnical,true);assert.equal(guide.actions?.[0].label,'رفتن به ثبت تراکنش');
});
test('cashless correction guides the user back to the fee or transaction mode instead of increasing cash',()=>{
 const guide=errorGuidance('اصلاح بدون وجه نقد کارمزد نقدی ندارد.');
 assert.equal(guide.popup,true);assert.match(guide.solution,/کارمزد را صفر/);assert.match(guide.solution,/خاموش/);
 assert.equal(guide.actions,undefined);
});
const cases:[string,string,ErrorDestination?][]=[
 ['فقط حساب صفر و بدون سابقه یا پیوند قابل حذف است؛ آخرین حساب حفظ می‌شود.','سابقه'],
 ['ابتدا رویدادهای جدیدتر این دارایی را برگشت بده.','وابسته','all-transactions'],
 ['برداشت باید از تخصیص ثبت‌شده همین حساب باشد؛ پس‌انداز افتتاحیه محل تأمین مشخصی ندارد.','برداشت','savings'],
 ['هدف تکمیل‌شده یا بایگانی‌شده را ابتدا فعال کن.','باکس','savings'],
 ['مقدار دارایی کافی نیست.','مقدار دارایی','assets'],
 ['دسترسی این عضو فقط برای مشاهده است.','دسترسی','household'],
 ['این قسط قبلاً پرداخت شده است.','پرداخت','obligations'],
 ['حساب معتبر انتخاب کن.','حساب','accounts'],
 ['مبدأ و مقصد انتقال باید دو حساب متفاوت باشند.','حساب','accounts'],
 ['مبلغ تومان با هزینه اصلی و نرخ روز تراکنش یکسان نیست.','قیمت'],
 ['تاریخ معتبر لازم است.','تاریخ'],
 ['رمز عبور و تکرار آن یکسان نیستند.','ورود'],
 ['فایل پشتیبان معتبر نیست.','اطلاعات','backup'],
 ['مبلغ را به تومان و بدون اعشار وارد کن.','مقدار'],
];
for(const [message,title,destination] of cases)test(`error help gives a relevant next step: ${message}`,()=>{
 const guide=errorGuidance(message);assert.ok(guide.title.includes(title));assert.ok(guide.solution.length>30);
 if(destination)assert.ok(guide.actions?.some(a=>a.destination===destination));
});
test('network and conflict guidance never assures that an uncertain write failed or suggests duplicate posting',()=>{
 const network=errorGuidance('Failed to fetch');assert.equal(network.hideTechnical,true);assert.match(network.solution,/ممکن است درخواست قبلی به سرور رسیده/);
 const conflict=errorGuidance('داده در پنجره دیگری تغییر کرده است؛ صفحه را تازه‌سازی کن تا تغییری از بین نرود.');
 assert.match(conflict.solution,/تغییر پیشنهادی را نگه دار/);
 const pending=errorGuidance('یک تغییر تأییدنشده از اجرای قبلی باقی مانده است.');assert.match(pending.solution,/دوباره ثبت نکن/);
});
test('rate limit and protocol failures get readable guidance without inventing account actions',()=>{
 assert.match(errorGuidance('تلاش‌های ورود زیاد بود؛ ۱۵ دقیقه بعد دوباره امتحان کن.').solution,/صبر/);
 const protocol=errorGuidance('Origin rejected');assert.equal(protocol.hideTechnical,true);assert.equal(protocol.actions,undefined);
});
test('error notice shows actionable navigation only when the current app supplies it, and buttons never submit forms',()=>{
 const message='موجودی آزاد حساب کافی نیست.';
 const plain=renderToStaticMarkup(createElement(ErrorNotice,{message,autoPopup:false}));
 assert.ok(plain.includes('چه کار کنم؟'));assert.ok(plain.includes(message));assert.ok(!plain.includes('دیدن حساب‌ها'));
 let navigated=false;
 const connected=renderToStaticMarkup(createElement(ErrorNavigationContext.Provider,{value:()=>{navigated=true;}},createElement(ErrorNotice,{message,autoPopup:false})));
 assert.ok(connected.includes('رفتن به ثبت تراکنش'));assert.ok(connected.includes('موجودی حساب کافی نیست'));assert.ok(!connected.includes('دیدن حساب‌ها'));assert.ok(!connected.includes('دیدن باکس‌های پس‌انداز'));
 assert.equal(navigated,false);assert.doesNotMatch(connected,/<button(?![^>]*type="button")/);
 const blocked=renderToStaticMarkup(createElement(ErrorNavigationContext.Provider,{value:()=>{navigated=true;}},createElement(ErrorNotice,{message,autoPopup:false,allowNavigation:false,dialogEnabled:false})));
 assert.ok(!blocked.includes('دیدن حساب‌ها'));assert.ok(!blocked.includes('راهنمای رفع خطا'));
});
test('unknown technical failures remain available for diagnosis and are escaped',()=>{
 const message='<script>alert(1)</script> InternalError';
 const rendered=renderToStaticMarkup(createElement(ErrorNotice,{message}));
 assert.ok(rendered.includes('جزئیات خطا'));assert.ok(rendered.includes('&lt;script&gt;'));assert.ok(!rendered.includes('<script>'));
 assert.match(errorGuidance(message).solution,/اگر خطا باقی ماند/);
});

test('future payments and foreign accounts point to the supported flows',()=>{
 assert.ok(errorGuidance('پرداخت آینده را در چک‌ها و تعهدات ثبت کن؛ هنوز از موجودی کم نمی‌شود.').actions?.some(a=>a.destination==='obligations'));
 assert.ok(errorGuidance('برای حساب ارزی از ماژول هزینه ارزی استفاده کن.').actions?.some(a=>a.destination==='foreign'));
});
