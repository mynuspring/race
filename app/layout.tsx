import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/data";

export const metadata: Metadata = { title: "NuSpring Race Report", description: "Daily sales, enquiries and ad performance" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const profile = await currentProfile(sb);
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {profile && <Nav profile={profile} />}
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
