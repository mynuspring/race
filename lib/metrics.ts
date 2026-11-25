// Pure metric calculations for the race report. No Supabase imports so it can be unit tested.

export type Channel = {
  id: number;
  name: string;
  kind: "chat" | "marketplace";
  owned: boolean;
  ad_account_id: number | null;
  active: boolean;
  sort_order: number;
};

export type AdAccount = { id: number; name: string; active: boolean; sort_order: number };

export type SalesRow = {
  entry_date: string;
  channel_id: number;
  user_id: string;
  new_sales: number;
  repeat_sales: number;
  new_orders: number;
  repeat_orders: number;
  new_enquiries: number;
  existing_enquiries: number;
};

export type AdRow = {
  entry_date: string;
  ad_account_id: number;
  spend: number;
  platform_leads: number | null;
};

/** Divide, returning null instead of Infinity/NaN so the UI shows a dash. */
export const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export type Totals = {
  chatNewSales: number;
  chatRepeatSales: number;
  chatSales: number;
  marketplaceSales: number;
  totalSales: number;
  newOrders: number;
  repeatOrders: number;
  orders: number;
  newEnquiries: number;
  existingEnquiries: number;
  enquiries: number;
  /** New enquiries on channels that are funded by an ad account */
  adNewEnquiries: number;
  spend: number;
  platformLeads: number;
  /** Spend on days where Ads Manager leads were entered (keeps the Ads Manager CPL honest) */
  spendWithLeads: number;
};

export type Metrics = Totals & {
  cplManual: number | null; // spend / new enquiries from ad-funded channels
  cplAllMessages: number | null; // spend / all enquiries
  cplAdsManager: number | null; // spend / Ads Manager leads (only days with leads entered)
  adsManagerGap: number | null; // (Ads Manager leads / manual new enquiries) - 1, same days
  newConversion: number | null; // new orders / new enquiries
  repeatConversion: number | null; // repeat orders / existing enquiries
  totalConversion: number | null; // orders / enquiries
  newRoas: number | null; // new-customer chat sales / spend
  chatRoas: number | null; // chat sales / spend
  overallRoas: number | null; // all sales incl. Shopee & website / spend
  cpa: number | null; // spend / all chat orders
  costPerNewCustomer: number | null; // spend / new orders
  aov: number | null; // chat sales / chat orders
  aovAfterAdCost: number | null; // AOV - CPA
  repeatShare: number | null; // repeat chat sales / chat sales
};

const emptyTotals = (): Totals => ({
  chatNewSales: 0, chatRepeatSales: 0, chatSales: 0, marketplaceSales: 0, totalSales: 0,
  newOrders: 0, repeatOrders: 0, orders: 0,
  newEnquiries: 0, existingEnquiries: 0, enquiries: 0, adNewEnquiries: 0,
  spend: 0, platformLeads: 0, spendWithLeads: 0,
});

export type Filter = {
  /** Only include these channels (sales rows). Undefined = all. */
  channelIds?: Set<number>;
  /** Only include these ad accounts (ad rows). Undefined = all. */
  adAccountIds?: Set<number>;
  userId?: string;
};

export function computeTotals(
  sales: SalesRow[],
  ads: AdRow[],
  channels: Channel[],
  filter: Filter = {},
): Totals & { manualNewOnLeadDays: number } {
  const ch = new Map(channels.map((c) => [c.id, c]));
  const t = { ...emptyTotals(), manualNewOnLeadDays: 0 };

  // Which (date, ad account) pairs have Ads Manager leads entered
  const leadDays = new Set<string>();
  for (const a of ads) {
    if (filter.adAccountIds && !filter.adAccountIds.has(a.ad_account_id)) continue;
    const spend = Number(a.spend) || 0;
    t.spend += spend;
    if (a.platform_leads != null) {
      t.platformLeads += Number(a.platform_leads);
      t.spendWithLeads += spend;
      leadDays.add(`${a.entry_date}|${a.ad_account_id}`);
    }
  }

  for (const s of sales) {
    if (filter.channelIds && !filter.channelIds.has(s.channel_id)) continue;
    if (filter.userId && s.user_id !== filter.userId) continue;
    const c = ch.get(s.channel_id);
    if (!c) continue;
    const ns = Number(s.new_sales) || 0;
    const rs = Number(s.repeat_sales) || 0;
    if (c.kind === "marketplace") {
      t.marketplaceSales += ns + rs;
      continue;
    }
    t.chatNewSales += ns;
    t.chatRepeatSales += rs;
    t.newOrders += Number(s.new_orders) || 0;
    t.repeatOrders += Number(s.repeat_orders) || 0;
    t.newEnquiries += Number(s.new_enquiries) || 0;
    t.existingEnquiries += Number(s.existing_enquiries) || 0;
    if (c.ad_account_id != null && (!filter.adAccountIds || filter.adAccountIds.has(c.ad_account_id))) {
      t.adNewEnquiries += Number(s.new_enquiries) || 0;
      if (leadDays.has(`${s.entry_date}|${c.ad_account_id}`)) t.manualNewOnLeadDays += Number(s.new_enquiries) || 0;
    }
  }
  t.chatSales = t.chatNewSales + t.chatRepeatSales;
  t.totalSales = t.chatSales + t.marketplaceSales;
  t.orders = t.newOrders + t.repeatOrders;
  t.enquiries = t.newEnquiries + t.existingEnquiries;
  return t;
}

export function computeMetrics(
  sales: SalesRow[],
  ads: AdRow[],
  channels: Channel[],
  filter: Filter = {},
): Metrics {
  const t = computeTotals(sales, ads, channels, filter);
  const cpa = div(t.spend, t.orders);
  const aov = div(t.chatSales, t.orders);
  const { manualNewOnLeadDays, ...totals } = t;
  return {
    ...totals,
    cplManual: div(t.spend, t.adNewEnquiries),
    cplAllMessages: div(t.spend, t.enquiries),
    cplAdsManager: div(t.spendWithLeads, t.platformLeads),
    adsManagerGap: manualNewOnLeadDays > 0 && t.platformLeads > 0 ? t.platformLeads / manualNewOnLeadDays - 1 : null,
    newConversion: div(t.newOrders, t.newEnquiries),
    repeatConversion: div(t.repeatOrders, t.existingEnquiries),
    totalConversion: div(t.orders, t.enquiries),
    newRoas: div(t.chatNewSales, t.spend),
    chatRoas: div(t.chatSales, t.spend),
    overallRoas: div(t.totalSales, t.spend),
    cpa,
    costPerNewCustomer: div(t.spend, t.newOrders),
    aov,
    aovAfterAdCost: aov != null && cpa != null ? aov - cpa : null,
    repeatShare: div(t.chatRepeatSales, t.chatSales),
  };
}

/* ---------- Dates (all YYYY-MM-DD strings, Malaysia business days) ---------- */

export const toISO = (d: Date) => d.toISOString().slice(0, 10);
export const parseISO = (s: string) => new Date(`${s}T00:00:00Z`);
export const addDays = (s: string, n: number) => {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
};
export const daysBetween = (from: string, to: string) =>
  Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86400000) + 1;

/** The equal-length period immediately before [from, to]. */
export function previousPeriod(from: string, to: string) {
  const n = daysBetween(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

/** Today in Malaysia (UTC+8). */
export function todayMY(now = new Date()) {
  return toISO(new Date(now.getTime() + 8 * 3600 * 1000));
}

export function monthStart(s: string) {
  return `${s.slice(0, 7)}-01`;
}
export function monthEnd(s: string) {
  const d = parseISO(monthStart(s));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return toISO(d);
}

/** Monday-start week containing s. */
export function weekStart(s: string) {
  const d = parseISO(s);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(s, -dow);
}

export type Bucket = "day" | "week" | "month";
export function bucketKey(s: string, b: Bucket) {
  return b === "day" ? s : b === "week" ? weekStart(s) : monthStart(s);
}

/** Group rows by bucket and compute metrics per bucket, filling empty buckets. */
export function series(
  sales: SalesRow[],
  ads: AdRow[],
  channels: Channel[],
  from: string,
  to: string,
  bucket: Bucket,
  filter: Filter = {},
) {
  const keys: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const k = bucketKey(d, bucket);
    if (keys[keys.length - 1] !== k) keys.push(k);
  }
  const sBy = new Map<string, SalesRow[]>();
  const aBy = new Map<string, AdRow[]>();
  for (const k of keys) { sBy.set(k, []); aBy.set(k, []); }
  for (const s of sales) sBy.get(bucketKey(s.entry_date, bucket))?.push(s);
  for (const a of ads) aBy.get(bucketKey(a.entry_date, bucket))?.push(a);
  return keys.map((k) => ({ key: k, ...computeMetrics(sBy.get(k)!, aBy.get(k)!, channels, filter) }));
}

/** Month target box, same as the top of the Excel sheet. */
export function targetProgress(target: number, achieved: number, month: string, today: string) {
  const end = monthEnd(month);
  const start = monthStart(month);
  let daysLeft: number;
  if (today > end) daysLeft = 0;
  else if (today < start) daysLeft = daysBetween(start, end);
  else daysLeft = daysBetween(today, end);
  const lack = Math.max(target - achieved, 0);
  return { target, achieved, pct: div(achieved, target), lack, daysLeft, dailyNeeded: daysLeft > 0 ? lack / daysLeft : null };
}
