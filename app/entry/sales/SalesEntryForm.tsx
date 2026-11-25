"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDays, todayMY, type Channel } from "@/lib/metrics";
import { rm } from "@/lib/format";

const FIELDS = [
  { key: "new_sales", label: "New customer sales (RM)", money: true, chatOnly: false },
  { key: "repeat_sales", label: "Repeat customer sales (RM)", money: true, chatOnly: false },
  { key: "new_orders", label: "New orders", money: false, chatOnly: true },
  { key: "repeat_orders", label: "Repeat orders", money: false, chatOnly: true },
  { key: "new_enquiries", label: "New enquiries", money: false, chatOnly: true },
  { key: "existing_enquiries", label: "Existing customer enquiries", money: false, chatOnly: true },
] as const;
type Key = (typeof FIELDS)[number]["key"];
type Values = Record<number, Record<Key, string>>;

const blank = (): Record<Key, string> =>
  Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<Key, string>;

export default function SalesEntryForm({ channels, userId }: { channels: Channel[]; userId: string }) {
  const [date, setDate] = useState(todayMY());
  const [values, setValues] = useState<Values>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sb = createClient();

  const load = useCallback(async () => {
    setStatus(null);
    const { data, error } = await sb.from("sales_entries").select("*").eq("entry_date", date).eq("user_id", userId);
    if (error) { setStatus(error.message); return; }
    const v: Values = {};
    for (const c of channels) v[c.id] = blank();
    for (const r of data ?? []) {
      v[r.channel_id] = Object.fromEntries(FIELDS.map((f) => [f.key, r[f.key] ? String(Number(r[f.key])) : ""])) as Record<Key, string>;
    }
    setValues(v);
  }, [date, userId, channels]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const set = (cid: number, k: Key, val: string) =>
    setValues((p) => ({ ...p, [cid]: { ...(p[cid] ?? blank()), [k]: val } }));

  async function save() {
    setBusy(true); setStatus(null);
    const rows = channels.map((c) => {
      const v = values[c.id] ?? blank();
      const num = (k: Key) => (v[k] === "" ? 0 : Number(v[k]));
      return {
        entry_date: date, channel_id: c.id, user_id: userId,
        new_sales: num("new_sales"), repeat_sales: num("repeat_sales"),
        new_orders: c.kind === "chat" ? num("new_orders") : 0, repeat_orders: c.kind === "chat" ? num("repeat_orders") : 0,
        new_enquiries: c.kind === "chat" ? num("new_enquiries") : 0, existing_enquiries: c.kind === "chat" ? num("existing_enquiries") : 0,
      };
    });
    const bad = rows.find((r) => Object.values(r).some((x) => typeof x === "number" && (Number.isNaN(x) || x < 0)));
    if (bad) { setStatus("Please enter numbers of 0 or more only."); setBusy(false); return; }
    // Warn on sales without an order, the most common keying slip
    const slip = rows.find((r) => {
      const c = channels.find((x) => x.id === r.channel_id)!;
      return c.kind === "chat" && ((r.new_sales > 0 && r.new_orders === 0) || (r.repeat_sales > 0 && r.repeat_orders === 0));
    });
    const { error } = await sb.from("sales_entries").upsert(rows, { onConflict: "entry_date,channel_id,user_id" });
    setBusy(false);
    if (error) setStatus(`Not saved: ${error.message}`);
    else setStatus(slip ? "Saved. Note: one channel has sales but 0 orders, please double-check." : "Saved.");
  }

  const total = (k: Key) => channels.reduce((s, c) => s + (Number(values[c.id]?.[k]) || 0), 0);
  const cell = "w-full rounded border border-gray-300 px-2 py-1.5 text-right num focus:border-brand-500 focus:outline-none";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">Enter my sales</h1>
          <p className="text-sm text-gray-500">Your own figures for the day. Saving again updates them.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="rounded border px-2 py-1.5 text-sm" onClick={() => setDate(addDays(date, -1))}>‹</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5" />
          <button className="rounded border px-2 py-1.5 text-sm" onClick={() => setDate(addDays(date, 1))}>›</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Channel</th>
              {FIELDS.map((f) => <th key={f.key} className="px-2 py-2 text-right">{f.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium">{c.name}{c.kind === "marketplace" && <span className="ml-1 text-xs text-gray-400">(sales only)</span>}</td>
                {FIELDS.map((f) => (
                  <td key={f.key} className="px-2 py-1.5">
                    {f.chatOnly && c.kind === "marketplace" ? <span className="block text-right text-gray-300">–</span> : (
                      <input inputMode="decimal" type="number" min={0} step={f.money ? "0.01" : "1"} className={cell}
                        value={values[c.id]?.[f.key] ?? ""} onChange={(e) => set(c.id, f.key, e.target.value)} placeholder="0" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-medium">
              <td className="px-3 py-2">Total</td>
              {FIELDS.map((f) => <td key={f.key} className="px-3 py-2 text-right num">{f.money ? rm(total(f.key), 2) : total(f.key)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={busy} onClick={save} className="rounded-md bg-brand-600 px-5 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
        {status && <span className="text-sm text-gray-700">{status}</span>}
      </div>
      <p className="text-xs text-gray-500">New = first-time customer. Enquiries = chats received that day. Shopee and website: enter that day&apos;s total sales.</p>
    </div>
  );
}
