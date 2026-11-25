"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data";

export default function Nav({ profile }: { profile: Profile }) {
  const path = usePathname();
  const router = useRouter();
  const links = [
    { href: "/", label: "Dashboard", show: profile.role !== "pending" },
    { href: "/entry/sales", label: "Enter sales", show: profile.role === "sales" || profile.role === "admin" },
    { href: "/entry/ads", label: "Enter ads", show: profile.role === "ads" || profile.role === "admin" },
    { href: "/admin", label: "Admin", show: profile.role === "admin" },
  ].filter((l) => l.show);
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="font-semibold text-brand-700">NuSpring Race Report</span>
        <nav className="flex flex-wrap gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`rounded-md px-3 py-1.5 text-sm ${path === l.href ? "bg-brand-50 font-medium text-brand-700" : "text-gray-600 hover:bg-gray-100"}`}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-gray-500">
          <span>{profile.full_name || profile.email} · {profile.role}</span>
          <button className="rounded-md px-2 py-1 hover:bg-gray-100"
            onClick={async () => { await createClient().auth.signOut(); router.push("/login"); router.refresh(); }}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
