"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  addDays, computeMetrics, monthEnd, monthStart, series, targetProgress, weekStart,
  type AdAccount, type AdRow, type Bucket, type Channel, type Filter, type Metrics, type SalesRow,
} from "@/lib/metrics";
import type { Profile, Target } from "@/lib/data";
import { n, pct, rm, shortDate, x } from "@/lib/format";

type Props = {
  channels: Channel[]; adAccounts: AdAccount[]; profiles: Profile[];
  sales: SalesRow[]; ads: AdRow[];
  from: string; to: string; prev: { from: string; to: string };
  bucket: Bucket; acct: number | null; today: string; target: Target | null;
};

type MetricKey = keyof Metrics;
type Def = { key: MetricKey; label: string; fmt: (v: number | null) => string; good: "up" | "down"; hint: string };

const DEFS: Def[] = [
  { key: "totalSales", label: "Total sales", fmt: (v) => rm(v), good: "up", hint: "Chat sales + Shopee + website" },
  { key: "spend", label: "Ad spend", fmt: (v) => rm(v), good: "down", hint: "All ad accounts" },
  { key: "newEnquiries", label: "New enquiries", fmt: (v) => n(v), good: "up", hint: "Counted by the sales team" },
  { key: "cplManual", label: "Cost per new enquiry", fmt: (v) => rm(v, 2), good: "down", hint: "Spend ÷ new enquiries from ad-funded channels (your count)" },
  { key: "cplAdsManager", label: "Cost per lead (Ads Manager)", fmt: (v) => rm(v, 2), good: "down", hint: "Spend ÷ Ads Manager new messaging conversations, on days entered" },
  { key: "newConversion", label: "New conversion rate", fmt: (v) => pct(v), good: "up", hint: "New orders ÷ new enquiries" },
  { key: "chatRoas", label: "ROAS (chat sales)", fmt: x, good: "up", hint: "Chat sales ÷ ad spend" },
  { key: "overallRoas", label: "Total ROAS", fmt: x, good: "up", hint: "All sales incl. Shopee & website ÷ ad spend" },
  { key: "newRoas", label: "New customer ROAS", fmt: x, good: "up", hint: "New-customer chat sales ÷ ad spend" },
  { key: "cpa", label: "CPA", fmt: (v) => rm(v, 2), good: "down", hint: "Ad spend ÷ all chat orders" },
  { key: "aov", label: "AOV", fmt: (v) => rm(v, 2), good: "up", hint: "Chat sales ÷ chat orders" },
  { key: "aovAfterAdCost", label: "AOV after ad cost", fmt: (v) => rm(v, 2), good: "up", hint: "AOV − CPA (product and shipping costs not included yet)" },
];
const def = (k: MetricKey) => DEFS.find((d) => d.key === k)!;

const CHART_METRICS: MetricKey[] = ["spend", "newEnquiries", "cplManual", "cplAdsManager", "chatRoas", "newRoas", "newConversion", "totalSales", "cpa", "aov"];

function Delta({ cur, prev, good }: { cur: number | null; prev: number | null; good: "up" | "down" }) {
  if (cur == null || prev == null || prev === 0) return <span className="text-xs text-gray-400">no comparison</span>;
  const d = cur / prev - 1;
  const better = good === "up" ? d > 0 : d < 0;
  const flat = Math.abs(d) < 0.005;
  return (
    <span className={`text-xs font-medium ${flat ? "text-gray-500" : better ? "text-green-700" : "text-red-600"}`}>
      {d > 0 ? "▲" : d < 0 ? "▼" : "•"} {Math.abs(d * 100).toFixed(1)}% vs previous
    </span>
  );
}

function Th({ children, right = true }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`whitespace-nowrap px-3 py-2 ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right = true, strong = false }: { children: React.ReactNode; right?: boolean; strong?: boolean }) {
  return <td className={`whitespace-nowrap px-3 py-2 num ${right ? "text-right" : ""} ${strong ? "font-medium" : ""}`}>{children}</td>;
}

export default function Dashboard(p: Props) {
  const router = useRouter();
  const [chartKey, setChartKey] = useState<MetricKey>("cplManual");
  const [chartKey2, setChartKey2] = useState<MetricKey | "">("cplAdsManager");

  const go = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams({ from: p.from, to: p.to, bucket: p.bucket, ...(p.acct ? { acct: String(p.acct) } : {}) });
    for (const [k, v] of Object.entries(patch)) (v == null ? q.delete(k) : q.set(k, v));
    router.push(`/?${q.toString()}`);
  };

  const filter: Filter = useMemo(() => {
    if (!p.acct) return {};
    return { adAccountIds: new Set([p.acct]), channelIds: new Set(p.channels.filter((c) => c.ad_account_id === p.acct).map((c) => c.id)) };
  }, [p.acct, p.channels]);

  const inRange = <T extends { entry_date: string }>(rows: T[], f: string, t: string) => rows.filter((r) => r.entry_date >= f && r.entry_date <= t);
  const cur = useMemo(() => {
    const s = inRange(p.sales, p.from, p.to), a = inRange(p.ads, p.from, p.to);
    return { s, a, m: computeMetrics(s, a, p.channels, filter) };
  }, [p.sales, p.ads, p.from, p.to, p.channels, filter]);
  const prv = useMemo(() => computeMetrics(inRange(p.sales, p.prev.from, p.prev.to), inRange(p.ads, p.prev.from, p.prev.to), p.channels, filter),
    [p.sales, p.ads, p.prev, p.channels, filter]);
  const rows = useMemo(() => series(cur.s, cur.a, p.channels, p.from, p.to, p.bucket, filter), [cur, p.channels, p.from, p.to, p.bucket, filter]);

  // Month target box (whole business, month of the "to" date)
  const tMonth = monthStart(p.to);
  const monthM = computeMetrics(inRange(p.sales, tMonth, p.to), inRange(p.ads, tMonth, p.to), p.channels);
  const tp = p.target ? targetProgress(Number(p.target.sales_target), monthM.totalSales, tMonth, p.today) : null;
  const spendBudget = p.target ? Number(p.target.ad_spend_target) : 0;

  const presets: { label: string; from: string; to: string }[] = [
    { label: "Today", from: p.today, to: p.today },
    { label: "Yesterday", from: addDays(p.today, -1), to: addDays(p.today, -1) },
    { label: "Last 7 days", from: addDays(p.today, -6), to: p.today },
    { label: "This week", from: weekStart(p.today), to: p.today },
    { label: "This month", from: monthStart(p.today), to: p.today },
    { label: "Last month", from: monthStart(addDays(monthStart(p.today), -1)), to: monthEnd(addDays(monthStart(p.today), -1)) },
    { label: "Last 90 days", from: addDays(p.today, -89), to: p.today },
  ];

  const chartData = rows.map((r) => ({ name: p.bucket === "month" ? r.key.slice(0, 7) : shortDate(r.key), a: r[chartKey] as number | null, b: chartKey2 ? (r[chartKey2] as number | null) : null }));

  const nameOf = (uid: string) => { const pr = p.profiles.find((x) => x.id === uid); return pr ? pr.full_name || pr.email || "Unknown" : "Unknown"; };
  const userIds = [...new Set(cur.s.map((r) => r.user_id))];
  const chatChannels = p.channels.filter((c) => !filter.channelIds || filter.channelIds.has(c.id));

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((pr) => (
          <button key={pr.label} onClick={() => go({ from: pr.from, to: pr.to })}
            className={`rounded-full border px-3 py-1 text-sm ${p.from === pr.from && p.to === pr.to ? "border-brand-600 bg-brand-600 text-white" : "border-gray-300 bg-white hover:bg-gray-50"}`}>
            {pr.label}
          </button>
        ))}
        <div className="flex items-center gap-1 text-sm">
          <input type="date" value={p.from} onChange={(e) => e.target.value && go({ from: e.target.value })} className="rounded border border-gray-300 px-2 py-1" />
          <span>to</span>
          <input type="date" value={p.to} onChange={(e) => e.target.value && go({ to: e.target.value })} className="rounded border border-gray-300 px-2 py-1" />
        </div>
        <select value={p.acct ?? ""} onChange={(e) => go({ acct: e.target.value || null })} className="rounded border border-gray-300 bg-white px-2 py-1 text-sm">
          <option value="">All ad accounts & channels</option>
          {p.adAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} only</option>)}
        </select>
      </div>
      <p className="-mt-3 text-sm text-gray-500">
        {shortDate(p.from)} – {shortDate(p.to)} compared with {shortDate(p.prev.from)} – {shortDate(p.prev.to)}
        {p.acct ? " · Shopee and website are excluded when one ad account is selected." : ""}
      </p>

      {/* Target box */}
      {tp && (
        <section className="grid grid-cols-2 gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 sm:grid-cols-5">
          <div><div className="text-xs uppercase text-gray-500">{tMonth.slice(0, 7)} sales target</div><div className="text-lg font-semibold num">{rm(tp.target)}</div></div>
          <div><div className="text-xs uppercase text-gray-500">Achieved</div><div className="text-lg font-semibold num">{rm(tp.achieved)} <span className="text-sm font-normal">({pct(tp.pct, 0)})</span></div></div>
          <div><div className="text-xs uppercase text-gray-500">Still needed</div><div className="text-lg font-semibold num">{rm(tp.lack)}</div></div>
          <div><div className="text-xs uppercase text-gray-500">Needed per day</div><div className="text-lg font-semibold num">{rm(tp.dailyNeeded)} <span className="text-sm font-normal">{tp.daysLeft} days left</span></div></div>
          <div><div className="text-xs uppercase text-gray-500">Ad spend vs budget</div><div className="text-lg font-semibold num">{rm(monthM.spend)} <span className="text-sm font-normal">of {rm(spendBudget)} · ROAS {x(monthM.overallRoas)}</span></div></div>
        </section>
      )}

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {DEFS.map((d) => (
          <div key={d.key} className="rounded-xl border border-gray-200 bg-white p-3" title={d.hint}>
            <div className="text-xs text-gray-500">{d.label}</div>
            <div className="mt-1 text-xl font-semibold num">{d.fmt(cur.m[d.key] as number | null)}</div>
            <Delta cur={cur.m[d.key] as number | null} prev={prv[d.key] as number | null} good={d.good} />
          </div>
        ))}
      </section>
      {cur.m.adsManagerGap != null && (
        <p className="text-sm text-gray-600">
          Ads Manager counted <b>{pct(cur.m.adsManagerGap, 0)} {cur.m.adsManagerGap >= 0 ? "more" : "fewer"}</b> new leads than your team on the days both were entered.
        </p>
      )}

      {/* Chart */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Trend</span>
          <select value={chartKey} onChange={(e) => setChartKey(e.target.value as MetricKey)} className="rounded border border-gray-300 px-2 py-1">
            {CHART_METRICS.map((k) => <option key={k} value={k}>{def(k).label}</option>)}
          </select>
          <span>vs</span>
          <select value={chartKey2} onChange={(e) => setChartKey2(e.target.value as MetricKey | "")} className="rounded border border-gray-300 px-2 py-1">
            <option value="">nothing</option>
            {CHART_METRICS.map((k) => <option key={k} value={k}>{def(k).label}</option>)}
          </select>
          <div className="ml-auto flex gap-1">
            {(["day", "week", "month"] as Bucket[]).map((b) => (
              <button key={b} onClick={() => go({ bucket: b })} className={`rounded px-2 py-1 ${p.bucket === b ? "bg-brand-600 text-white" : "bg-gray-100"}`}>
                {b === "day" ? "Daily" : b === "week" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke="#eee" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis yAxisId="a" fontSize={12} />
              {chartKey2 && <YAxis yAxisId="b" orientation="right" fontSize={12} />}
              <Tooltip formatter={(v, name) => { const k = name === def(chartKey).label ? chartKey : (chartKey2 as MetricKey); return def(k).fmt(v as number | null); }} />
              <Legend />
              <Line yAxisId="a" dataKey="a" name={def(chartKey).label} stroke="#23824a" strokeWidth={2} dot={false} connectNulls />
              {chartKey2 && <Line yAxisId="b" dataKey="b" name={def(chartKey2).label} stroke="#d97706" strokeWidth={2} dot={false} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Period table */}
      <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <h2 className="px-4 pt-3 font-semibold">{p.bucket === "day" ? "Daily" : p.bucket === "week" ? "Weekly (Mon–Sun)" : "Monthly"} breakdown</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-500">
            <tr><Th right={false}>Period</Th><Th>Sales</Th><Th>New sales</Th><Th>Repeat sales</Th><Th>Orders</Th><Th>New enq.</Th><Th>All enq.</Th><Th>Spend</Th>
              <Th>Cost / new enq.</Th><Th>Cost / lead (Ads Mgr)</Th><Th>New conv.</Th><Th>Repeat conv.</Th><Th>ROAS</Th><Th>Total ROAS</Th><Th>CPA</Th><Th>AOV</Th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-gray-100">
                <Td right={false}>{p.bucket === "month" ? r.key.slice(0, 7) : p.bucket === "week" ? `w/c ${shortDate(r.key)}` : shortDate(r.key)}</Td>
                <Td>{rm(r.totalSales)}</Td><Td>{rm(r.chatNewSales)}</Td><Td>{rm(r.chatRepeatSales)}</Td><Td>{n(r.orders)}</Td>
                <Td>{n(r.newEnquiries)}</Td><Td>{n(r.enquiries)}</Td><Td>{rm(r.spend)}</Td>
                <Td>{rm(r.cplManual, 2)}</Td><Td>{rm(r.cplAdsManager, 2)}</Td><Td>{pct(r.newConversion)}</Td><Td>{pct(r.repeatConversion)}</Td>
                <Td>{x(r.chatRoas)}</Td><Td>{x(r.overallRoas)}</Td><Td>{rm(r.cpa, 2)}</Td><Td>{rm(r.aov, 2)}</Td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-medium">
              <Td right={false}>Total</Td>
              <Td>{rm(cur.m.totalSales)}</Td><Td>{rm(cur.m.chatNewSales)}</Td><Td>{rm(cur.m.chatRepeatSales)}</Td><Td>{n(cur.m.orders)}</Td>
              <Td>{n(cur.m.newEnquiries)}</Td><Td>{n(cur.m.enquiries)}</Td><Td>{rm(cur.m.spend)}</Td>
              <Td>{rm(cur.m.cplManual, 2)}</Td><Td>{rm(cur.m.cplAdsManager, 2)}</Td><Td>{pct(cur.m.newConversion)}</Td><Td>{pct(cur.m.repeatConversion)}</Td>
              <Td>{x(cur.m.chatRoas)}</Td><Td>{x(cur.m.overallRoas)}</Td><Td>{rm(cur.m.cpa, 2)}</Td><Td>{rm(cur.m.aov, 2)}</Td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* By ad account */}
        <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <h2 className="px-4 pt-3 font-semibold">By ad account</h2>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-gray-500"><tr><Th right={false}>Account</Th><Th>Spend</Th><Th>New enq.</Th><Th>Cost / new enq.</Th><Th>Ads Manager leads</Th><Th>Cost / lead (Ads Mgr)</Th><Th>New sales</Th><Th>New ROAS</Th><Th>ROAS</Th></tr></thead>
            <tbody>
              {p.adAccounts.filter((a) => !p.acct || a.id === p.acct).map((a) => {
                const m = computeMetrics(cur.s, cur.a, p.channels, { adAccountIds: new Set([a.id]), channelIds: new Set(p.channels.filter((c) => c.ad_account_id === a.id).map((c) => c.id)) });
                return (
                  <tr key={a.id} className="border-t border-gray-100">
                    <Td right={false} strong>{a.name}</Td><Td>{rm(m.spend)}</Td><Td>{n(m.adNewEnquiries)}</Td><Td>{rm(m.cplManual, 2)}</Td>
                    <Td>{n(m.platformLeads)}</Td><Td>{rm(m.cplAdsManager, 2)}</Td><Td>{rm(m.chatNewSales)}</Td><Td>{x(m.newRoas)}</Td><Td>{x(m.chatRoas)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* By channel */}
        <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <h2 className="px-4 pt-3 font-semibold">By channel</h2>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-gray-500"><tr><Th right={false}>Channel</Th><Th>New sales</Th><Th>Repeat sales</Th><Th>New orders</Th><Th>Repeat orders</Th><Th>New enq.</Th><Th>Existing enq.</Th><Th>New conv.</Th></tr></thead>
            <tbody>
              {chatChannels.map((c) => {
                const rs = cur.s.filter((r) => r.channel_id === c.id);
                const sum = (k: keyof SalesRow) => rs.reduce((t, r) => t + (Number(r[k]) || 0), 0);
                const mk = c.kind === "marketplace";
                return (
                  <tr key={c.id} className="border-t border-gray-100">
                    <Td right={false} strong>{c.name}</Td><Td>{rm(sum("new_sales"))}</Td><Td>{rm(sum("repeat_sales"))}</Td>
                    <Td>{mk ? "–" : n(sum("new_orders"))}</Td><Td>{mk ? "–" : n(sum("repeat_orders"))}</Td>
                    <Td>{mk ? "–" : n(sum("new_enquiries"))}</Td><Td>{mk ? "–" : n(sum("existing_enquiries"))}</Td>
                    <Td>{mk ? "–" : pct(sum("new_enquiries") ? sum("new_orders") / sum("new_enquiries") : null)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      {/* By salesperson */}
      <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <h2 className="px-4 pt-3 font-semibold">By salesperson</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-500"><tr><Th right={false}>Name</Th><Th>Chat sales</Th><Th>New sales</Th><Th>Orders</Th><Th>New enq.</Th><Th>All enq.</Th><Th>New conv.</Th><Th>Total conv.</Th><Th>AOV</Th></tr></thead>
          <tbody>
            {userIds.length === 0 && <tr><td className="px-3 py-3 text-gray-400" colSpan={9}>No entries in this period yet.</td></tr>}
            {userIds.map((uid) => {
              const m = computeMetrics(cur.s.filter((r) => r.user_id === uid), [], p.channels, { channelIds: filter.channelIds });
              return (
                <tr key={uid} className="border-t border-gray-100">
                  <Td right={false} strong>{nameOf(uid)}</Td><Td>{rm(m.chatSales)}</Td><Td>{rm(m.chatNewSales)}</Td><Td>{n(m.orders)}</Td>
                  <Td>{n(m.newEnquiries)}</Td><Td>{n(m.enquiries)}</Td><Td>{pct(m.newConversion)}</Td><Td>{pct(m.totalConversion)}</Td><Td>{rm(m.aov, 2)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <details className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <summary className="cursor-pointer font-semibold text-gray-800">How each number is calculated</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {DEFS.map((d) => <li key={d.key}><b>{d.label}:</b> {d.hint}</li>)}
          <li><b>Repeat conversion:</b> repeat orders ÷ existing customer enquiries</li>
          <li><b>Cost / lead (AM)</b> only counts spend on days where the Ads Manager number was entered, so missing days don&apos;t distort it.</li>
        </ul>
      </details>
    </div>
  );
}
