import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Zap, Target, Award } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-24 md:py-32 lg:py-48 flex justify-center items-center overflow-hidden relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"></div>
        <div className="container px-4 md:px-6 flex flex-col items-center text-center space-y-8">
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20 mb-4">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
            InterviewAI 2.0 is now live
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter max-w-4xl">
            Land your dream job with <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">AI-powered</span> prep
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-[700px]">
            Upload your resume, get instant actionable feedback, and practice with our realistic AI interviewer tailored to your specific role.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-8">
            <Link href="/login" className={buttonVariants({ size: "lg", className: "rounded-full px-8 h-14 text-base shadow-lg shadow-primary/25 group" })}>
              Start for free
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="#how-it-works" className={buttonVariants({ size: "lg", variant: "outline", className: "rounded-full px-8 h-14 text-base" })}>
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section id="features" className="w-full py-20 bg-muted/30 flex justify-center border-y border-border/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">Everything you need to succeed</h2>
            <p className="max-w-[700px] text-muted-foreground md:text-lg">
              Our comprehensive suite of tools ensures you're prepared for every stage of the hiring process.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: Zap,
                title: "Instant Resume Analysis",
                description: "Get immediate feedback on your resume's impact, formatting, and keyword optimization."
              },
              {
                icon: Target,
                title: "Targeted Mock Interviews",
                description: "Practice answering behavioral and technical questions customized to the job description."
              },
              {
                icon: Award,
                title: "Detailed Performance Reports",
                description: "Review your interview performance with actionable insights and improved answer suggestions."
              }
            ].map((feature, i) => (
              <div key={i} className="flex flex-col items-center text-center p-6 bg-card rounded-2xl shadow-sm border border-border/50 hover:shadow-md transition-shadow">
                <div className="p-3 bg-primary/10 rounded-xl mb-4 text-primary">
                  <feature.icon size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="w-full py-20 flex justify-center">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center max-w-4xl mx-auto">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">50k+</div>
              <div className="text-sm font-medium text-muted-foreground">Resumes Analyzed</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">10k+</div>
              <div className="text-sm font-medium text-muted-foreground">Mock Interviews</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">85%</div>
              <div className="text-sm font-medium text-muted-foreground">Offer Rate</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">4.9/5</div>
              <div className="text-sm font-medium text-muted-foreground">User Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-24 bg-primary text-primary-foreground flex justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff1a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff1a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        <div className="container px-4 md:px-6 text-center z-10">
          <h2 className="text-3xl font-bold tracking-tighter md:text-5xl mb-6">Ready to ace your next interview?</h2>
          <p className="max-w-[600px] mx-auto text-primary-foreground/80 md:text-xl mb-10">
            Join thousands of professionals who have successfully landed their dream jobs using InterviewAI.
          </p>
          <Link href="/login" className={buttonVariants({ size: "lg", variant: "secondary", className: "rounded-full px-8 h-14 text-base text-primary font-semibold" })}>
            Create your free account
          </Link>
        </div>
      </section>
    </div>
  );
}
