import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Circle, 
  X, 
  Users, 
  Wrench, 
  Package, 
  CheckSquare,
  Printer,
  Eye
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  link?: string;
  action?: () => void;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "add_customer",
    label: "Add your first customer",
    description: "Create a customer profile with contact information",
    icon: <Users className="h-4 w-4" />,
    link: "/customers",
  },
  {
    id: "create_job",
    label: "Create your first job",
    description: "Set up a job with equipment and work details",
    icon: <Wrench className="h-4 w-4" />,
    link: "/workshop",
  },
  {
    id: "add_labour",
    label: "Add labour or parts to a job",
    description: "Record work completed and parts used",
    icon: <Package className="h-4 w-4" />,
    link: "/workshop",
  },
  {
    id: "mark_ready",
    label: "Mark a job ready for pickup",
    description: "Update job status when work is complete",
    icon: <CheckSquare className="h-4 w-4" />,
    link: "/workshop",
  },
  {
    id: "view_job_sheet",
    label: "Print or view a job sheet",
    description: "See how job sheets look for customers",
    icon: <Printer className="h-4 w-4" />,
    link: "/workshop",
  },
];

interface OnboardingChecklistProps {
  onDismiss?: () => void;
}

export function OnboardingChecklist({ onDismiss }: OnboardingChecklistProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDismissed, setIsDismissed] = useState(false);

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const { data: customers } = useQuery<any[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers?page=1&limit=1", {
        credentials: "include",
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.data || [];
    },
  });

  const { data: jobs } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async (updates: Record<string, boolean>) => {
      return apiRequest("POST", "/api/auth/update-onboarding-checklist", { updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/complete-onboarding");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setIsDismissed(true);
      onDismiss?.();
      toast({
        title: "Onboarding complete!",
        description: "You can always access help from the menu.",
      });
    },
  });

  const checklist = (user?.onboardingChecklist as Record<string, boolean>) || {};
  const completedCount = Object.values(checklist).filter(Boolean).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Auto-check items based on actual data
  useEffect(() => {
    const updates: Record<string, boolean> = { ...checklist };

    // Check if customer exists
    if (customers && customers.length > 0 && !checklist.add_customer) {
      updates.add_customer = true;
    }

    // Check if job exists
    if (jobs && Array.isArray(jobs) && jobs.length > 0 && !checklist.create_job) {
      updates.create_job = true;
    }

    // Check if any job has labour/parts
    const hasLabourOrParts = jobs?.some((job: any) => {
      // This would need to check actual labour/parts data
      // For now, we'll just check if job exists and is in progress
      return job.status === "in_progress" || job.status === "ready_for_pickup";
    });
    if (hasLabourOrParts && !checklist.add_labour) {
      updates.add_labour = true;
    }

    // Check if any job is ready
    const hasReadyJob = jobs?.some((job: any) => job.status === "ready_for_pickup");
    if (hasReadyJob && !checklist.mark_ready) {
      updates.mark_ready = true;
    }

    // If there are updates, save them
    const hasUpdates = Object.keys(updates).some(
      (key) => updates[key] !== checklist[key]
    );
    if (hasUpdates) {
      updateChecklistMutation.mutate(updates);
    }
  }, [customers, jobs, checklist]);

  const handleToggle = (itemId: string, checked: boolean) => {
    updateChecklistMutation.mutate({ [itemId]: checked });
  };

  const handleDismiss = () => {
    if (completedCount === totalCount) {
      dismissMutation.mutate();
    } else {
      toast({
        title: "Complete all items first",
        description: "Finish the checklist to dismiss it.",
        variant: "destructive",
      });
    }
  };

  if (isDismissed || user?.onboardingCompletedAt) {
    return null;
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <span>Getting Started Checklist</span>
            {completedCount > 0 && (
              <span className="text-sm font-normal text-slate-600">
                ({completedCount}/{totalCount})
              </span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
            disabled={dismissMutation.isPending}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {CHECKLIST_ITEMS.map((item) => {
            const isCompleted = checklist[item.id] || false;
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                  isCompleted ? "bg-emerald-100/50" : "bg-white"
                }`}
              >
                <Checkbox
                  checked={isCompleted}
                  onCheckedChange={(checked) =>
                    handleToggle(item.id, checked as boolean)
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={`${isCompleted ? "text-emerald-600" : "text-slate-500"}`}>
                      {item.icon}
                    </div>
                    {item.link ? (
                      <Link
                        href={item.link}
                        className={`font-medium text-sm ${
                          isCompleted
                            ? "text-emerald-900 line-through"
                            : "text-slate-900 hover:text-emerald-600"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span
                        className={`font-medium text-sm ${
                          isCompleted
                            ? "text-emerald-900 line-through"
                            : "text-slate-900"
                        }`}
                      >
                        {item.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 ml-6">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {completedCount === totalCount && (
          <div className="mt-4 pt-4 border-t border-emerald-200">
            <Button
              onClick={handleDismiss}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={dismissMutation.isPending}
            >
              {dismissMutation.isPending ? "Completing..." : "Complete Onboarding"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


