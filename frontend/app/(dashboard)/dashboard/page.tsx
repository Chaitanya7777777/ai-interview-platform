"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FileText, Target, CheckCircle2, TrendingUp, Calendar, Plus } from "lucide-react";
import Link from "next/link";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const data = [
  { name: "Mon", score: 65 },
  { name: "Tue", score: 70 },
  { name: "Wed", score: 68 },
  { name: "Thu", score: 78 },
  { name: "Fri", score: 85 },
  { name: "Sat", score: 82 },
  { name: "Sun", score: 92 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back, Alex!</h2>
          <p className="text-muted-foreground mt-1">Here's a summary of your interview preparation.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/resume-analysis" className={buttonVariants({})}><Plus className="mr-2 h-4 w-4" /> New Resume</Link>
          <Link href="/mock-interview" className={buttonVariants({ variant: "secondary" })}><Target className="mr-2 h-4 w-4" /> Mock Interview</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-card to-card/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resume Score</CardTitle>
            <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <FileText className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">85/100</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500 font-medium">+15 points</span> from last week
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-card to-card/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mock Interviews</CardTitle>
            <div className="h-8 w-8 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
              <Target className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">12</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500 font-medium">3 completed</span> this week
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-card to-card/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Performance</CardTitle>
            <div className="h-8 w-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">78%</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <span className="text-muted-foreground">Strong in technical questions</span>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-card to-card/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Next Interview</CardTitle>
            <div className="h-8 w-8 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold mt-1">Tomorrow</div>
            <p className="text-xs text-muted-foreground mt-1 text-purple-600 font-medium">
              Google - Frontend Engineer
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-1 md:col-span-4 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>
              Your interview performance scores over the past week
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="col-span-1 md:col-span-3 shadow-sm border-border/50 flex flex-col">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Your latest practice sessions and analyses
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-6">
              {[
                { title: "Frontend Mock Interview", role: "React Developer", time: "2 hours ago", score: "82%", icon: Target, color: "text-blue-500", bg: "bg-blue-500/10" },
                { title: "Resume Upload", role: "Software Engineer V2", time: "Yesterday", score: "85/100", icon: FileText, color: "text-primary", bg: "bg-primary/10" },
                { title: "Behavioral Mock Interview", role: "General", time: "2 days ago", score: "74%", icon: Target, color: "text-blue-500", bg: "bg-blue-500/10" },
                { title: "Resume Upload", role: "Software Engineer V1", time: "Last week", score: "70/100", icon: FileText, color: "text-primary", bg: "bg-primary/10" },
              ].map((item, i) => (
                <div key={i} className="flex items-center group">
                  <div className={`h-10 w-10 rounded-full ${item.bg} flex items-center justify-center ${item.color} mr-4 transition-transform group-hover:scale-110`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.role} • {item.time}</p>
                  </div>
                  <div className="font-semibold text-sm">
                    {item.score}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t">
              <Button variant="outline" className="w-full text-xs text-muted-foreground">View All Activity</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
