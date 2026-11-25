# NuSpring Race Report

Web app that replaces the manual "Gut All Platform Race Report" Excel sheet.

- **Sales staff** enter their own daily sales, orders and enquiries per channel (new vs repeat).
- **Ads specialist** enters daily ad spend and the Ads Manager "new messaging conversations started" count per ad account.
- **Everyone** sees the dashboard: month target, KPIs with comparison to the previous period, trend chart, and daily / weekly / monthly breakdowns by ad account, channel and salesperson.
- **Admin** approves staff, assigns roles, adds KOL channels and ad accounts, and sets monthly targets.

## Metric definitions

All in `lib/metrics.ts` (tested in `lib/metrics.test.ts`, `npm test`).

| Metric | Formula |
|---|---|
| Cost per new enquiry | Ad spend ÷ new enquiries on channels linked to an ad account |
| Cost per lead (Ads Manager) | Spend ÷ Ads Manager leads, only days where leads were entered |
| New conversion | New orders ÷ new enquiries |
| Repeat conversion | Repeat orders ÷ existing-customer enquiries |
| ROAS | Chat sales ÷ ad spend |
| Total ROAS | All sales incl. Shopee & website ÷ ad spend |
| New customer ROAS | New-customer chat sales ÷ ad spend |
| CPA | Ad spend ÷ all chat orders |
| AOV | Chat sales ÷ chat orders |
| AOV after ad cost | AOV − CPA |

## Setup

1. Create a Supabase project and run `supabase/migrations/0001_init.sql`.
2. In Supabase → Authentication → URL Configuration, set the Site URL to the deployed app URL and add `<app-url>/auth/callback` to Redirect URLs.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`) in Vercel.
4. The first person to sign up becomes admin. Everyone after that starts as "pending" until the admin gives them a role.

Local: `npm install && npm run dev`.
