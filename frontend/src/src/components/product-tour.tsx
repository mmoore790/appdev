import { useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Wrench,
  CheckSquare,
  Users,
  MessageSquare,
  PhoneCall,
  Calendar,
  Package,
  Sparkles,
  ArrowRight,
  ChevronRight,
  X,
} from "lucide-react";

interface ProductTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  userRole?: string | null;
}

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: JSX.Element;
  link: string;
  color: string;
}

// Color mapping for Tailwind classes
const colorClasses = {
  emerald: {
    bg: "bg-emerald-100",
    text: "text-emerald-600",
    button: "bg-emerald-600 hover:bg-emerald-700",
  },
  blue: {
    bg: "bg-blue-100",
    text: "text-blue-600",
    button: "bg-blue-600 hover:bg-blue-700",
  },
  amber: {
    bg: "bg-amber-100",
    text: "text-amber-600",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  purple: {
    bg: "bg-purple-100",
    text: "text-purple-600",
    button: "bg-purple-600 hover:bg-purple-700",
  },
  indigo: {
    bg: "bg-indigo-100",
    text: "text-indigo-600",
    button: "bg-indigo-600 hover:bg-indigo-700",
  },
  orange: {
    bg: "bg-orange-100",
    text: "text-orange-600",
    button: "bg-orange-600 hover:bg-orange-700",
  },
  teal: {
    bg: "bg-teal-100",
    text: "text-teal-600",
    button: "bg-teal-600 hover:bg-teal-700",
  },
  pink: {
    bg: "bg-pink-100",
    text: "text-pink-600",
    button: "bg-pink-600 hover:bg-pink-700",
  },
} as const;

interface TourStepWithColors extends TourStep {
  colorKey: keyof typeof colorClasses;
}

const tourSteps: TourStepWithColors[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Your command center - see active jobs, tasks, and what needs attention",
    icon: <Sparkles className="h-4 w-4" />,
    link: "/dashboard",
    color: "emerald",
    colorKey: "emerald",
  },
  {
    id: "workshop",
    title: "Workshop",
    description: "Create jobs, track repairs, and manage equipment work",
    icon: <Wrench className="h-4 w-4" />,
    link: "/workshop",
    color: "blue",
    colorKey: "blue",
  },
  {
    id: "tasks",
    title: "Task Board",
    description: "Assign tasks, set priorities, and track completion",
    icon: <CheckSquare className="h-4 w-4" />,
    link: "/tasks",
    color: "amber",
    colorKey: "amber",
  },
  {
    id: "customers",
    title: "Customers",
    description: "Manage customer records and equipment history",
    icon: <Users className="h-4 w-4" />,
    link: "/customers",
    color: "purple",
    colorKey: "purple",
  },
  {
    id: "messages",
    title: "Messages",
    description: "Internal team communication and coordination",
    icon: <MessageSquare className="h-4 w-4" />,
    link: "/messages",
    color: "indigo",
    colorKey: "indigo",
  },
  {
    id: "callbacks",
    title: "Callbacks",
    description: "Track customer callback requests and follow-ups",
    icon: <PhoneCall className="h-4 w-4" />,
    link: "/callbacks",
    color: "orange",
    colorKey: "orange",
  },
  {
    id: "calendar",
    title: "Calendar",
    description: "Schedule work and track time entries",
    icon: <Calendar className="h-4 w-4" />,
    link: "/calendar",
    color: "pink",
    colorKey: "pink",
  },
];

export function ProductTour({ open, onOpenChange, userName, userRole }: ProductTourProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  
  const selectedStep = selectedStepId 
    ? tourSteps.find(s => s.id === selectedStepId) 
    : null;

  const handleStepClick = (stepId: string) => {
    setSelectedStepId(stepId);
  };

  const handleNavigate = (link: string) => {
    onOpenChange(false);
    setTimeout(() => navigate(link), 100);
  };

  const handleClose = () => {
    setSelectedStepId(null);
    onOpenChange(false);
  };

  const displayName = userName?.split(' ')[0] || "there";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Welcome, {displayName}!
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                Click any area below to learn more, or explore on your own
              </DialogDescription>
            </div>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="p-6">
          {selectedStep ? (
            // Detailed view for selected step
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
                  colorClasses[selectedStep.colorKey].bg,
                  colorClasses[selectedStep.colorKey].text
                )}>
                  {selectedStep.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-900 mb-1">
                    {selectedStep.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {selectedStep.description}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => handleNavigate(selectedStep.link)}
                  className={cn("text-white", colorClasses[selectedStep.colorKey].button)}
                >
                  Go to {selectedStep.title}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStepId(null)}
                >
                  Back to overview
                </Button>
              </div>
            </div>
          ) : (
            // Grid overview of all steps
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {tourSteps.map((step) => {
                  const stepColors = colorClasses[step.colorKey];
                  return (
                    <button
                      key={step.id}
                      onClick={() => handleStepClick(step.id)}
                      className={cn(
                        "group relative p-3 rounded-lg border-2 transition-all text-left",
                        "hover:border-emerald-300 hover:shadow-sm",
                        "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1",
                        selectedStepId === step.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 bg-white"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md shrink-0 transition-colors",
                          stepColors.bg,
                          stepColors.text,
                          "group-hover:bg-emerald-100 group-hover:text-emerald-600"
                        )}>
                          {step.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 mb-0.5">
                            {step.title}
                          </h4>
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {step.description}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 shrink-0 mt-0.5 transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Click any card above to learn more</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-7 text-xs"
                >
                  Skip tour
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


