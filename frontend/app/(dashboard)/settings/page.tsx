"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User, Bell, Shield, CreditCard, Loader2, CheckCircle2,
  AlertCircle, Mail, LogOut, KeyRound, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Not authenticated");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

// ── Inline banner ─────────────────────────────────────────────────────────────

function Banner({ type, msg }: { type: "ok" | "err"; msg: string }) {
  return (
    <div className={cn(
      "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm",
      type === "ok"
        ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-400"
        : "border-destructive/25 bg-destructive/5 text-destructive"
    )}>
      {type === "ok"
        ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
        : <AlertCircle   size={14} className="shrink-0 mt-0.5" />}
      {msg}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle(): void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        on ? "bg-primary" : "bg-muted"
      )}
    >
      <span className={cn(
        "inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
        on ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [status,  setStatus]  = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [email,     setEmail]     = useState("");
  const [fullName,  setFullName]  = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [initials,  setInitials]  = useState("U");

  useEffect(() => {
    (async () => {
      try {
        const p = await apiFetch("/api/v1/profile/me");
        setEmail(p.email ?? "");
        setFullName(p.full_name ?? "");
        setAvatarUrl(p.avatar_url ?? "");
        const name: string = p.full_name ?? p.email ?? "";
        setInitials(name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "U");
      } catch (e: unknown) {
        setStatus({ type: "err", msg: e instanceof Error ? e.message : "Failed to load profile." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const updated = await apiFetch("/api/v1/profile/me", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName.trim() || null, avatar_url: avatarUrl.trim() || null }),
      });
      setFullName(updated.full_name ?? "");
      setAvatarUrl(updated.avatar_url ?? "");
      const name: string = updated.full_name ?? updated.email ?? "";
      setInitials(name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "U");
      setStatus({ type: "ok", msg: "Profile updated." });
    } catch (e: unknown) {
      setStatus({ type: "err", msg: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex h-32 items-center justify-center">
      <Loader2 size={18} className="animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Avatar + identity */}
      <div className="flex items-center gap-5">
        <Avatar className="h-16 w-16 border border-border/50">
          <AvatarImage src={avatarUrl || undefined} alt={fullName || "Avatar"} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-base leading-none">{fullName || email || "Your profile"}</p>
          <p className="text-sm text-muted-foreground mt-1">{email}</p>
        </div>
      </div>

      {status && <Banner type={status.type} msg={status.msg} />}

      {/* Fields */}
      <div className="space-y-5 max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="full-name" className="text-sm">Display name</Label>
          <Input id="full-name" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="avatar-url" className="text-sm">Avatar URL</Label>
          <Input id="avatar-url" type="url" placeholder="https://…/avatar.jpg" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
          <p className="text-xs text-muted-foreground">Paste a public image URL.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email-ro" className="text-sm">Email</Label>
          <Input id="email-ro" type="email" value={email} disabled className="opacity-50" />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Mail size={10} /> Managed by your auth provider.
          </p>
        </div>
      </div>

      <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
        {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

// ── Security tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const [sending,  setSending]  = useState(false);
  const [rStatus,  setRStatus]  = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const sendReset = async () => {
    setSending(true);
    setRStatus(null);
    try {
      const { data } = await supabase.auth.getSession();
      const emailAddr = data.session?.user?.email;
      if (!emailAddr) throw new Error("Could not determine your email.");
      const { error } = await supabase.auth.resetPasswordForEmail(emailAddr, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setRStatus({ type: "ok", msg: `Reset link sent to ${emailAddr}.` });
    } catch (e: unknown) {
      setRStatus({ type: "err", msg: e instanceof Error ? e.message : "Failed to send reset email." });
    } finally {
      setSending(false);
    }
  };

  const signOutAll = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      window.location.href = "/";
    } catch { setSigningOut(false); }
  };

  return (
    <div className="space-y-10 max-w-md">
      {/* Password */}
      <div className="space-y-4">
        <div>
          <p className="section-label">Password</p>
          <h3 className="mt-0.5 flex items-center gap-2"><KeyRound size={16} /> Reset password</h3>
          <p className="text-sm text-muted-foreground mt-1">
            A reset link will be sent to your registered email address.
          </p>
        </div>
        {rStatus && <Banner type={rStatus.type} msg={rStatus.msg} />}
        <Button variant="outline" size="sm" onClick={sendReset} disabled={sending} className="gap-1.5">
          {sending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
          {sending ? "Sending…" : "Send reset email"}
        </Button>
      </div>

      {/* Sessions */}
      <div className="space-y-4 section-divide pt-6">
        <div>
          <p className="section-label">Sessions</p>
          <h3 className="mt-0.5 flex items-center gap-2"><LogOut size={16} /> Sign out everywhere</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Terminates all active sessions across every device.
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={signOutAll} disabled={signingOut} className="gap-1.5">
          {signingOut ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
          {signingOut ? "Signing out…" : "Sign out all devices"}
        </Button>
      </div>
    </div>
  );
}

// ── Notifications tab ─────────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  emailInterviewComplete: true,
  emailWeeklySummary:     false,
  emailProductUpdates:    true,
  browserPush:            false,
};

const NOTIF_ROWS = [
  { key: "emailInterviewComplete" as const, label: "Interview completed",   desc: "When an AI mock interview session finishes." },
  { key: "emailWeeklySummary"     as const, label: "Weekly summary",        desc: "A digest of your interview performance." },
  { key: "emailProductUpdates"    as const, label: "Product updates",        desc: "New features and announcements." },
  { key: "browserPush"            as const, label: "Browser notifications",  desc: "Real-time alerts while active." },
];

function NotificationsTab() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    const s = localStorage.getItem("notif_prefs");
    if (s) { try { setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(s) }); } catch {} }
  }, []);

  const save = () => {
    localStorage.setItem("notif_prefs", JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div className="space-y-8 max-w-md">
      <div className="divide-y divide-border/30">
        {NOTIF_ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{row.desc}</p>
            </div>
            <Toggle on={prefs[row.key]} onToggle={() => setPrefs((p) => ({ ...p, [row.key]: !p[row.key] }))} />
          </div>
        ))}
      </div>
      <Button size="sm" onClick={save} className="gap-1.5">
        {saved ? <><CheckCircle2 size={13} /> Saved!</> : <><CheckCircle2 size={13} /> Save preferences</>}
      </Button>
    </div>
  );
}

// ── Billing tab ───────────────────────────────────────────────────────────────

function BillingTab() {
  const [stats, setStats] = useState<{ resumes: number; interviews: number } | null>(null);
  useEffect(() => {
    apiFetch("/api/v1/dashboard/summary").then((d) =>
      setStats({ resumes: d.total_resumes ?? 0, interviews: d.total_interviews ?? 0 })
    ).catch(() => {});
  }, []);

  return (
    <div className="space-y-8 max-w-md">
      <div className="space-y-4">
        <div>
          <p className="section-label">Plan</p>
          <h3 className="mt-0.5 flex items-center gap-2"><Sparkles size={16} className="text-primary" /> Beta Pro</h3>
          <p className="text-sm text-muted-foreground mt-1">Free full access during the beta period.</p>
        </div>
        <div className="space-y-0">
          {[
            "Unlimited résumé analysis",
            "Unlimited mock interview sessions",
            "7 tailored questions per session",
            "Instant AI feedback & scoring",
            "Full results history",
          ].map((f) => (
            <div key={f} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <p className="text-sm text-muted-foreground">{f}</p>
            </div>
          ))}
        </div>
      </div>

      {stats && (
        <div className="space-y-3 section-divide pt-6">
          <p className="section-label">Your usage</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Résumés analysed",  value: stats.resumes },
              { label: "Interviews taken",  value: stats.interviews },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border/50 bg-card p-4 text-center">
                <p className="text-2xl font-bold text-primary">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-50">
        <CreditCard size={13} /> Manage billing (coming soon)
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="space-y-8 fade-in max-w-2xl">
      <div className="space-y-1.5">
        <h1>Settings</h1>
        <p className="text-muted-foreground text-base">Manage your account and preferences.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="bg-transparent p-0 gap-0 border-b border-border/40 w-full justify-start rounded-none h-auto mb-8">
          {[
            { value: "profile",       icon: User,        label: "Profile" },
            { value: "notifications", icon: Bell,        label: "Notifications" },
            { value: "security",      icon: Shield,      label: "Security" },
            { value: "billing",       icon: CreditCard,  label: "Billing" },
          ].map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground px-4 py-2.5 text-sm font-medium gap-1.5"
            >
              <Icon size={14} /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
        <TabsContent value="billing"><BillingTab /></TabsContent>
      </Tabs>
    </div>
  );
}
