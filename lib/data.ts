import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdAccount, AdRow, Channel, SalesRow } from "./metrics";

export type Role = "pending" | "sales" | "ads" | "admin";
export type Profile = { id: string; full_name: string; email: string | null; role: Role };
export type Target = { month: string; sales_target: number; ad_spend_target: number };

/** Supabase returns at most 1000 rows per request, so page through. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

export async function loadSetup(sb: SupabaseClient) {
  const [ch, ac, pr] = await Promise.all([
    sb.from("channels").select("*").order("sort_order").order("id"),
    sb.from("ad_accounts").select("*").order("sort_order").order("id"),
    sb.from("profiles").select("id, full_name, email, role").order("full_name"),
  ]);
  return {
    channels: (ch.data ?? []) as Channel[],
    adAccounts: (ac.data ?? []) as AdAccount[],
    profiles: (pr.data ?? []) as Profile[],
  };
}

export async function loadRange(sb: SupabaseClient, from: string, to: string) {
  const [sales, ads] = await Promise.all([
    fetchAll<SalesRow>((a, b) =>
      sb.from("sales_entries")
        .select("entry_date, channel_id, user_id, new_sales, repeat_sales, new_orders, repeat_orders, new_enquiries, existing_enquiries")
        .gte("entry_date", from).lte("entry_date", to).order("id").range(a, b),
    ),
    fetchAll<AdRow>((a, b) =>
      sb.from("ad_entries").select("entry_date, ad_account_id, spend, platform_leads")
        .gte("entry_date", from).lte("entry_date", to).order("id").range(a, b),
    ),
  ]);
  const num = <T extends object>(r: T) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" && k !== "entry_date" && k !== "user_id" ? Number(v) : v])) as T;
  return { sales: sales.map(num), ads: ads.map(num) };
}

export async function currentProfile(sb: SupabaseClient) {
  const { data: claims } = await sb.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return null;
  const { data } = await sb.from("profiles").select("id, full_name, email, role").eq("id", uid).single();
  return (data as Profile) ?? null;
}
