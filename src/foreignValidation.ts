import type { FinanceData, Transaction } from './types';
import { currencyDefinition, minorUnits, nativeText } from './currencies';
import { add, converted, decimal } from './decimal';
import { validateQuote } from './exchangeRates';
export function validateForeignExpense(data: FinanceData, t: Transaction) {
  const f=t.foreignExpense; if(!f)return;
  if(f.version!==1 || t.type!=='expense' || !t.fx || t.paymentAllocation || t.loanId || t.assetId || t.obligationId || t.allocationOnly || !!t.fee || !f.merchant?.trim() || typeof f.subscription!=='boolean')throw new Error('مشخصات هزینه ارزی معتبر نیست.');
  currencyDefinition(t.fx.currency,data.currencyDefinitions);
  if(t.fx.currency==='IRT' || minorUnits(t.fx.originalAmount,t.fx.currency,data.currencyDefinitions)<=0)throw new Error('مبلغ اصلی ارزی معتبر لازم است.');
  validateQuote(f.quote,t.fx.currency,t.date);
  if(f.quote.rate!==t.fx.rate || f.quote.source!==t.fx.source || t.fx.date!==t.date || t.fx.direction!=='IRT-per-unit' || t.fx.rounding!=='half-up')throw new Error('نرخ تاریخی همخوان نیست.');
  if(t.fx.currency==='IRR' && (decimal(t.fx.rate).units*10n!==decimal(t.fx.rate).scale || f.quote.rateType!=='denomination'))throw new Error('هر تومان دقیقاً ۱۰ ریال است.');
  const account=data.accounts.find(a=>a.id===t.accountId);
  if(!account || f.paymentCurrency!==account.currency)throw new Error('ارز برداشت با حساب همخوان نیست.');
  for(const n of [f.debitMinor,f.feeMinor,f.feeToman])if(!Number.isSafeInteger(n)||n<0)throw new Error('برداشت و کارمزد معتبر نیست.');
  if(f.debitMinor<=0 || decimal(f.paymentRate).units<=0n)throw new Error('مبلغ برداشت و نرخ حساب لازم است.');
  if(f.paymentCurrency==='IRT' && decimal(f.paymentRate).units!==decimal(f.paymentRate).scale || f.paymentCurrency==='IRR' && decimal(f.paymentRate).units*10n!==decimal(f.paymentRate).scale)throw new Error('نرخ واحد حساب نادرست است.');
  if(converted(nativeText(f.feeMinor,f.paymentCurrency,data.currencyDefinitions),f.paymentRate)!==f.feeToman)throw new Error('کارمزد تومانی همخوان نیست.');
  if(f.convertedOverride!==undefined){if(!Number.isSafeInteger(f.convertedOverride)||f.convertedOverride<=0||f.convertedOverride!==t.amount||!f.overrideReason?.trim())throw new Error('اصلاح مبلغ دلیل لازم دارد.');}
  else if(converted(t.fx.originalAmount,t.fx.rate)!==t.amount)throw new Error('مبلغ تبدیل‌شده همخوان نیست.');
  add(f.debitMinor,f.feeMinor);add(t.amount,f.feeToman);
}
