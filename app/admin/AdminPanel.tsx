"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AdAccount, Channel } from "@/lib/metrics";
import { monthStart, todayMY } from "@/lib/metrics";
import type { Profile, Role, Target } from "@/lib/data";
import { rm } from "@/lib/format";

type Props = { channels: Channel[]; adAccounts: AdAccount[]; profiles: Profile[]; targets: Target[]; me: string };

const box = "rounded-xl border border-gray-200 bg-white p-4";
const input = "rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none";
const btn = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50";

export default function AdminPanel({ channels, adAccounts, profiles, targets, me }: Props) {
  const sb = createClient();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok = "Saved.") => {
    const { error } = await p;
    setMsg(error ? `Error: ${error.message}` : ok);
    if (!error) router.refresh();
  };

  const [ch, setCh] = useState({ name: "", kind: "chat", owned: false, ad_account_id: "" });
  const [acc, setAcc] = useState("");
  const [tg, setTg] = useState({ month: monthStart(todayMY()).slice(0, 7), sales: "", spend: "" });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Admin</h1>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>

      <section className={box}>
        <h2 className="mb-1 font-semibold">Team</h2>
        <p className="mb-3 text-sm text-gray-500">Staff sign up on the login page, then you give them a role here. Sales enter sales and enquiries; Ads enter ad spend. Everyone with a role can see the dashboard.</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500"><tr><th className="py-1">Name</th><th>Email</th><th>Role</th></tr></thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="py-2">{p.full_name || "–"}</td>
                <td>{p.email}</td>
                <td>
                  <select className={input} value={p.role} disabled={p.id === me}
                    onChange={(e) => run(sb.from("profiles").update({ role: e.target.value as Role }).eq("id", p.id))}>
                    <option value="pending">Pending (no access)</option>
                    <option value="sales">Sales</option>
                    <option value="ads">Ads specialist</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={box}>
        <h2 className="mb-1 font-semibold">Channels</h2>
        <p className="mb-3 text-sm text-gray-500">Chat channels get sales, orders and enquiries. Marketplace channels (Shopee, website) get sales only. Link a channel to the ad account that brings its enquiries, so cost per enquiry is calculated correctly.</p>
        <table className="mb-4 w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500"><tr><th className="py-1">Name</th><th>Type</th><th>Own / KOL</th><th>Paid by ad account</th><th>Active</th></tr></thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="py-2">{c.name}</td>
                <td>{c.kind}</td>
                <td>{c.owned ? "Own" : "KOL / partner"}</td>
                <td>
                  <select className={input} value={c.ad_account_id ?? ""}
                    onChange={(e) => run(sb.from("channels").update({ ad_account_id: e.target.value ? Number(e.target.value) : null }).eq("id", c.id))}>
                    <option value="">None</option>
                    {adAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </td>
                <td><input type="checkbox" checked={c.active} onChange={(e) => run(sb.from("channels").update({ active: e.target.checked }).eq("id", c.id))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-2">
          <input className={input} placeholder="New channel, e.g. KOL name" value={ch.name} onChange={(e) => setCh({ ...ch, name: e.target.value })} />
          <select className={input} value={ch.kind} onChange={(e) => setCh({ ...ch, kind: e.target.value })}><option value="chat">Chat</option><option value="marketplace">Marketplace</option></select>
          <select className={input} value={ch.owned ? "own" : "kol"} onChange={(e) => setCh({ ...ch, owned: e.target.value === "own" })}><option value="kol">KOL / partner</option><option value="own">Own</option></select>
          <select className={input} value={ch.ad_account_id} onChange={(e) => setCh({ ...ch, ad_account_id: e.target.value })}>
            <option value="">No ad account</option>
            {adAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button className={btn} disabled={!ch.name.trim()} onClick={() => {
            run(sb.from("channels").insert({ name: ch.name.trim(), kind: ch.kind, owned: ch.owned, ad_account_id: ch.ad_account_id ? Number(ch.ad_account_id) : null, sort_order: channels.length + 1 }), "Channel added.");
            setCh({ name: "", kind: "chat", owned: false, ad_account_id: "" });
          }}>Add channel</button>
        </div>
      </section>

      <section className={box}>
        <h2 className="mb-1 font-semibold">Ad accounts</h2>
        <p className="mb-3 text-sm text-gray-500">Each ad account gets a daily spend and Ads Manager lead count from the ads specialist.</p>
        <ul className="mb-3 space-y-1 text-sm">
          {adAccounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3">
              <span className="w-56">{a.name}</span>
              <label className="flex items-center gap-1 text-gray-500"><input type="checkbox" checked={a.active}
                onChange={(e) => run(sb.from("ad_accounts").update({ active: e.target.checked }).eq("id", a.id))} /> active</label>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input className={input} placeholder="New ad account" value={acc} onChange={(e) => setAcc(e.target.value)} />
          <button className={btn} disabled={!acc.trim()} onClick={() => { run(sb.from("ad_accounts").insert({ name: acc.trim(), sort_order: adAccounts.length + 1 }), "Ad account added."); setAcc(""); }}>Add</button>
        </div>
      </section>

      <section className={box}>
        <h2 className="mb-1 font-semibold">Monthly targets</h2>
        <table className="mb-3 w-full max-w-lg text-sm">
          <thead className="text-left text-xs uppercase text-gray-500"><tr><th className="py-1">Month</th><th className="text-right">Sales target</th><th className="text-right">Ad spend budget</th></tr></thead>
          <tbody>
            {targets.map((t) => (
              <tr key={t.month} className="border-t border-gray-100">
                <td className="py-2">{t.month.slice(0, 7)}</td><td className="text-right num">{rm(Number(t.sales_target))}</td><td className="text-right num">{rm(Number(t.ad_spend_target))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-2">
          <input type="month" className={input} value={tg.month} onChange={(e) => setTg({ ...tg, month: e.target.value })} />
          <input type="number" className={input} placeholder="Sales target (RM)" value={tg.sales} onChange={(e) => setTg({ ...tg, sales: e.target.value })} />
          <input type="number" className={input} placeholder="Ad spend budget (RM)" value={tg.spend} onChange={(e) => setTg({ ...tg, spend: e.target.value })} />
          <button className={btn} disabled={!tg.month || !tg.sales} onClick={() =>
            run(sb.from("monthly_targets").upsert({ month: `${tg.month}-01`, sales_target: Number(tg.sales), ad_spend_target: Number(tg.spend) || 0 }), "Target saved.")}>
            Save target
          </button>
        </div>
      </section>
    </div>
  );
}
