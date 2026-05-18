"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  FileText, 
  MessageSquare, 
  History, 
  Settings, 
  LogOut,
  Menu,
  X,
  Bell,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const sidebarLinks = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Resume Analysis", href: "/resume-analysis", icon: FileText },
  { name: "Mock Interviews", href: "/mock-interview", icon: MessageSquare },
  { name: "History", href: "/history", icon: History },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      toast.success("Signed out successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setIsSigningOut(false);
    }
  };

  const avatarFallback = user?.email?.charAt(0)?.toUpperCase() ?? "U";

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-300 md:relative md:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 shrink-0 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText size={18} />
            </div>
            InterviewAI
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto md:hidden"
            onClick={() => setIsMobileOpen(false)}
          >
            <X size={20} />
          </Button>
        </div>
        
        <div className="flex-1 overflow-auto py-4">
          <nav className="flex flex-col gap-1 px-4">
            {sidebarLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative group overflow-hidden",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => setIsMobileOpen(false)}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                  )}
                  <link.icon size={18} className={isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"} />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="border-t p-4">
          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            {isSigningOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-6 bg-card/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <h1 className="text-lg font-semibold capitalize hidden sm:block">
              {pathname.split("/")[1]?.replace("-", " ") || "Dashboard"}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative rounded-full">
              <Bell size={20} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={handleSignOut}
              aria-label="Sign out"
              disabled={isSigningOut}
            >
              {isSigningOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
            </Button>
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src={user?.user_metadata?.avatar_url ?? "https://github.com/shadcn.png"} alt={user?.email ?? "User"} />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
