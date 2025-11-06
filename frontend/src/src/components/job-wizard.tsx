import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChevronRight, ChevronLeft, User, Wrench, FileText, CheckCircle, AlertCircle } from "lucide-react";

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface User {
  id: number;
  username: string;
  fullName?: string;
  role: string;
}

interface JobWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  mode?: "create" | "edit";
}

interface WizardData {
  // Step 1: Customer Info
  customerId?: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  
  // Step 2: Equipment Info
  equipmentMakeModel: string;
  equipmentSerial: string;
  equipmentDescription: string;
  
  // Step 3: Job Details
  description: string;
  priority: string;
  assignedTo?: number;
  estimatedHours?: number;
}

const STEPS = [
  { id: 1, title: "Customer", icon: User, description: "Who is the customer?" },
  { id: 2, title: "Equipment", icon: Wrench, description: "What equipment needs work?" },
  { id: 3, title: "Job Details", icon: FileText, description: "What work needs to be done?" },
  { id: 4, title: "Review", icon: CheckCircle, description: "Check everything looks correct" }
];

export function JobWizard({ open, onOpenChange, initialData, mode = "create" }: JobWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    equipmentMakeModel: "",
    equipmentSerial: "",
    equipmentDescription: "",
    description: "",
    priority: "medium"
  });
  
  const { toast } = useToast();

  // Fetch customers for selection
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  // Fetch users for assignment
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Get next job ID
  const { data: jobIdData } = useQuery({
    queryKey: ['/api/generate-job-id'],
    enabled: mode === "create"
  });

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: async (jobData: any) => {
      if (mode === "create") {
        return await apiRequest('POST', '/api/jobs', jobData);
      } else {
        return await apiRequest('PUT', `/api/jobs/${initialData?.id}`, jobData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({
        title: mode === "create" ? "Job created successfully" : "Job updated successfully",
        description: `Job ${(jobIdData as any)?.jobId || (initialData as any)?.jobId} has been ${mode === "create" ? "created" : "updated"}`
      });
      onOpenChange(false);
      resetWizard();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${mode} job`,
        variant: "destructive"
      });
    }
  });

  const resetWizard = () => {
    setCurrentStep(1);
    setWizardData({
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      equipmentMakeModel: "",
      equipmentSerial: "",
      equipmentDescription: "",
      description: "",
      priority: "medium"
    });
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateWizardData = (field: keyof WizardData, value: any) => {
    setWizardData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === parseInt(customerId));
    if (customer) {
      updateWizardData("customerId", customer.id);
      updateWizardData("customerName", customer.name);
      updateWizardData("customerEmail", customer.email || "");
      updateWizardData("customerPhone", customer.phone || "");
    }
  };

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return wizardData.customerName.trim() !== "";
      case 2:
        return wizardData.equipmentDescription.trim() !== "";
      case 3:
        return wizardData.description.trim() !== "";
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    // Prepare job data
    const jobData: any = {
      jobId: (jobIdData as any)?.jobId || "",
      equipmentDescription: `${wizardData.equipmentMakeModel} ${wizardData.equipmentSerial}`.trim(),
      description: wizardData.description,
      assignedTo: wizardData.assignedTo || null,
      status: "waiting_assessment"
    };

    // Handle customer creation/selection
    if (wizardData.customerId) {
      jobData.customerId = wizardData.customerId;
    } else {
      // Create new customer
      try {
        const newCustomer = await apiRequest('POST', '/api/customers', {
          name: wizardData.customerName,
          email: wizardData.customerEmail || null,
          phone: wizardData.customerPhone || null
        });
        jobData.customerId = newCustomer.id;
      } catch (error) {
        toast({
          title: "Error creating customer",
          description: "Failed to create new customer",
          variant: "destructive"
        });
        return;
      }
    }

    createJobMutation.mutate(jobData);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <User className="h-12 w-12 mx-auto text-blue-600 mb-2" />
              <h3 className="text-lg font-semibold">Customer Information</h3>
              <p className="text-gray-600">Select an existing customer or add a new one</p>
            </div>
            
            <div className="space-y-4">


              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="customer-name" className="text-base font-medium required">
                    Customer Name *
                  </Label>
                  <Input
                    id="customer-name"
                    placeholder="Enter customer's full name"
                    value={wizardData.customerName}
                    onChange={(e) => updateWizardData("customerName", e.target.value)}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label htmlFor="customer-email" className="text-base font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="customer-email"
                    type="email"
                    placeholder="customer@email.com"
                    value={wizardData.customerEmail}
                    onChange={(e) => updateWizardData("customerEmail", e.target.value)}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label htmlFor="customer-phone" className="text-base font-medium">
                    Phone Number
                  </Label>
                  <Input
                    id="customer-phone"
                    placeholder="07XXX XXXXXX"
                    value={wizardData.customerPhone}
                    onChange={(e) => updateWizardData("customerPhone", e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Wrench className="h-12 w-12 mx-auto text-green-600 mb-2" />
              <h3 className="text-lg font-semibold">Equipment Details</h3>
              <p className="text-gray-600">Tell us about the equipment that needs work</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="equipment-make-model" className="text-base font-medium">
                  Equipment Make & Model
                </Label>
                <Input
                  id="equipment-make-model"
                  placeholder="e.g. John Deere X300, Honda GX160, Husqvarna 545RX"
                  value={wizardData.equipmentMakeModel || ""}
                  onChange={(e) => updateWizardData("equipmentMakeModel", e.target.value)}
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label htmlFor="equipment-serial" className="text-base font-medium">
                  Serial Number
                </Label>
                <Input
                  id="equipment-serial"
                  placeholder="Enter serial number if available"
                  value={wizardData.equipmentSerial}
                  onChange={(e) => updateWizardData("equipmentSerial", e.target.value)}
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label htmlFor="equipment-description" className="text-base font-medium required">
                  Equipment Description *
                </Label>
                <Textarea
                  id="equipment-description"
                  placeholder="Describe the equipment (e.g. Ride-on mower, Chainsaw, Strimmer)"
                  value={wizardData.equipmentDescription}
                  onChange={(e) => updateWizardData("equipmentDescription", e.target.value)}
                  className="mt-2"
                  rows={3}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Help us identify the equipment by describing what it is
                </p>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <FileText className="h-12 w-12 mx-auto text-purple-600 mb-2" />
              <h3 className="text-lg font-semibold">Job Details</h3>
              <p className="text-gray-600">What work needs to be done?</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="job-description" className="text-base font-medium required">
                  Work Description *
                </Label>
                <Textarea
                  id="job-description"
                  placeholder="Describe what work needs to be done (e.g. Service and repair, Won't start, Replace parts)"
                  value={wizardData.description}
                  onChange={(e) => updateWizardData("description", e.target.value)}
                  className="mt-2"
                  rows={4}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Include any symptoms, issues, or specific work required
                </p>
              </div>
              

              
              <div>
                <Label htmlFor="assigned-to" className="text-base font-medium">
                  Assign to Mechanic
                </Label>
                <Select 
                  value={wizardData.assignedTo?.toString() || ""} 
                  onValueChange={(value) => updateWizardData("assignedTo", value ? parseInt(value) : undefined)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choose a mechanic (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(user => user.role === 'mechanic' || user.role === 'admin').map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.fullName || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-2" />
              <h3 className="text-lg font-semibold">Review Job Details</h3>
              <p className="text-gray-600">Check everything is correct before creating the job</p>
            </div>
            
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-gray-600">CUSTOMER</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-medium">{wizardData.customerName}</p>
                    {wizardData.customerEmail && <p className="text-sm text-gray-600">{wizardData.customerEmail}</p>}
                    {wizardData.customerPhone && <p className="text-sm text-gray-600">{wizardData.customerPhone}</p>}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-gray-600">EQUIPMENT</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-medium">{wizardData.equipmentDescription}</p>
                    {wizardData.equipmentMakeModel && (
                      <p className="text-sm text-gray-600">
                        {wizardData.equipmentMakeModel}
                      </p>
                    )}
                    {wizardData.equipmentSerial && (
                      <p className="text-sm text-gray-600">Serial: {wizardData.equipmentSerial}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-gray-600">JOB DETAILS</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-medium">{wizardData.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {wizardData.assignedTo && (
                        <span>
                          Assigned to: {users.find(u => u.id === wizardData.assignedTo)?.fullName || 
                                     users.find(u => u.id === wizardData.assignedTo)?.username}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {mode === "create" && jobIdData && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-900">Job ID: {(jobIdData as any).jobId}</p>
                      <p className="text-sm text-blue-700">This job will be created with the above ID</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === "create" ? "Create New Job" : "Edit Job"}
          </DialogTitle>
        </DialogHeader>
        
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  currentStep >= step.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentStep > step.id ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    step.id
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <Progress value={(currentStep / STEPS.length) * 100} className="h-2" />
          <div className="flex justify-between mt-2">
            <span className="text-sm font-medium text-blue-600">
              Step {currentStep} of {STEPS.length}
            </span>
            <span className="text-sm text-gray-600">
              {STEPS[currentStep - 1]?.title}
            </span>
          </div>
        </div>

        {/* Step content */}
        <div className="min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {currentStep < STEPS.length ? (
              <Button
                onClick={handleNext}
                disabled={!canProceedFromStep(currentStep)}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createJobMutation.isPending}
                className="flex items-center gap-2"
              >
                {createJobMutation.isPending ? "Creating..." : 
                 mode === "create" ? "Create Job" : "Update Job"}
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}