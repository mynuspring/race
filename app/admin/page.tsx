import { requireRole } from "@/lib/guard";
import { loadSetup, type Target } from "@/lib/data";
import AdminPanel from "./AdminPanel";

export default async function AdminPage() {
  const { sb, profile } = await requireRole(["admin"]);
  const setup = await loadSetup(sb);
  const { data: targets } = await sb.from("monthly_targets").select("*").order("month", { ascending: false });
  return <AdminPanel {...setup} targets={(targets ?? []) as Target[]} me={profile.id} />;
}
