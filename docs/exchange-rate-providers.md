# Exchange rate providers and deployment

Documentation inspected on 2026-10-08. No provider account, secret, subscription, or authenticated response was supplied. Availability below means documented service availability, not a measured uptime or authenticated integration test. No current quote is seeded.

| Provider | Verified documentation | Rate/unit considerations | Update and access |
| --- | --- | --- | --- |
| Navasan | [API plans and symbols](https://www.navasan.net/api/), [request/response guide](https://www.navasan.tech/webserviceguide/), [English description](https://www.navasan.net/en/api/) | `usd_sell` is Tehran USD sell, distinct from `usd_farda_sell` (forward/tomorrow) and official bank rates. JSON includes value and Unix timestamp. English page describes IRR; Persian examples do not explicitly settle denomination. Require explicit verification of quote units with the subscribed account. | Free plan states every two hours, 120 monthly requests; paid plans advertise instantaneous updates with plan-specific quotas. Latest and historical/daily/OHLC services are documented. Credentials required. |
| Bonbast | [API ordering and examples](https://www.bonbast.com/webmaster), [market display](https://www.bonbast.com/) | Website explicitly says open/free-market prices in Toman (10 rials). API marketing says IRR. `usd1` sell / `usd2` buy; confirm API units and effective timestamps from contracted API response. Do not infer them from the website heading. | Paid HTTP POST API with secret hash; packages advertise live rates and query limits. Published page does not specify a numeric update interval or timestamp schema. No adapter enabled without verifying those details. |

The similarly named `bon-bast.com` search results were excluded; the investigated Bonbast domain is `bonbast.com`.

## Current implementation

The existing React/Vite/localStorage architecture remains intact. Manual receipt rates work without a network connection or server. The provider interface and date-specific local cache accept only explicitly denominated IRT-per-unit quotes, market buy/sell metadata, source, effective time, retrieval time and update description. Wrong date, future timestamp, bad amount and wrong target unit fail validation. Failed refresh returns a clearly marked stale/offline cached quote, or requests manual entry when no verified cache exists. A new quote never updates saved expenses.

An optional Node read-only proxy connects Navasan `usd_sell` using HTTPS. It accepts only USD and an effective timestamp matching the purchase day in Tehran. A historical date for which the latest service has no matching observation returns an error; enter the historical receipt rate manually. EUR and configured additional currencies also use manual rates until a provider adapter for their specific rate type and units is verified. Daily OHLC is not used as a purchase-time observation. HTTPS availability and subscribed payload remain to be verified with real credentials; no insecure HTTP fallback is permitted.

Set server environment variables outside the repository:

```powershell
$env:NAVASAN_API_KEY = '<your subscribed key>'
$env:NAVASAN_QUOTE_UNIT = 'IRR' # or IRT ONLY after verifying your account response units
$env:NAVASAN_UPDATE_DESCRIPTION = 'دو ساعت (طرح رایگان)'
$env:FX_REFRESH_MINUTES = '120'
npm run rates
```

In another terminal run `npm run dev`. Vite proxies `/api/exchange-rates` to localhost:8788 for development and preview. A production host must route this path to the Node service; serving the static `dist` directory alone provides manual entry and cached fallback, not a credentialed API. Keys never enter `VITE_*`, frontend code, localStorage, client errors, or logs. EUR/other provider endpoints are deliberately unavailable until verified. Match the refresh period to subscription quotas: two-hour polling of both a browser and server still consumes requests when the server cache expires; a 120-request monthly plan is not suitable for continuous two-hour refresh. The UI requests rates on demand, not continuously.

## Accounting and compatibility

- `Transaction.amount` and `currency: IRT` remain the historical reporting value. `fx` retains the original amount/currency and applied rate. This preserves existing reports and legacy FX asset/obligation records.
- New `foreignExpense.version: 1` retains a full quote, merchant, account currency, debit and fee in **native minor units**, fee value in Toman, and the payment-account historical conversion rate. Purchase value and actual payment may differ for an intermediary. Reports add the booked purchase value plus the explicitly entered fee once; cash-flow reports convert actual debit plus fee at the recorded payment rate.
- IRT and IRR have zero decimals, USD/EUR two; custom currencies declare a scale. Integer safe ranges and BigInt arithmetic reject overprecision and overflow. Conversion rounds half-up to whole Toman. IRR is always exactly 0.1 IRT, never a market quotation.
- Manual conversion overrides require a reason and retain the original quote. Historical correction reverses the original native account debit and posts a linked replacement atomically through the existing durable state update, retaining the old event and FX snapshot. Folder assignment does not post another event.
- Subscription templates are reminders. Each later payment requires a fresh original amount/rate; templates never automatically debit funds using an old rate.
- Existing v1 migration and v2 backup/recovery semantics remain unchanged. New fields are additive and optional on v2; absence means the previous IRT behavior. Existing stored values are not rewritten or replayed, and unknown expense versions/configuration fail validation without overwriting storage. Previously stored FX metadata without retrieval timestamps is preserved as unknown, not fabricated.
- Non-IRT account balances remain in their own minor units and are displayed independently. Current Toman cash/net-worth totals explicitly exclude unvalued foreign accounts; historical expense rates are not used to pretend those accounts have a current valuation. Legacy non-expense forms remain restricted to IRT accounts.

`npm test` covers native debits/reversals, exact unit normalization, precision, fees, historical correction and reload, cache/error/date behavior, subscriptions, folders, visibility, additive compatibility and rendered Persian dashboard states. Authenticated provider availability has not been tested.
