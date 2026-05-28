"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  User, Bell, Shield, CreditCard, Loader2, CheckCircle2,
  AlertCircle, Camera, Trash2, LogOut, KeyRound, Mail,
  Info, Sparkles,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Not authenticated");
  return data.session.access_token;
}

async function apiFetch(path: string, init?: RequestInit) {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBanner({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
        type === "success"
          ? "border-green-200 bg-green-500/10 text-green-700"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [status, setStatus]       = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [email, setEmail]         = useState("");
  const [fullName, setFullName]   = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [initials, setInitials]   = useState("U");
  const [joinedAt, setJoinedAt]   = useState("");

  useEffect(() => {
    (async () => {
      try {
        const profile = await apiFetch("/api/v1/profile/me");
        setEmail(profile.email ?? "");
        setFullName(profile.full_name ?? "");
        setAvatarUrl(profile.avatar_url ?? "");
        setJoinedAt(
          profile.created_at
            ? new Date(profile.created_at).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              })
            : ""
        );
        const name: string = profile.full_name ?? profile.email ?? "";
        setInitials(
          name
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "U"
        );
      } catch (e: unknown) {
        setStatus({ type: "error", msg: e instanceof Error ? e.message : "Failed to load profile." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const updated = await apiFetch("/api/v1/profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        }),
      });
      setFullName(updated.full_name ?? "");
      setAvatarUrl(updated.avatar_url ?? "");
      const name: string = updated.full_name ?? updated.email ?? "";
      setInitials(
        name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "U"
      );
      setStatus({ type: "success", msg: "Profile saved successfully." });
    } catch (e: unknown) {
      setStatus({ type: "error", msg: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Profile card */}
      <Card className="shadow-sm border-border/50">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your display name and avatar URL.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar row */}
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-border ring-2 ring-primary/10">
                <AvatarImage src={avatarUrl || undefined} alt={fullName || "Avatar"} />
                <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="space-y-1 text-center sm:text-left">
              <p className="font-semibold text-lg">{fullName || "Your Name"}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
              {joinedAt && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center sm:justify-start">
                  <Info className="h-3 w-3" /> Member since {joinedAt}
                </p>
              )}
            </div>
          </div>

          {status && <StatusBanner type={status.type} message={status.msg} />}

          {/* Fields */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="full-name">Display Name</Label>
              <Input
                id="full-name"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="avatar-url">Avatar URL</Label>
              <Input
                id="avatar-url"
                type="url"
                placeholder="https://example.com/avatar.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paste a public image URL. Supports JPG, PNG, WebP.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email-ro">Email</Label>
              <Input id="email-ro" type="email" value={email} disabled />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email is managed by your authentication provider and cannot be changed here.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4 bg-muted/20 gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ── Security Tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const [sendingReset, setSendingReset] = useState(false);
  const [resetStatus, setResetStatus]   = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [signingOut, setSigningOut]     = useState(false);

  const handlePasswordReset = async () => {
    setSendingReset(true);
    setResetStatus(null);
    try {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email;
      if (!email) throw new Error("Could not determine your email address.");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetStatus({
        type: "success",
        msg: `Password reset email sent to ${email}. Check your inbox.`,
      });
    } catch (e: unknown) {
      setResetStatus({ type: "error", msg: e instanceof Error ? e.message : "Failed to send reset email." });
    } finally {
      setSendingReset(false);
    }
  };

  const handleSignOutAll = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      window.location.href = "/login";
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Password reset */}
      <Card className="shadow-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Password
          </CardTitle>
          <CardDescription>
            Send a password reset link to your registered email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {resetStatus && <StatusBanner type={resetStatus.type} message={resetStatus.msg} />}
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground space-y-1">
            <p>• A reset link will be sent to your registered email.</p>
            <p>• The link expires in 1 hour.</p>
            <p>• You will be signed out of all devices after resetting.</p>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4 bg-muted/20">
          <Button
            variant="outline"
            onClick={handlePasswordReset}
            disabled={sendingReset}
            className="gap-2"
          >
            {sendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {sendingReset ? "Sending…" : "Send Reset Email"}
          </Button>
        </CardFooter>
      </Card>

      {/* Active session */}
      <Card className="shadow-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-primary" />
            Sessions
          </CardTitle>
          <CardDescription>Sign out from all devices globally.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-4">
            <div>
              <p className="text-sm font-medium">Current Session</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This device · {typeof navigator !== "undefined" ? navigator.platform : "Unknown"}
              </p>
            </div>
            <Badge variant="outline" className="border-green-200 bg-green-500/10 text-green-600 text-xs">
              Active
            </Badge>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4 bg-muted/20">
          <Button
            variant="destructive"
            onClick={handleSignOutAll}
            disabled={signingOut}
            className="gap-2"
          >
            {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            {signingOut ? "Signing out…" : "Sign Out All Devices"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ── Notifications Tab ─────────────────────────────────────────────────────────

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        enabled ? "bg-primary" : "bg-muted"
      }`}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

const DEFAULT_PREFS = {
  emailInterviewComplete: true,
  emailWeeklySummary:     false,
  emailProductUpdates:    true,
  browserPush:            false,
};

function NotificationsTab() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof typeof prefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = () => {
    // Preferences are local-only for now (no notifications table in DB).
    // Persist to localStorage so they survive page reload.
    localStorage.setItem("notif_prefs", JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  useEffect(() => {
    const saved = localStorage.getItem("notif_prefs");
    if (saved) {
      try { setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(saved) }); } catch {}
    }
  }, []);

  const rows = [
    { key: "emailInterviewComplete" as const, label: "Interview completed", desc: "Get notified when an AI mock interview session finishes." },
    { key: "emailWeeklySummary"     as const, label: "Weekly progress summary", desc: "A weekly digest of your interview performance and resume scores." },
    { key: "emailProductUpdates"    as const, label: "Product updates", desc: "New features, improvements, and announcements." },
    { key: "browserPush"            as const, label: "Browser push notifications", desc: "Real-time alerts while you are active on the platform." },
  ];

  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notification Preferences
        </CardTitle>
        <CardDescription>Choose what you want to be notified about.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border/40">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{row.desc}</p>
            </div>
            <Toggle enabled={prefs[row.key]} onToggle={() => toggle(row.key)} />
          </div>
        ))}
      </CardContent>
      <CardFooter className="border-t px-6 py-4 bg-muted/20 gap-3">
        <Button onClick={handleSave} className="gap-2">
          {saved
            ? <><CheckCircle2 className="h-4 w-4" /> Saved!</>
            : <><CheckCircle2 className="h-4 w-4" /> Save Preferences</>
          }
        </Button>
      </CardFooter>
    </Card>
  );
}

// ── Billing Tab ───────────────────────────────────────────────────────────────

function BillingTab() {
  const features = [
    "Unlimited AI resume analysis",
    "Unlimited mock interview sessions",
    "7 tailored questions per session",
    "Instant AI feedback & scoring",
    "Full answer history & results",
    "Dashboard analytics",
  ];

  return (
    <div className="space-y-5">
      <Card className="shadow-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Current Plan
          </CardTitle>
          <CardDescription>You are on the free beta plan with full access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-lg">Beta Pro</h3>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/30">
                Free Access
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              During the beta period, all features are free and unlimited.
            </p>
            <ul className="space-y-2">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4 bg-muted/20">
          <Button variant="outline" disabled className="gap-2 opacity-60">
            <CreditCard className="h-4 w-4" />
            Manage Billing (coming soon)
          </Button>
        </CardFooter>
      </Card>

      {/* Usage stats from DB (read-only) */}
      <UsageStats />
    </div>
  );
}

function UsageStats() {
  const [stats, setStats] = useState<{ resumes: number; interviews: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const dash = await apiFetch("/api/v1/dashboard/summary");
        setStats({
          resumes:    dash.total_resumes   ?? 0,
          interviews: dash.total_interviews ?? 0,
        });
      } catch {}
    })();
  }, []);

  if (!stats) return null;

  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Your Usage</CardTitle>
        <CardDescription>Lifetime activity on your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Resumes Analysed",   value: stats.resumes },
            { label: "Interviews Taken",    value: stats.interviews },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center">
              <div className="text-3xl font-bold text-primary">{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your account settings and preferences.</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
          <TabsTrigger value="profile">
            <User className="mr-1.5 h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-1.5 h-4 w-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-1.5 h-4 w-4" /> Security
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard className="mr-1.5 h-4 w-4" /> Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="billing">
          <BillingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
