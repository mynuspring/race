"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDays, todayMY, type AdAccount } from "@/lib/metrics";

type V = Record<number, { spend: string; leads: string }>;

export default function AdsEntryForm({ adAccounts }: { adAccounts: AdAccount[] }) {
  const [date, setDate] = useState(addDays(todayMY(), -1));
  const [values, setValues] = useState<V>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sb = createClient();

  const load = useCallback(async () => {
    setStatus(null);
    const { data, error } = await sb.from("ad_entries").select("*").eq("entry_date", date);
    if (error) { setStatus(error.message); return; }
    const v: V = {};
    for (const a of adAccounts) v[a.id] = { spend: "", leads: "" };
    for (const r of data ?? []) v[r.ad_account_id] = { spend: r.spend ? String(Number(r.spend)) : "", leads: r.platform_leads == null ? "" : String(r.platform_leads) };
    setValues(v);
  }, [date, adAccounts]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy(true); setStatus(null);
    const rows = adAccounts.map((a) => ({
      entry_date: date, ad_account_id: a.id,
      spend: values[a.id]?.spend ? Number(values[a.id].spend) : 0,
      platform_leads: values[a.id]?.leads === "" || values[a.id]?.leads == null ? null : Number(values[a.id].leads),
    }));
    if (rows.some((r) => Number.isNaN(r.spend) || r.spend < 0 || (r.platform_leads != null && (Number.isNaN(r.platform_leads) || r.platform_leads < 0)))) {
      setStatus("Please enter numbers of 0 or more only."); setBusy(false); return;
    }
    const { error } = await sb.from("ad_entries").upsert(rows, { onConflict: "entry_date,ad_account_id" });
    setBusy(false);
    setStatus(error ? `Not saved: ${error.message}` : "Saved.");
  }

  const cell = "w-40 rounded border border-gray-300 px-2 py-1.5 text-right num focus:border-brand-500 focus:outline-none";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">Enter ad spend</h1>
          <p className="text-sm text-gray-500">Copy from Ads Manager for the selected day. Leave leads blank if you don&apos;t have the number yet.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="rounded border px-2 py-1.5 text-sm" onClick={() => setDate(addDays(date, -1))}>‹</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5" />
          <button className="rounded border px-2 py-1.5 text-sm" onClick={() => setDate(addDays(date, 1))}>›</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr><th className="px-3 py-2">Ad account</th><th className="px-3 py-2 text-right">Amount spent (RM)</th><th className="px-3 py-2 text-right">New messaging conversations started</th></tr>
          </thead>
          <tbody>
            {adAccounts.map((a) => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium">{a.name}</td>
                <td className="px-3 py-1.5 text-right"><input type="number" min={0} step="0.01" className={cell} placeholder="0.00"
                  value={values[a.id]?.spend ?? ""} onChange={(e) => setValues((p) => ({ ...p, [a.id]: { ...p[a.id], spend: e.target.value } }))} /></td>
                <td className="px-3 py-1.5 text-right"><input type="number" min={0} step="1" className={cell} placeholder="blank = not entered"
                  value={values[a.id]?.leads ?? ""} onChange={(e) => setValues((p) => ({ ...p, [a.id]: { ...p[a.id], leads: e.target.value } }))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={busy} onClick={save} className="rounded-md bg-brand-600 px-5 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        {status && <span className="text-sm text-gray-700">{status}</span>}
      </div>
    </div>
  );
}
