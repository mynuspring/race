import { requireRole } from "@/lib/guard";
import { loadRange, loadSetup, type Target } from "@/lib/data";
import { monthStart, previousPeriod, todayMY, type Bucket } from "@/lib/metrics";
import Dashboard from "@/components/Dashboard";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { sb } = await requireRole(["sales", "ads", "admin"]);
  const sp = await searchParams;
  const today = todayMY();
  let from = sp.from && ISO.test(sp.from) ? sp.from : monthStart(today);
  let to = sp.to && ISO.test(sp.to) ? sp.to : today;
  if (from > to) [from, to] = [to, from];
  const bucket: Bucket = sp.bucket === "week" || sp.bucket === "month" ? sp.bucket : "day";
  const acct = sp.acct && /^\d+$/.test(sp.acct) ? Number(sp.acct) : null;

  const prev = previousPeriod(from, to);
  const tMonth = monthStart(to);
  const loadFrom = [prev.from, tMonth].sort()[0];
  const [setup, data, target] = await Promise.all([
    loadSetup(sb),
    loadRange(sb, loadFrom, to),
    sb.from("monthly_targets").select("*").eq("month", tMonth).maybeSingle(),
  ]);

  return (
    <Dashboard
      {...setup}
      sales={data.sales}
      ads={data.ads}
      from={from}
      to={to}
      prev={prev}
      bucket={bucket}
      acct={acct}
      today={today}
      target={(target.data as Target | null) ?? null}
    />
  );
}
