"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Send, Video, Settings2, PlayCircle, Clock, CheckCircle2, User, Bot, StopCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
};

export default function MockInterviewPage() {
  const [isSetup, setIsSetup] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "ai",
      content: "Hello! I'm your AI interviewer. I've reviewed your resume and the job description for the Senior Frontend Engineer role. Are you ready to begin the interview?",
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const startInterview = () => {
    setIsSetup(false);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    
    // Simulate AI thinking and response
    setTimeout(() => {
      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: "ai", 
        content: "That's a great answer. Can you elaborate on how you handled state management in that particular project? Did you face any performance bottlenecks?" 
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 1500);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="h-[calc(100vh-10rem)] max-h-[800px] flex flex-col">
      <div className="mb-6 flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mock Interview</h2>
          <p className="text-muted-foreground mt-1">Practice with realistic AI-generated questions tailored to your target role.</p>
        </div>
        {!isSetup && (
          <Button variant="outline" size="sm" onClick={() => setIsSetup(true)}>
            End Interview
          </Button>
        )}
      </div>

      {isSetup ? (
        <div className="grid md:grid-cols-2 gap-8 flex-1 overflow-auto pb-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Interview Setup</CardTitle>
              <CardDescription>Configure your interview parameters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Target Role</Label>
                <Input placeholder="e.g. Senior Frontend Engineer" defaultValue="Senior Frontend Engineer" />
              </div>
              
              <div className="space-y-2">
                <Label>Interview Type</Label>
                <Select defaultValue="mixed">
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="behavioral">Behavioral (Leadership, Culture Fit)</SelectItem>
                    <SelectItem value="technical">Technical (System Design, Coding)</SelectItem>
                    <SelectItem value="mixed">Mixed (Standard Interview)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Job Description (Optional)</Label>
                <Textarea 
                  placeholder="Paste the job description here to get highly tailored questions..." 
                  className="min-h-[150px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>Select Resume</Label>
                <Select defaultValue="resume1">
                  <SelectTrigger>
                    <SelectValue placeholder="Select a resume" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resume1">alex_resume_2024.pdf (Updated today)</SelectItem>
                    <SelectItem value="resume2">alex_resume_old.pdf (Updated 1 month ago)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full h-12 text-base" onClick={startInterview}>
                <PlayCircle className="mr-2 h-5 w-5" /> Start Mock Interview
              </Button>
            </CardFooter>
          </Card>

          <div className="space-y-6">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" /> Audio & Video Check
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="aspect-video bg-muted/50 rounded-lg border border-border flex items-center justify-center relative overflow-hidden">
                  <Video className="h-12 w-12 text-muted-foreground/50" />
                  <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur text-xs px-2 py-1 rounded font-medium">Camera off</div>
                </div>
                <div className="flex justify-between items-center bg-background rounded-lg p-3 border">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Mic className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Microphone</p>
                      <p className="text-xs text-muted-foreground">Default - MacBook Pro Microphone</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Change</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Interview Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span>Use the <strong>STAR method</strong> (Situation, Task, Action, Result) for behavioral questions.</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span>Speak clearly and at a moderate pace. The AI analyzes your communication skills.</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span>It's okay to ask for a moment to think before answering complex questions.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="flex flex-col flex-1 overflow-hidden shadow-md border-primary/20">
          <div className="h-12 border-b bg-muted/30 flex items-center px-4 justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium">Recording</span>
              <span className="text-xs text-muted-foreground ml-2 font-mono">12:04</span>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              Technical Interview
            </Badge>
          </div>
          
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <Avatar className="h-8 w-8 mt-1 border">
                  {msg.role === "ai" ? (
                    <>
                      <AvatarFallback className="bg-primary/10 text-primary"><Bot size={16} /></AvatarFallback>
                    </>
                  ) : (
                    <>
                      <AvatarImage src="https://github.com/shadcn.png" />
                      <AvatarFallback><User size={16} /></AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground rounded-tr-sm" 
                    : "bg-muted rounded-tl-sm"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </CardContent>
          
          <div className="p-4 bg-card border-t shrink-0">
            <div className="flex items-center gap-2 max-w-4xl mx-auto">
              <Button 
                variant={isRecording ? "destructive" : "secondary"} 
                size="icon" 
                className="h-12 w-12 rounded-full shrink-0"
                onClick={() => setIsRecording(!isRecording)}
              >
                {isRecording ? <StopCircle /> : <Mic />}
              </Button>
              <div className="flex-1 relative">
                <Input 
                  placeholder="Type your answer here..." 
                  className="h-12 pr-12 rounded-full bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                />
                <Button 
                  size="icon" 
                  className="absolute right-1 top-1 h-10 w-10 rounded-full"
                  disabled={!inputValue.trim()}
                  onClick={handleSendMessage}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {isRecording && (
              <p className="text-center text-xs text-muted-foreground mt-2 animate-pulse text-primary">
                Listening... Speak your answer now.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
