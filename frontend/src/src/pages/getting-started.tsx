import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wrench,
  CheckSquare,
  Users,
  DollarSign,
  MessageSquare,
  PhoneCall,
  BarChart3,
  Calendar,
  Package,
  X,
  Video,
  BookOpen,
  ArrowRight,
  Clock,
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function GettingStarted() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dismissMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(resolveApiUrl("/api/auth/dismiss-getting-started"), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to dismiss getting started");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Getting Started dismissed",
        description: "You can always access help from the profile menu.",
      });
      // Navigate to dashboard after dismissing
      window.location.href = "/dashboard";
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to dismiss getting started page.",
        variant: "destructive",
      });
    },
  });

  const handleDismiss = () => {
    dismissMutation.mutate();
  };

  const handleBookDemo = () => {
    // Open email client to book a demo
    const subject = encodeURIComponent("Request for System Demonstration");
    const body = encodeURIComponent(
      `Hello,\n\nI would like to book a 20-30 minute live demonstration of the workshop operations system.\n\nPlease let me know your availability.\n\nThank you!`
    );
    window.location.href = `mailto:support@example.com?subject=${subject}&body=${body}`;
  };

  const features = [
    {
      icon: <Wrench className="h-6 w-6" />,
      title: "Workshop Operations",
      description:
        "Create and track workshop jobs with sequential job IDs. Manage equipment, update job statuses, and track work completion.",
      link: "/workshop",
    },
    {
      icon: <CheckSquare className="h-6 w-6" />,
      title: "Task Board",
      description:
        "Create tasks, assign them to staff members, set priorities, and track completion. Organize your workflow efficiently.",
      link: "/tasks",
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Customer Management",
      description:
        "Maintain customer records, track equipment history, and manage customer interactions all in one place.",
      link: "/customers",
    },
    {
      icon: <DollarSign className="h-6 w-6" />,
      title: "Payment Processing",
      description:
        "Send payment requests to customers via email. Accept payments through Stripe with automatic job status updates.",
      link: "/workshop",
    },
    {
      icon: <MessageSquare className="h-6 w-6" />,
      title: "Internal Messaging",
      description:
        "Communicate with your team members through the built-in messaging system. Share updates and coordinate work.",
      link: "/messages",
    },
    {
      icon: <PhoneCall className="h-6 w-6" />,
      title: "Callback Management",
      description:
        "Track customer callback requests, assign them to staff, and manage follow-up communications.",
      link: "/callbacks",
    },
    {
      icon: <Calendar className="h-6 w-6" />,
      title: "Calendar & Time Tracking",
      description:
        "Schedule work, track time entries, and manage your team's calendar efficiently.",
      link: "/calendar",
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Analytics & Reporting",
      description:
        "View analytics, generate reports, and track key performance metrics. (Admin only)",
      link: "/analytics",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      {/* Header with Dismiss Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome to Your Workshop Operations System
          </h1>
          <p className="text-slate-600 mt-2">
            Get started with your comprehensive workshop operations solution
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleDismiss}
          disabled={dismissMutation.isPending}
          className="flex items-center gap-2"
        >
          <X className="h-4 w-4" />
          Hide Getting Started
        </Button>
      </div>

      {/* System Overview */}
      <Card className="mb-6 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-emerald-600" />
            What This System Does
          </CardTitle>
          <CardDescription className="text-base">
            Your all-in-one solution for workshop operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-700 leading-relaxed">
            This workshop operations system is designed to streamline your entire
            operation. From job creation and tracking to customer management and
            payment processing, everything you need is right at your fingertips.
          </p>
          <p className="text-slate-700 leading-relaxed">
            The system helps you manage workshop jobs efficiently, track equipment
            service history, coordinate tasks among staff members, process customer
            payments, and maintain clear communication with both your team and
            customers.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary">Job Tracking</Badge>
            <Badge variant="secondary">Equipment Management</Badge>
            <Badge variant="secondary">Customer Portal</Badge>
            <Badge variant="secondary">Payment Processing</Badge>
            <Badge variant="secondary">Task Management</Badge>
            <Badge variant="secondary">Analytics & Reports</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Book Demo Section */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Video className="h-5 w-5 text-blue-600" />
            Need Help Getting Started?
          </CardTitle>
          <CardDescription>
            Book a personalized demonstration to learn how to use the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-slate-700 mb-4">
            We offer 20-30 minute live demonstrations to help you get familiar
            with all the features and learn how to make the most of the system.
          </p>
          <Button onClick={handleBookDemo} className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Book a Live Demonstration
          </Button>
        </CardContent>
      </Card>

      {/* Features Walkthrough */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">System Features & How to Use Them</CardTitle>
          <CardDescription>
            Explore what's available and learn how to get started with each feature
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="hover:shadow-md transition-shadow border-slate-200"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                        {feature.icon}
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 text-sm mb-4">{feature.description}</p>
                  <Link href={feature.link}>
                    <Button variant="outline" size="sm" className="w-full">
                      Go to {feature.title.split(" ")[0]}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Start Guide */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Clock className="h-6 w-6 text-emerald-600" />
            Quick Start Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-semibold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">
                  Create Your First Customer
                </h4>
                <p className="text-slate-600 text-sm">
                  Go to the{" "}
                  <Link href="/customers" className="text-emerald-600 hover:underline">
                    Customers
                  </Link>{" "}
                  page and add your first customer with their contact information and
                  any notes.
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-semibold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">
                  Create a Workshop Job
                </h4>
                <p className="text-slate-600 text-sm">
                  Navigate to{" "}
                  <Link href="/workshop" className="text-emerald-600 hover:underline">
                    Workshop
                  </Link>{" "}
                  and use the job wizard to create a new job. Link it to a customer,
                  add equipment details, and assign it to a staff member.
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-semibold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">
                  Track Job Progress
                </h4>
                <p className="text-slate-600 text-sm">
                  Update job statuses as work progresses, add job updates, record work
                  completed, and track time spent on each job.
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-semibold">
                4
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">
                  Manage Tasks & Communication
                </h4>
                <p className="text-slate-600 text-sm">
                  Use the{" "}
                  <Link href="/tasks" className="text-emerald-600 hover:underline">
                    Task Board
                  </Link>{" "}
                  to assign tasks and the{" "}
                  <Link href="/messages" className="text-emerald-600 hover:underline">
                    Messages
                  </Link>{" "}
                  feature to communicate with your team.
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-semibold">
                5
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">
                  Process Payments
                </h4>
                <p className="text-slate-600 text-sm">
                  Once a job is complete, you can send payment requests to customers.
                  They can pay online through Stripe, and payments are automatically
                  recorded.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-xl">Need More Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-700 mb-4">
            You can always access help and documentation from the Help option in your
            profile dropdown menu. This getting started page will be hidden after you
            dismiss it, but help is always available when you need it.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleBookDemo}>
              <Mail className="h-4 w-4 mr-2" />
              Book a Demo
            </Button>
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

