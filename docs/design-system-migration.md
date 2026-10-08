# Application design system migration

The Dashboard palette in `src/dashboard-tokens.css` is the application-wide source of truth. `src/application-design.css` extends these foundations; `style.css` and `extensions.css` retain content-specific layouts with semantic colors and typography. Financial calculations, persistence schemas, API integrations and navigation destinations are unchanged.

## Audit and migration checklist

- [x] Dashboard, card preferences, dashboard calendar and dropdowns
- [x] Add transaction chooser; expense, income, transfer and saving forms
- [x] Transaction list, search, filters, details, edit, category and visibility actions
- [x] Accounts, balances, account forms and deletion confirmation
- [x] Financial planning navigation
- [x] Personal expense folders, projects, archive, editor and folder selector
- [x] Savings goals, plans, contributions and history
- [x] Assets: gold, cryptocurrency, foreign currency, acquisition/disposal, adjustments and valuations
- [x] Loans, installments, schedule and payment dialogs
- [x] Checks, obligations, settlement, reversal and due calendar
- [x] Recurring payment schedules and confirmation forms
- [x] Foreign purchases, foreign subscriptions, exchange-rate status and historical correction
- [x] Monthly budgets, category limits and budget history
- [x] Financial reports, charts, filters, tables and export controls
- [x] Financial insights
- [x] Notifications and reminders
- [x] Shared household and invitation
- [x] More menu and desktop/mobile navigation
- [x] Backup, restore, personalization and category management
- [x] Automation module
- [x] Lock screen/settings, recovery and offline status
- [x] Shared dialogs, confirmation requests, toast, empty and error states

## Shared components

`Action` uses shadcn Button variants while preserving native button submit defaults. `FieldInput` uses shadcn Input for text, numeric and currency fields. Checkbox, radio, file and color controls preserve native contracts. `FieldSelect` and `FieldTextarea` share the same token-based control surface while retaining existing native change/validation behavior. `Surface` uses shadcn Card with `asChild` to preserve div/section semantics and existing content layouts.

`Dialog` uses shadcn/Radix portal, focus management, dismissal and title semantics, with a compact-screen sheet variant. `useUIRequest` replaces browser prompt/confirm windows for transaction editing, category changes and account deletion. `DateField` retains Jalali parsing, validation and calendar preference while using the shared input. Tables, chart meters, progress bars, badges, tabs, filters, navigation, error/empty states and toast use shared application selectors and the Dashboard semantic palette. Existing Dashboard tooltip, skeleton, Select, Tabs and Calendar primitives remain shared.

## Tokens

| Foundation | Values / behavior |
| --- | --- |
| Primary | `#2563EB` in both themes |
| Light | Background `#F8FAFC`, foreground `#0F172A`, white cards |
| Dark | Background `#0F172A`, foreground `#F8FAFC`, cards `#1E293B` |
| Status | Success, destructive and warning inherited from Dashboard |
| Font | Locally bundled Vazirmatn, weights 400–800; tabular financial numbers |
| Type scale | Caption .75rem, label .8125rem, body .875rem, amount 1rem, heading 1.625rem |
| Spacing | .25/.5/.75/1/1.5rem; card padding 1.25rem |
| Radius | Controls .5rem; cards .75rem; intentional circular/pill elements |
| Shadows | Semantic foreground-derived card and popover shadows |
| State | Primary hover, disabled opacity, ring focus, destructive invalid state |
| Layout | Existing feature grids preserved; compact layouts at 650px; desktop sidebar at 900px |
| Charts | Primary, success, warning, destructive and muted semantic series |

## Validation

- Production build and TypeScript check passed.
- Existing automated suite: 101 finance/UI tests and 3 rates tests passed.
- Browser verification: transaction list and details; household, accounts, foreign expenses, obligations, insights and settings in desktop layout.
- All eight financial-plan destinations opened at 390px: folders, assets, checks, reports, budgets, savings, loans and recurring payments; no document horizontal overflow.
- Report layout checked at 768px; desktop pages checked at 1280px.
- Computed styles verified RTL, Vazirmatn and primary `#2563EB`.
- Dark settings page verified background `rgb(15,23,42)`, cards `rgb(30,41,59)`, Vazirmatn and no horizontal overflow; appearance preference restored afterward.
- Transaction dialog title, fields, actions and focusable close control verified in browser.
- Source audit removed page-level hardcoded CSS palettes and alternate monospace font. No financial-domain source files were changed.

## Intentional differences and limits

User-selected category/folder/goal accent colors are preserved as stored personalization, rather than rewritten. Native OS file/color/select popups retain platform behavior; their in-page controls use application tokens. Browser spot checks do not exhaust every populated nested dialog/state. Automated suites cover empty and populated financial screens and data invariants. Build emits Radix `use client`/sourcemap notices and a JavaScript chunk-size warning; neither prevents production output.
