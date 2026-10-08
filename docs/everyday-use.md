# Everyday use and delivery checklist

Verified on 2026-10-08. This is a browser application, with local financial records; it does not connect to a bank or execute real payments.

## Launch

Use Node.js 24 and run these commands in the application directory:

```sh
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Open `http://127.0.0.1:4173`. Keep the same browser profile, hostname and port on subsequent launches: localStorage is specific to the origin. `npm run dev` also builds and starts a preview. To work on source with hot reload, use `npx vite --host 127.0.0.1`. The application shell is cached by a service worker in production previews on localhost/HTTPS after the first successful load. It can then reopen without the server. A new shell waits for existing tabs to close before replacing the active version. The font is bundled with its OFL license; no Google Fonts request is needed.

## Everyday workflow

- Use **افزودن تراکنش** for income, expenses, transfers and savings allocations. Select an account and financial date. Transfers need two distinct toman accounts; use the foreign expense module for foreign account debits. Recording a transaction only changes the local ledger.
- Use **بیشتر ← تنظیمات** to create/edit/archive categories with icons, colors and income/expense type, choose theme, preferred currency for multi-currency forms, calendar and Persian number display. The reporting currency remains toman; budget periods and monthly recurrence remain Jalali. Preferences do not convert existing balances or rewrite booked rates.
- Use **بیشتر ← حساب‌ها** to rename accounts and edit their type. Create toman accounts there; create native currency accounts through the foreign expenses settings. Only a zero account with no history or references can be deleted. Financial opening amounts and currency of existing accounts are protected.
- Use **تنظیم کارت‌های داشبورد** for checkbox visibility and keyboard-operable up/down ordering. Preferences are saved per viewer.
- Use **برنامه مالی** for personal folders, goals, holdings, budgets and reports. Contributions reserve existing cash; goals are not counted again as an asset. Asset purchase/sale events exchange cash and quantity; sales use weighted average cost basis. Missing/stale prices are shown rather than replaced with a guessed current rate.
- Use **تعهدات مالی** for loans, checks and recurring templates. A pending obligation does not move money. Confirm real payments manually. For historical foreign purchases/payments, supply the actual historical rate and source. Review any legacy due date without a year before paying it.
- Correct financial records with the module's correction/reversal controls. Historical events remain available; reversal restores linked account, goal, holding or payment projections. Referenced historical entities are retained or protected.

## Backups and recovery

Download **دریافت پشتیبان کامل** regularly, especially before changing browser/device or clearing site data. The portable JSON contains all transactions (including reversals and corrections), accounts and entries, folders, goals, holdings and price/opening revisions, loans and installments, checks/obligations, recurring templates, categories, budgets, settings and original booked exchange rates. Provider response caches and the device lock are not financial records and are not included. CSV is an additional inspection format, not a full restore format.

Select a JSON file with **بررسی فایل پشتیبان**. Validation precedes every write: unsupported versions, duplicate IDs/active occurrences, invalid links/amounts/preferences and inconsistent projections are rejected. Review the displayed transaction count, then restore. Restore replaces the active snapshot; it never appends records, so repeated restore of the same file cannot duplicate them. The current JSON is offered for download first, and the previous stored snapshot is retained. Check that the download exists: the browser cannot verify that you retained the file.

Storage/quota/concurrent-tab errors do not advance React financial state or silently reset it to sample data. For invalid stored data the recovery page offers the original JSON and the last valid snapshot. Preserve the original before recovery. A stale tab must reload before writing. The first visit to a genuinely empty origin still loads demonstration data, as in the existing app; importing your backup replaces it.

## Privacy and optional device lock

Financial data is stored as **unencrypted JSON** in this browser's localStorage (`khaneh-v2`, `khaneh-v2-previous`, preserved legacy originals and recovery copies). Backups are also unencrypted. The UI's member switch/private visibility is a convenience filter, not authentication or a security boundary between users. There is no remote financial database or cross-device synchronization to protect with remote access rules.

The optional lock in settings uses Web Crypto PBKDF2 SHA-256 with a random salt and 310,000 iterations. Only its verifier is stored in `khaneh-device-lock`; the password is not stored in plaintext or in financial backups. The screen locks on reload, when hidden, manually, and after five minutes without keyboard/pointer activity. The mounted app is hidden and inert while locked, preserving current records and unfinished forms. This is a screen privacy feature, not data encryption or protection against someone with browser/developer-tool access. Lock support requires Web Crypto (normally localhost/HTTPS).

If you forget the lock password, a person with access to the browser can remove only the `khaneh-device-lock` entry in Developer Tools → Application → Local Storage for this origin and reload. Do not clear the whole site: it contains your financial data. This deliberate recovery capability also illustrates the lock's security limits.

No analytics or tracking was added. Fonts are local. The optional same-origin exchange-rate proxy keeps provider keys exclusively in server environment variables; financial transaction contents are not sent to it. It receives a currency and requested day. It binds to loopback, has a request timeout, rejects unverified/mismatched quotes and supports cached/manual fallback. See [provider setup](exchange-rate-providers.md). Ordinary financial writes and backups do not require that proxy.

## Verification and limitations

```sh
npm test
npm run typecheck
npm run build
```

The suite uses deterministic fixtures covering folder expenses, transfers, savings, gold/crypto purchases, fractional quantities, partial sales, native-currency spending, installment payments, check settlement, recurring payments, historical rates, edits/reversals, migrations, reload roundtrips, storage failure and concurrent tabs. It additionally checks category/budget links, safe account deletion, malformed/repeated imports, formatting preferences, password verifiers and forged ledger effects. There is no configured lint command; TypeScript's strict/no-unused checks run with typecheck/build.

Browser checks use a separate localhost test origin with demonstration records. Confirmed preference persistence across reload, app-shell reload with the preview server stopped, mobile RTL layout and keyboard modal navigation. They do not replace device-level testing on every browser or operating system. The lock verifier is automated-tested; real user passwords are not entered during QA.

Remaining platform/domain limits: localStorage capacity and profile/site-data deletion, no cloud sync/remote login, no background payment/notification engine, optional provider credentials require setup, and no encryption. Legacy opening snapshots/unknown principal splits/yearless due dates remain preserved with migration notices; missing historical evidence is not fabricated. Cold offline startup requires a successful initial shell cache; unsupported/private browsers may not retain it. Cross-currency bank transfers remain outside the supported transfer form rather than applying a guessed rate. UI totals may remain incomplete where asset/account valuation or old loan principal is unknown.

## Implemented checklist

- [x] Editable income/expense categories, custom icons/colors and safe archival
- [x] User-defined accounts, metadata editing and protected deletion
- [x] Reorderable/hideable dashboard widgets
- [x] Light/dark mode within the existing visual identity
- [x] Default currency for multi-currency entry, Jalali/Gregorian date entry/display and Persian digit preference
- [x] Custom goals and financial folders
- [x] Portable complete JSON, CSV inspection export and validation before restore
- [x] Repeated restores and recurring retries do not append duplicate records
- [x] Backup/restore/storage feedback and original/previous snapshot recovery
- [x] Local storage/privacy inspection, no client API keys, local fonts and no added analytics
- [x] Optional local screen lock with explicit non-encryption wording
- [x] Atomic validated snapshots, duplicate submission guard and linked financial reversals
- [x] Offline shell, manual/cached rates and request failures/timeouts
- [x] Mobile RTL, visible keyboard focus, modal focus containment/restoration and form validation
- [x] All requested reconciliation domains covered by automated tests
- [x] Build/typecheck/tests and launch/use/recovery documentation
