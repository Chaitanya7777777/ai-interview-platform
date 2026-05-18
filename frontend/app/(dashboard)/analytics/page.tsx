"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";

const radarData = [
  { subject: "System Design", A: 85, fullMark: 100 },
  { subject: "Algorithms", A: 90, fullMark: 100 },
  { subject: "Communication", A: 75, fullMark: 100 },
  { subject: "Leadership", A: 70, fullMark: 100 },
  { subject: "Problem Solving", A: 88, fullMark: 100 },
  { subject: "Culture Fit", A: 85, fullMark: 100 },
];

const barData = [
  { name: "Week 1", "Technical": 65, "Behavioral": 70 },
  { name: "Week 2", "Technical": 70, "Behavioral": 75 },
  { name: "Week 3", "Technical": 75, "Behavioral": 80 },
  { name: "Week 4", "Technical": 85, "Behavioral": 82 },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Performance Analytics</h2>
        <p className="text-muted-foreground mt-1">Deep dive into your interview skills and track your progress over time.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Skill Breakdown</CardTitle>
            <CardDescription>Your current proficiency across different interview areas based on AI analysis.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Radar name="Your Score" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                  itemStyle={{ color: "hsl(var(--primary))" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Improvement Timeline</CardTitle>
            <CardDescription>How your scores have trended across recent weeks.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} dy={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip 
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />
                <Bar dataKey="Technical" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Behavioral" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Actionable Recommendations</CardTitle>
            <CardDescription>AI-generated focus areas for your next practice sessions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { title: "Improve STAR Method Usage", desc: "You missed the 'Result' in 3 of your behavioral answers. Focus on quantifying your impact.", priority: "High" },
              { title: "System Design Depth", desc: "Your high-level architectures are solid, but you often skip over database schema design.", priority: "Medium" },
              { title: "Pacing", desc: "You tend to speak very quickly when explaining algorithms. Slow down to ensure clarity.", priority: "Low" }
            ].map((rec, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/30 rounded-xl border">
                <div>
                  <h4 className="font-semibold">{rec.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{rec.desc}</p>
                </div>
                <Badge 
                  variant={rec.priority === "High" ? "destructive" : rec.priority === "Medium" ? "default" : "secondary"} 
                  className="mt-3 sm:mt-0 w-fit"
                >
                  {rec.priority} Priority
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 bg-primary/5">
          <CardHeader>
            <CardTitle>Industry Benchmark</CardTitle>
            <CardDescription>How you compare to successful candidates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-between items-end border-b border-primary/10 pb-4">
              <div>
                <p className="text-sm text-muted-foreground">Your Percentile</p>
                <p className="text-4xl font-bold text-primary">Top 15%</p>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">+5% this week</Badge>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Readiness by Role</p>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Frontend Engineer</span>
                    <span className="font-medium text-green-600">Ready</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-[90%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Full Stack Engineer</span>
                    <span className="font-medium text-amber-600">Almost There</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 w-[70%]" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
