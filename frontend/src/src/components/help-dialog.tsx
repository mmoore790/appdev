import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Video,
  BookOpen,
  Clock,
  Mail,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const handleBookDemo = () => {
    const subject = encodeURIComponent("Request for System Demonstration");
    const body = encodeURIComponent(
      `Hello,\n\nI would like to book a 20-30 minute live demonstration of the workshop operations system.\n\nPlease let me know your availability.\n\nThank you!`
    );
    window.location.href = `mailto:support@example.com?subject=${subject}&body=${body}`;
  };

  const features = [
    {
      icon: <Wrench className="h-5 w-5" />,
      title: "Workshop Operations",
      description:
        "Create and track workshop jobs with sequential job IDs. Manage equipment, update job statuses, and track work completion.",
      link: "/workshop",
    },
    {
      icon: <CheckSquare className="h-5 w-5" />,
      title: "Task Board",
      description:
        "Create tasks, assign them to staff members, set priorities, and track completion. Organize your workflow efficiently.",
      link: "/tasks",
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: "Customer Management",
      description:
        "Maintain customer records, track equipment history, and manage customer interactions all in one place.",
      link: "/customers",
    },
    {
      icon: <DollarSign className="h-5 w-5" />,
      title: "Payment Processing",
      description:
        "Send payment requests to customers via email. Accept payments through Stripe with automatic job status updates.",
      link: "/workshop",
    },
    {
      icon: <MessageSquare className="h-5 w-5" />,
      title: "Internal Messaging",
      description:
        "Communicate with your team members through the built-in messaging system. Share updates and coordinate work.",
      link: "/messages",
    },
    {
      icon: <PhoneCall className="h-5 w-5" />,
      title: "Callback Management",
      description:
        "Track customer callback requests, assign them to staff, and manage follow-up communications.",
      link: "/callbacks",
    },
    {
      icon: <Calendar className="h-5 w-5" />,
      title: "Calendar & Time Tracking",
      description:
        "Schedule work, track time entries, and manage your team's calendar efficiently.",
      link: "/calendar",
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: "Analytics & Reporting",
      description:
        "View analytics, generate reports, and track key performance metrics. (Admin only)",
      link: "/analytics",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Help & System Guide</DialogTitle>
          <DialogDescription>
            Learn about the system features and how to use them
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* System Overview */}
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                What This System Does
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-slate-700 text-sm leading-relaxed">
                This workshop operations system is designed to streamline your entire
                operation. From job creation and tracking to customer management and
                payment processing, everything you need is right at your fingertips.
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
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="h-5 w-5 text-blue-600" />
                Need a Live Demonstration?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 text-sm mb-3">
                Book a 20-30 minute live demonstration to learn how to use all the
                features effectively.
              </p>
              <Button onClick={handleBookDemo} size="sm" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Book a Live Demonstration
              </Button>
            </CardContent>
          </Card>

          {/* Features Walkthrough */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">System Features</CardTitle>
              <CardDescription>Explore what's available in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {features.map((feature, index) => (
                  <Card
                    key={index}
                    className="hover:shadow-md transition-shadow border-slate-200"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
                          {feature.icon}
                        </div>
                        <CardTitle className="text-base">{feature.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-slate-600 text-xs mb-3">{feature.description}</p>
                      <Link href={feature.link} onClick={() => onOpenChange(false)}>
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          Go to {feature.title.split(" ")[0]}
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Start Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-600" />
                Quick Start Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-semibold text-sm">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm mb-1">
                      Create Your First Customer
                    </h4>
                    <p className="text-slate-600 text-xs">
                      Go to Customers page and add your first customer with contact
                      information.
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-semibold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm mb-1">
                      Create a Workshop Job
                    </h4>
                    <p className="text-slate-600 text-xs">
                      Use the job wizard to create a new job, link it to a customer, add
                      equipment details, and assign it.
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-semibold text-sm">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm mb-1">
                      Track Progress & Process Payments
                    </h4>
                    <p className="text-slate-600 text-xs">
                      Update job statuses, record work completed, and send payment
                      requests to customers.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

