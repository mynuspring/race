import { requireRole } from "@/lib/guard";
import { loadSetup } from "@/lib/data";
import AdsEntryForm from "./AdsEntryForm";

export default async function AdsEntryPage() {
  const { sb } = await requireRole(["ads", "admin"]);
  const { adAccounts } = await loadSetup(sb);
  return <AdsEntryForm adAccounts={adAccounts.filter((a) => a.active)} />;
}
