"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const sb = createClient();
    if (mode === "in") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
      else { router.push("/"); router.refresh(); }
    } else {
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setMsg(error.message);
      else if (data.session) { router.push("/"); router.refresh(); }
      else setMsg("Check your email to confirm your account, then sign in. An admin will then give you access.");
    }
    setBusy(false);
  }

  const input = "w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none";
  return (
    <div className="mx-auto mt-16 max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold text-brand-700">NuSpring Race Report</h1>
      <p className="mb-5 text-sm text-gray-500">{mode === "in" ? "Sign in to continue" : "Create your account"}</p>
      <form onSubmit={submit} className="space-y-3">
        {mode === "up" && <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />}
        <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={input} type="password" placeholder="Password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button disabled={busy} className="w-full rounded-md bg-brand-600 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
      <button className="mt-4 text-sm text-brand-700 hover:underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }}>
        {mode === "in" ? "New staff? Create an account" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
