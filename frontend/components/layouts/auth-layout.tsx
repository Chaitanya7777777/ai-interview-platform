import React from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <div className="flex flex-1 flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 w-full lg:w-1/2">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex flex-col items-center lg:items-start">
            <Link href="/" className="flex items-center gap-2 font-bold text-2xl tracking-tight mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                <FileText size={24} />
              </div>
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">InterviewAI</span>
            </Link>
          </div>
          {children}
        </div>
      </div>
      
      <div className="relative hidden w-0 flex-1 lg:block bg-primary/5 border-l border-border/50">
        <div className="absolute inset-0 h-full w-full object-cover flex items-center justify-center p-24">
          <div className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl overflow-hidden border border-border/50">
            {/* Minimal mockup illustration */}
            <div className="h-12 border-b bg-muted/50 flex items-center px-4 gap-2">
              <div className="h-3 w-3 rounded-full bg-destructive/80" />
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <div className="h-3 w-3 rounded-full bg-green-400" />
            </div>
            <div className="p-8 space-y-6">
              <div className="h-8 w-1/3 bg-muted rounded-lg" />
              <div className="space-y-3">
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-4 w-3/4 bg-muted rounded" />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="h-24 bg-primary/10 border border-primary/20 rounded-xl" />
                <div className="h-24 bg-primary/10 border border-primary/20 rounded-xl" />
              </div>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
