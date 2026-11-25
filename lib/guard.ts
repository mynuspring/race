import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile, type Role } from "@/lib/data";

/** Load the signed-in profile and redirect if their role is not allowed here. */
export async function requireRole(allowed: Role[]) {
  const sb = await createClient();
  const profile = await currentProfile(sb);
  if (!profile) redirect("/login");
  if (profile.role === "pending") redirect("/pending");
  if (!allowed.includes(profile.role)) redirect("/");
  return { sb, profile };
}
