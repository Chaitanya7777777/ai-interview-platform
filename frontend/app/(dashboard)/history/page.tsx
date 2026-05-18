"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, ChevronRight, FileText, Target, PlayCircle } from "lucide-react";

const historyData = [
  { id: 1, type: "interview", title: "Senior Frontend Engineer", date: "Oct 24, 2024", duration: "45 min", score: 85, status: "completed" },
  { id: 2, type: "resume", title: "alex_resume_v2.pdf", date: "Oct 22, 2024", score: 92, target: "Frontend Engineer", status: "completed" },
  { id: 3, type: "interview", title: "Behavioral Only", date: "Oct 20, 2024", duration: "30 min", score: 78, status: "completed" },
  { id: 4, type: "resume", title: "alex_resume_old.pdf", date: "Oct 15, 2024", score: 65, target: "General", status: "completed" },
  { id: 5, type: "interview", title: "Full Stack Developer", date: "Oct 10, 2024", duration: "60 min", score: 72, status: "completed" },
];

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">History</h2>
          <p className="text-muted-foreground mt-1">Review your past interviews and resume analyses.</p>
        </div>
      </div>

      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search history..." className="pl-8" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filter</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 text-sm font-medium text-muted-foreground">
              <div className="col-span-6 md:col-span-5">Activity</div>
              <div className="hidden md:block col-span-3">Date</div>
              <div className="col-span-3 md:col-span-2">Score</div>
              <div className="col-span-3 md:col-span-2 text-right">Action</div>
            </div>
            <div className="divide-y">
              {historyData.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors group">
                  <div className="col-span-6 md:col-span-5 flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      item.type === 'interview' ? 'bg-blue-500/10 text-blue-500' : 'bg-primary/10 text-primary'
                    }`}>
                      {item.type === 'interview' ? <Target className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {item.type === 'interview' ? 'Mock Interview' : 'Resume Analysis'}
                        </Badge>
                        {item.type === 'interview' ? item.duration : `Target: ${item.target}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="hidden md:flex col-span-3 items-center text-sm text-muted-foreground">
                    {item.date}
                  </div>
                  
                  <div className="col-span-3 md:col-span-2 flex items-center">
                    <Badge variant={item.score >= 80 ? "default" : item.score >= 70 ? "secondary" : "outline"} 
                           className={item.score >= 80 ? "bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20" : ""}>
                      {item.score} {item.type === 'resume' ? '/ 100' : '%'}
                    </Badge>
                  </div>
                  
                  <div className="col-span-3 md:col-span-2 flex justify-end">
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      View Report <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
