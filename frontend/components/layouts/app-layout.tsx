"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  MessageSquare,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  Loader2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NAV = [
  { name: "Dashboard",       href: "/dashboard",       icon: LayoutDashboard },
  { name: "Resume Analysis", href: "/resume-analysis",  icon: FileText },
  { name: "Job Match",       href: "/job-match",        icon: Briefcase },
  { name: "Mock Interviews", href: "/mock-interview",   icon: MessageSquare },
  { name: "History",         href: "/history",          icon: History },
  { name: "Settings",        href: "/settings",         icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
      toast.success("Signed out.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to sign out.");
    } finally {
      setSigningOut(false);
    }
  };

  const initials =
    (user?.user_metadata?.full_name as string | undefined)
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ??
    user?.email?.charAt(0)?.toUpperCase() ??
    "U";

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 group"
          onClick={() => setMobileOpen(false)}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-105">
            <Zap size={14} strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight">InterviewAI</span>
        </Link>
        {/* Mobile close */}
        <button
          className="rounded-md p-1 text-muted-foreground hover:text-foreground md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Sign out — top of sidebar ─────────────────────────────────── */}
      <div className="px-3 pb-2">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-destructive/8 hover:text-destructive disabled:opacity-50 group"
        >
          {signingOut
            ? <Loader2 size={18} className="shrink-0 animate-spin" />
            : <LogOut size={18} strokeWidth={1.8} className="shrink-0 transition-colors group-hover:text-destructive" />}
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div className="mx-4 border-t border-border/40 mb-2" />

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-auto px-3 py-1">
        <div className="space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2.5 text-base font-medium transition-all duration-150 outline-none",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:bg-muted/50"
                )}
              >
                <item.icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.8}
                  className={cn(
                    "shrink-0 transition-colors",
                    active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── User footer ──────────────────────────────────────────────── */}
      <div className="border-t border-border/40 p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <Avatar className="h-8 w-8 shrink-0 text-xs">
            <AvatarImage
              src={(user?.user_metadata?.avatar_url as string | undefined) ?? undefined}
              alt={user?.email ?? "User"}
            />
            <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-none truncate">
              {(user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split("@")[0]}
            </p>
            <p className="text-xs text-muted-foreground/60 leading-none mt-0.5 truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* ── Mobile overlay ────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-border/40 bg-sidebar transition-transform duration-200 ease-out md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header bar — only visible on small screens */}
        <header className="flex h-12 shrink-0 items-center border-b border-border/40 px-4 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          >
            <Menu size={18} />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 ml-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Zap size={12} strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold">InterviewAI</span>
          </Link>
        </header>

        {/* ── Page content ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
