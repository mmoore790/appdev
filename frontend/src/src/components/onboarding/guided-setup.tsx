import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Building2, 
  Users, 
  Wrench, 
  LayoutGrid, 
  Mail,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CustomerForm } from "@/components/customer-form";
import { JobWizard } from "@/components/job-wizard";
import { useLocation } from "wouter";

const workshopSchema = z.object({
  name: z.string().min(1, "Workshop name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),
  hourlyLabourFee: z.string().optional(),
  vatRate: z.string().optional(),
});

type WorkshopFormValues = z.infer<typeof workshopSchema>;

interface GuidedSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const STEPS = [
  { id: 1, title: "Workshop Basics", icon: Building2 },
  { id: 2, title: "First Customer", icon: Users },
  { id: 3, title: "First Job", icon: Wrench },
  { id: 4, title: "Workshop Overview", icon: LayoutGrid },
  { id: 5, title: "Customer Notifications", icon: Mail },
] as const;

const ONBOARDING_STEP_KEY = "guided_setup_current_step";

export function GuidedSetup({ open, onOpenChange, onComplete }: GuidedSetupProps) {
  // Load saved step from localStorage, default to 1
  const [currentStep, setCurrentStep] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(ONBOARDING_STEP_KEY);
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });

  // When dialog opens, always sync with localStorage to ensure we're on the correct step
  // This handles the case where user viewed workshop (step 5) and returns
  useEffect(() => {
    if (open && typeof window !== "undefined") {
      // Always read fresh from localStorage when dialog opens
      const saved = localStorage.getItem(ONBOARDING_STEP_KEY);
      if (saved) {
        const savedStep = parseInt(saved, 10);
        // Always update to match saved step if valid (this ensures step 5 after viewing workshop)
        if (savedStep >= 1 && savedStep <= 5) {
          // Use a small timeout to ensure state update happens after dialog is fully open
          setTimeout(() => {
            setCurrentStep(savedStep);
          }, 50);
        }
      } else {
        // If no saved step, reset to 1
        setCurrentStep(1);
      }
    }
  }, [open]);
  const [workshopData, setWorkshopData] = useState<WorkshopFormValues | null>(null);
  const [customerCreated, setCustomerCreated] = useState(false);
  const [jobCreated, setJobCreated] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showJobWizard, setShowJobWizard] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Save step to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_STEP_KEY, currentStep.toString());
    }
  }, [currentStep]);

  const { data: businessData } = useQuery<{
    id: number;
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    hourlyLabourFee?: number | null;
  }>({
    queryKey: ["/api/business/me"],
  });

  const form = useForm<WorkshopFormValues>({
    resolver: zodResolver(workshopSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      email: "",
      website: "",
      hourlyLabourFee: "",
      vatRate: "",
    },
  });

  useEffect(() => {
    if (businessData) {
      form.reset({
        name: businessData.name || "",
        address: businessData.address || "",
        phone: businessData.phone || "",
        email: businessData.email || "",
        website: businessData.website || "",
        hourlyLabourFee: businessData.hourlyLabourFee 
          ? (businessData.hourlyLabourFee / 100).toString() 
          : "",
        vatRate: "",
      });
    }
  }, [businessData, form]);

  const updateBusinessMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
      hourlyLabourFee?: number 
    }) => {
      return apiRequest("PUT", "/api/business/me", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/me"] });
      toast({
        title: "Workshop updated",
        description: "Your workshop settings have been saved.",
      });
    },
  });

  const completeSetupMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/complete-onboarding-setup");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const handleStep1Submit = (data: WorkshopFormValues) => {
    const hourlyLabourFee = data.hourlyLabourFee 
      ? Math.round(parseFloat(data.hourlyLabourFee) * 100) 
      : undefined;

    updateBusinessMutation.mutate({
      name: data.name,
      address: data.address || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      website: data.website || undefined,
      hourlyLabourFee,
    });

    setWorkshopData(data);
    setCurrentStep(2);
  };

  const handleStep2Complete = () => {
    setCustomerCreated(true);
    setShowCustomerForm(false);
    // Auto-advance after a brief delay
    setTimeout(() => {
      setCurrentStep(3);
    }, 500);
  };

  const handleStep3Complete = () => {
    setJobCreated(true);
    setShowJobWizard(false);
    // Auto-advance after a brief delay
    setTimeout(() => {
      setCurrentStep(4);
    }, 500);
  };

  const handleStep4Complete = () => {
    // Mark step 4 as complete and move to step 5 FIRST (before navigation)
    // This ensures localStorage is updated before we navigate away
    const newStep = 5;
    setCurrentStep(newStep);
    // Save immediately to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_STEP_KEY, newStep.toString());
    }
    // Close dialog before navigating (so it can reopen when user returns)
    onOpenChange(false);
    // Small delay to ensure state is saved, then navigate
    setTimeout(() => {
      navigate("/workshop");
    }, 100);
  };

  const handleComplete = () => {
    completeSetupMutation.mutate();
    // Clear saved step from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem(ONBOARDING_STEP_KEY);
    }
    onComplete();
    onOpenChange(false);
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl">Guided Setup</DialogTitle>
                <DialogDescription className="mt-1">
                  Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1]?.title}
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Progress value={progress} className="mt-4" />
          </DialogHeader>

          <div className="py-6">
            {/* Step 1: Workshop Basics */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-700 mb-4">
                    Let's set up your workshop basics. This includes important company information like your business address, phone number, email, and website address. This information will appear on job sheets and invoices.
                  </p>
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleStep1Submit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Workshop Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Smith's Repair Shop" {...field} />
                          </FormControl>
                          <FormDescription>
                            This will appear on job sheets and customer communications
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Address</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 123 Main Street, City, Postcode" {...field} />
                          </FormControl>
                          <FormDescription>
                            Your business address for job sheets and invoices
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 01234 567890" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="e.g., info@workshop.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website Address</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., https://www.workshop.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            Your business website (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hourlyLabourFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hourly Labour Rate (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="e.g., 50.00" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Set your standard hourly rate. You can change this later in settings.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}

            {/* Step 2: First Customer */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-700 mb-2">
                    <strong>Add your first customer.</strong> This replaces your customer cards or notebooks.
                  </p>
                  <p className="text-sm text-slate-600">
                    You can add just a name, or include phone and email for notifications.
                  </p>
                </div>

                {!customerCreated ? (
                  <div className="space-y-4">
                    <CustomerForm
                      onComplete={handleStep2Complete}
                    />
                  </div>
                ) : (
                  <Card className="border-emerald-200 bg-emerald-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        <div>
                          <p className="font-semibold text-emerald-900">Customer added!</p>
                          <p className="text-sm text-emerald-700">Moving to next step...</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Step 3: First Job */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-700 mb-2">
                    <strong>Create your first job.</strong> This replaces a paper job sheet.
                  </p>
                  <p className="text-sm text-slate-600">
                    Add equipment details, work required, and assign it to a staff member.
                  </p>
                </div>

                {!jobCreated ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      Click the button below to open the job creation form.
                    </p>
                    <Button
                      onClick={() => setShowJobWizard(true)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      Create First Job
                    </Button>
                  </div>
                ) : (
                  <Card className="border-emerald-200 bg-emerald-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        <div>
                          <p className="font-semibold text-emerald-900">Job created!</p>
                          <p className="text-sm text-emerald-700">Moving to next step...</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Step 4: Workshop Overview */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-700 mb-2">
                    <strong>This is your workshop at a glance.</strong>
                  </p>
                  <p className="text-sm text-slate-600">
                    You'll see job status columns and can drag jobs between them as work progresses. We're taking you there now to explore!
                  </p>
                </div>

                <div className="space-y-3">
                  <Card className="border-emerald-200 bg-emerald-50/30">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <p className="font-semibold text-emerald-900">What you'll see on the workshop page:</p>
                        <ul className="list-disc list-inside space-y-2 text-sm text-slate-700 ml-2">
                          <li><strong>Job status columns</strong> - Waiting Assessment, In Progress, Ready for Pickup, etc.</li>
                          <li><strong>Your newly created job</strong> - visible in the appropriate status column</li>
                          <li><strong>Drag & drop</strong> - Move jobs between columns to update their status</li>
                          <li><strong>Filters</strong> - Filter by staff member, date range, or search</li>
                          <li><strong>Job cards</strong> - Click any job to view and edit details</li>
                          <li><strong>Create new jobs</strong> - Use the "+ New Job" button to add more</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200 bg-blue-50/30">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <p className="font-semibold text-blue-900 mb-2">Try these actions:</p>
                        <div className="space-y-2 text-sm text-slate-700">
                          <div className="flex items-start gap-2">
                            <ArrowRight className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span>Click on your job card to see the full job details</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <ArrowRight className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span>Try dragging your job to a different status column</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <ArrowRight className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span>Explore the filters and search functionality</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      onClick={handleStep4Complete}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      View Workshop
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      <strong>Tip:</strong> After exploring the workshop, return to the dashboard to continue with the final step.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Customer Notifications */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-700 mb-2">
                    <strong>Customer notifications reduce phone calls.</strong>
                  </p>
                  <p className="text-sm text-slate-600">
                    When you update a job status, customers can automatically receive email updates. This means fewer "is my job ready?" calls.
                  </p>
                </div>

                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <p className="font-semibold">How it works:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 ml-2">
                        <li>Customers receive emails when jobs are accepted, in progress, or ready</li>
                        <li>They can track their job status online</li>
                        <li>You can send payment requests via email</li>
                        <li>All communication is logged automatically</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    onClick={handleComplete}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={completeSetupMutation.isPending}
                  >
                    {completeSetupMutation.isPending ? "Completing..." : "Finish Setup"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Wizard Modal */}
      {showJobWizard && (
        <JobWizard
          open={showJobWizard}
          onOpenChange={(open) => {
            setShowJobWizard(open);
            if (!open) {
              // Check if a job was created by refetching jobs
              queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
              // Auto-detect if job was created after a short delay
              setTimeout(() => {
                queryClient.fetchQuery({ queryKey: ["/api/jobs"] }).then((jobs: any) => {
                  if (jobs && Array.isArray(jobs) && jobs.length > 0) {
                    handleStep3Complete();
                  }
                });
              }, 1000);
            }
          }}
          mode="create"
        />
      )}
    </>
  );
}

