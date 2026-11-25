import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, previousPeriod, series, targetProgress, weekStart, type Channel, type SalesRow, type AdRow } from "./metrics.ts";

const channels: Channel[] = [
  { id: 1, name: "Facebook", kind: "chat", owned: true, ad_account_id: 10, active: true, sort_order: 1 },
  { id: 2, name: "WhatsApp", kind: "chat", owned: true, ad_account_id: 10, active: true, sort_order: 2 },
  { id: 3, name: "Lee Ping", kind: "chat", owned: false, ad_account_id: 20, active: true, sort_order: 3 },
  { id: 5, name: "Shopee", kind: "marketplace", owned: true, ad_account_id: null, active: true, sort_order: 5 },
];
const row = (p: Partial<SalesRow>): SalesRow => ({
  entry_date: "2026-11-01", channel_id: 1, user_id: "u1",
  new_sales: 0, repeat_sales: 0, new_orders: 0, repeat_orders: 0, new_enquiries: 0, existing_enquiries: 0, ...p,
});

// Day 1 of the Nov 26 sheet
const sales1: SalesRow[] = [
  row({ channel_id: 1, repeat_sales: 4167.2, repeat_orders: 4, new_enquiries: 16, existing_enquiries: 4 }),
  row({ channel_id: 2, repeat_sales: 988, repeat_orders: 1, new_enquiries: 8 }),
  row({ channel_id: 3, new_enquiries: 2 }),
];
const ads1: AdRow[] = [
  { entry_date: "2026-11-01", ad_account_id: 10, spend: 1549.64, platform_leads: 46 },
  { entry_date: "2026-11-01", ad_account_id: 20, spend: 56.78, platform_leads: null },
];

test("matches the Excel sheet for 1 Nov", () => {
  const m = computeMetrics(sales1, ads1, channels);
  assert.equal(m.chatSales, 5155.2);
  assert.equal(m.enquiries, 30);
  assert.equal(m.newEnquiries, 26);
  assert.ok(Math.abs(m.cplAllMessages! - 53.547) < 0.01); // sheet Z14 53.55
  assert.ok(Math.abs(m.cplManual! - 61.785) < 0.01); // sheet AL14 61.79
  assert.ok(Math.abs(m.chatRoas! - 3.209) < 0.01); // sheet AS14 3.21
  assert.ok(Math.abs(m.cpa! - 321.28) < 0.01); // sheet AT14
  assert.ok(Math.abs(m.aov! - 1031.04) < 0.01); // sheet AU14
  assert.equal(m.newConversion, 0);
  assert.equal(m.repeatConversion, 5 / 4); // fixed: repeat orders / existing enquiries
  // Ads Manager CPL only uses spend on days with leads entered (NuSpring account)
  assert.ok(Math.abs(m.cplAdsManager! - 1549.64 / 46) < 1e-9); // sheet AN14 33.69
  assert.ok(Math.abs(m.adsManagerGap! - (46 / 24 - 1)) < 1e-9);
});

test("per ad account filter", () => {
  const m = computeMetrics(sales1, ads1, channels, { adAccountIds: new Set([20]), channelIds: new Set([3]) });
  assert.equal(m.spend, 56.78);
  assert.ok(Math.abs(m.cplManual! - 28.39) < 0.01); // sheet AK14
});

test("marketplace sales count in overall ROAS only", () => {
  const m = computeMetrics([...sales1, row({ channel_id: 5, new_sales: 1000 })], ads1, channels);
  assert.equal(m.totalSales, 6155.2);
  assert.equal(m.orders, 5);
});

test("empty period returns nulls, not errors", () => {
  const m = computeMetrics([], [], channels);
  assert.equal(m.cpa, null);
  assert.equal(m.newRoas, null);
  assert.equal(m.aovAfterAdCost, null);
});

test("dates", () => {
  assert.deepEqual(previousPeriod("2026-11-01", "2026-11-30"), { from: "2026-10-02", to: "2026-10-31" });
  assert.equal(weekStart("2026-11-25"), "2026-11-23");
  const p = targetProgress(300000, 142236.78, "2026-11-01", "2026-11-25");
  assert.equal(p.daysLeft, 6);
  assert.ok(Math.abs(p.dailyNeeded! - 26293.87) < 0.01);
});

test("weekly series fills buckets", () => {
  const s = series(sales1, ads1, channels, "2026-11-01", "2026-11-14", "week");
  assert.deepEqual(s.map((x) => x.key), ["2026-10-26", "2026-11-02", "2026-11-09"]);
  assert.equal(s[0].chatSales, 5155.2);
  assert.equal(s[1].spend, 0);
});
