import { requireRole } from "@/lib/guard";
import { loadSetup } from "@/lib/data";
import SalesEntryForm from "./SalesEntryForm";

export default async function SalesEntryPage() {
  const { sb, profile } = await requireRole(["sales", "admin"]);
  const { channels } = await loadSetup(sb);
  return <SalesEntryForm channels={channels.filter((c) => c.active)} userId={profile.id} />;
}
