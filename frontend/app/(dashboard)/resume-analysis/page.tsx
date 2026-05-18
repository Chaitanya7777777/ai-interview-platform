"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, File, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function ResumeAnalysisPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setIsAnalyzed(true);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Resume Intelligence</h2>
        <p className="text-muted-foreground mt-1">Upload your resume and get AI-powered feedback tailored to your target job.</p>
      </div>

      {!isAnalyzed ? (
        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="shadow-sm border-border/50">
            <CardHeader>
              <CardTitle>Upload Resume</CardTitle>
              <CardDescription>We support PDF, DOCX, and TXT files up to 5MB.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-primary/20 rounded-xl p-12 flex flex-col items-center justify-center bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer group">
                <div className="h-16 w-16 bg-background rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Click to upload or drag and drop</h3>
                <p className="text-sm text-muted-foreground text-center">
                  PDF, DOCX, or TXT (max. 5MB)
                </p>
              </div>
              
              {isUploading && (
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center text-primary font-medium">
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing resume...
                    </span>
                    <span className="text-muted-foreground">75%</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button className="w-full h-12" onClick={handleUpload} disabled={isUploading}>
                {isUploading ? "Processing..." : "Analyze Resume"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardHeader>
              <CardTitle>Target Job Description</CardTitle>
              <CardDescription>Optional: Paste a job description for tailored feedback.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Target Role</Label>
                  <input 
                    id="role" 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                    placeholder="e.g. Senior Frontend Engineer" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jd">Job Description</Label>
                  <Textarea 
                    id="jd" 
                    placeholder="Paste the requirements and responsibilities here..." 
                    className="min-h-[200px] resize-none" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col md:flex-row justify-between gap-4 items-start">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-card border rounded-xl flex items-center justify-center shadow-sm">
                <File className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold">alex_resume_2024.pdf</h3>
                <p className="text-muted-foreground flex items-center gap-2">
                  Analyzed just now <Badge variant="secondary">Target: Frontend Engineer</Badge>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsAnalyzed(false)}>
                <UploadCloud className="mr-2 h-4 w-4" /> Upload New
              </Button>
              <Button>Download Enhanced PDF</Button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-primary/20 shadow-md bg-gradient-to-b from-card to-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Overall ATS Score</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center pt-4">
                <div className="relative h-40 w-40 flex items-center justify-center mb-4">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                    <circle cx="50" cy="50" r="45" fill="transparent" stroke="currentColor" strokeWidth="8" strokeDasharray="283" strokeDashoffset="42.45" className="text-primary" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold">85</span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                </div>
                <div className="w-full space-y-4 mt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Impact & Action</span>
                      <span className="font-medium">92%</span>
                    </div>
                    <Progress value={92} className="h-1.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Keywords Match</span>
                      <span className="font-medium">78%</span>
                    </div>
                    <Progress value={78} className="h-1.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Formatting</span>
                      <span className="font-medium">100%</span>
                    </div>
                    <Progress value={100} className="h-1.5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 shadow-sm">
              <CardHeader className="pb-0">
                <Tabs defaultValue="insights" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="insights">Key Insights</TabsTrigger>
                    <TabsTrigger value="experience">Experience</TabsTrigger>
                    <TabsTrigger value="keywords">Keywords</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="insights" className="mt-0">
                    <div className="space-y-4">
                      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-green-700 dark:text-green-400">Strong Action Verbs</h4>
                          <p className="text-sm text-green-600 dark:text-green-500/80 mt-1">You've effectively used action verbs like "Architected", "Spearheaded", and "Optimized" to start your bullet points.</p>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-amber-700 dark:text-amber-400">Missing Metrics in Recent Role</h4>
                          <p className="text-sm text-amber-600 dark:text-amber-500/80 mt-1">Your most recent role at TechCorp lacks quantifiable metrics. Try adding numbers to demonstrate impact (e.g., "improved performance by X%").</p>
                        </div>
                      </div>

                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3">
                        <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-red-700 dark:text-red-400">Missing Core Keyword: "GraphQL"</h4>
                          <p className="text-sm text-red-600 dark:text-red-500/80 mt-1">The job description mentions GraphQL 4 times, but it is entirely missing from your resume. Consider adding it if you have experience.</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="experience" className="mt-0">
                    <div className="p-4 border rounded-xl space-y-4">
                      <div className="flex justify-between items-start border-b pb-4">
                        <div>
                          <h4 className="font-semibold">Senior Frontend Developer</h4>
                          <p className="text-sm text-muted-foreground">TechCorp • 2021 - Present</p>
                        </div>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">Needs Improvement</Badge>
                      </div>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          <p className="text-sm">Developed new features for the main web application using React and Redux.</p>
                        </div>
                        <div className="ml-6 p-3 bg-primary/5 border border-primary/10 rounded-lg text-sm text-muted-foreground">
                          <span className="font-medium text-primary">Suggestion:</span> "Architected and delivered 15+ complex features for the flagship web application using React and Redux, resulting in a 20% increase in user engagement."
                        </div>
                        <div className="flex gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          <p className="text-sm">Optimized initial load time by implementing code splitting and lazy loading, reducing bundle size by 40%.</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="keywords" className="mt-0">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex justify-between">
                          <span>Matched Keywords (Found)</span>
                          <span className="text-muted-foreground font-normal">78% Match</span>
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {["React", "TypeScript", "Next.js", "Redux", "Tailwind CSS", "Jest", "Git", "Agile", "CI/CD"].map((kw) => (
                            <Badge key={kw} variant="secondary" className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="pt-4 border-t">
                        <h4 className="text-sm font-semibold mb-3 flex justify-between text-red-600">
                          <span>Missing Keywords (Required)</span>
                          <span className="text-muted-foreground font-normal">Add these</span>
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {["GraphQL", "Node.js", "AWS", "Microservices", "Docker"].map((kw) => (
                            <Badge key={kw} variant="outline" className="bg-red-500/5 text-red-600 border-red-500/20">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardHeader>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
