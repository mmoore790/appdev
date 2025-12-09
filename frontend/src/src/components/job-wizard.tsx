import { useState, useRef, useEffect } from "react";
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
import { api } from "@/lib/api";
import { ChevronRight, ChevronLeft, User, Wrench, FileText, CheckCircle, AlertCircle, X, Plus, MapPin, Phone, Mail } from "lucide-react";

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
  customerAddress?: string;
  useNameOnly?: boolean; // Flag to use name only without saving customer
  
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
  
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();

  // Fetch customers with search
  const searchTerm = customerSearchQuery.trim();
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers', searchTerm],
    queryFn: () =>
      api.get<Customer[]>(`/api/customers${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ""}`),
  });

  // Filter customers based on search query
  const filteredCustomers = customers.filter((customer) => {
    if (!searchTerm) return false;
    const query = searchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      (customer.email && customer.email.toLowerCase().includes(query)) ||
      (customer.phone && customer.phone.includes(query))
    );
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(event.target as Node) &&
        customerInputRef.current &&
        !customerInputRef.current.contains(event.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch users for assignment
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
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
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      const jobId = data?.jobId || (initialData as any)?.jobId || 'unknown';
      toast({
        title: mode === "create" ? "Job created successfully" : "Job updated successfully",
        description: `Job ${jobId} has been ${mode === "create" ? "created" : "updated"}`
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
    setCustomerSearchQuery("");
    setSelectedCustomer(null);
    setShowCustomerDropdown(false);
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

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearchQuery(customer.name);
    updateWizardData("customerId", customer.id);
    updateWizardData("customerName", customer.name);
    updateWizardData("customerEmail", customer.email || "");
    updateWizardData("customerPhone", customer.phone || "");
    updateWizardData("customerAddress", customer.address || "");
    updateWizardData("useNameOnly", false);
    setShowCustomerDropdown(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearchQuery("");
    updateWizardData("customerId", undefined);
    updateWizardData("customerName", "");
    updateWizardData("customerEmail", "");
    updateWizardData("customerPhone", "");
    updateWizardData("customerAddress", "");
    updateWizardData("useNameOnly", false);
  };

  const handleCreateNewCustomer = () => {
    // User wants to create a new customer - show email/phone fields
    updateWizardData("customerId", undefined);
    updateWizardData("useNameOnly", false);
    setShowCustomerDropdown(false);
    // Keep the name they typed
  };

  const handleUseNameOnly = () => {
    // User wants to use name only without saving customer
    // But we still need email/phone for sending emails and keeping on file
    updateWizardData("customerId", undefined);
    updateWizardData("customerAddress", "");
    updateWizardData("useNameOnly", true);
    setShowCustomerDropdown(false);
    // Keep email/phone fields visible so user can enter them
  };

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 1:
        const hasName = wizardData.customerName.trim() !== "";
        // If using name-only mode, email and phone are required
        if (wizardData.useNameOnly) {
          return hasName && wizardData.customerEmail.trim() !== "" && wizardData.customerPhone.trim() !== "";
        }
        return hasName;
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
    // Don't include jobId - let the backend generate it sequentially
    const equipmentDesc = `${wizardData.equipmentMakeModel} ${wizardData.equipmentSerial}`.trim();
    const jobData: any = {
      description: wizardData.description,
      status: "waiting_assessment"
    };
    
    // Only include equipmentDescription if it's not empty
    if (equipmentDesc) {
      jobData.equipmentDescription = equipmentDesc;
    }
    
    // Only include assignedTo if it's set
    if (wizardData.assignedTo) {
      jobData.assignedTo = wizardData.assignedTo;
    }

    // Handle customer creation/selection
    if (wizardData.customerId) {
      // Use existing customer
      jobData.customerId = wizardData.customerId;
    } else if (wizardData.useNameOnly) {
      // Use name only without saving customer, but include email/phone for job record
      jobData.customerName = wizardData.customerName;
      jobData.customerEmail = wizardData.customerEmail || null;
      jobData.customerPhone = wizardData.customerPhone || null;
    } else {
      // Create new customer (recommended)
      try {
        const newCustomer = await apiRequest<Customer>('POST', '/api/customers', {
          name: wizardData.customerName,
          email: wizardData.customerEmail || null,
          phone: wizardData.customerPhone || null,
          address: wizardData.customerAddress || null
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
            <div className="text-center mb-4 sm:mb-6">
              <User className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-blue-600 mb-2" />
              <h3 className="text-base sm:text-lg font-semibold">Customer Information</h3>
              <p className="text-sm sm:text-base text-gray-600">Search for an existing customer or add a new one</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="customer-name" className="text-base font-medium required">
                  Customer Name *
                </Label>
                <div className="relative mt-2" ref={customerDropdownRef}>
                  <Input
                    ref={customerInputRef}
                    id="customer-name"
                    placeholder="Search for customer or enter name..."
                    value={customerSearchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomerSearchQuery(value);
                      updateWizardData("customerName", value);
                      setShowCustomerDropdown(true);
                      if (!value) {
                        handleClearCustomer();
                      } else if (!selectedCustomer) {
                        updateWizardData("customerId", undefined);
                      }
                    }}
                    onFocus={() => {
                      if (customerSearchQuery) {
                        setShowCustomerDropdown(true);
                      }
                    }}
                  />
                  {customerSearchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={handleClearCustomer}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  
                  {/* Customer Search Dropdown */}
                  {showCustomerDropdown && customerSearchQuery && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredCustomers.length > 0 && (
                        <div className="py-1">
                          {filteredCustomers.map((customer) => (
                            <div
                              key={customer.id}
                              className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700"
                              onClick={() => handleCustomerSelect(customer)}
                            >
                              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                {customer.name}
                              </div>
                              <div className="mt-1 space-y-1">
                                {customer.phone && (
                                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    <Phone className="h-3 w-3" />
                                    <span>{customer.phone}</span>
                                  </div>
                                )}
                                {customer.email && (
                                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    <Mail className="h-3 w-3" />
                                    <span>{customer.email}</span>
                                  </div>
                                )}
                                {customer.address && (
                                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    <MapPin className="h-3 w-3" />
                                    <span>{customer.address}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Always show create options, even when matches exist */}
                      <div className={`px-4 py-3 ${filteredCustomers.length > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}>
                        {filteredCustomers.length === 0 && (
                          <div className="text-sm text-gray-500 mb-3">
                            No customers found matching "{customerSearchQuery}"
                          </div>
                        )}
                        {filteredCustomers.length > 0 && (
                          <div className="text-xs text-gray-500 mb-3">
                            Found {filteredCustomers.length} matching customer{filteredCustomers.length !== 1 ? 's' : ''}. You can still create a new one:
                          </div>
                        )}
                        <div className="space-y-2">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="w-full"
                            onClick={handleCreateNewCustomer}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Customer {filteredCustomers.length > 0 ? '(Even with same name)' : '(Recommended)'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={handleUseNameOnly}
                          >
                            Use Name Only (Don't Save Customer)
                          </Button>
                        </div>
                        {filteredCustomers.length === 0 && (
                          <p className="text-xs text-gray-500 mt-2">
                            💡 We recommend creating a customer profile to track their history and contact details.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Selected Customer Preview */}
                {selectedCustomer && (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-green-900 dark:text-green-100">
                          Using saved customer: {selectedCustomer.name}
                        </div>
                        <div className="mt-1 space-y-1 text-xs text-green-700 dark:text-green-300">
                          {selectedCustomer.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span>{selectedCustomer.phone}</span>
                            </div>
                          )}
                          {selectedCustomer.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span>{selectedCustomer.email}</span>
                            </div>
                          )}
                          {selectedCustomer.address && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span>{selectedCustomer.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearCustomer}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Name Only Mode Indicator */}
                {wizardData.useNameOnly && !selectedCustomer && (
                  <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      ⚠️ Customer profile will not be saved, but email and phone are required for sending updates and keeping contact details on file.
                    </div>
                  </div>
                )}
              </div>
              
              {/* Show email/phone fields if creating new customer OR using name-only mode */}
              {/* Address field only shown when creating new customer (not name-only) */}
              {(!selectedCustomer) && (
                <>
                  <div>
                    <Label htmlFor="customer-email" className="text-base font-medium">
                      Email Address {wizardData.useNameOnly && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      id="customer-email"
                      type="email"
                      placeholder="customer@email.com"
                      value={wizardData.customerEmail}
                      onChange={(e) => updateWizardData("customerEmail", e.target.value)}
                      className="mt-2"
                    />
                    {wizardData.useNameOnly && (
                      <p className="text-xs text-gray-500 mt-1">
                        Required for sending email updates about this job
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="customer-phone" className="text-base font-medium">
                      Phone Number {wizardData.useNameOnly && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      id="customer-phone"
                      placeholder="07XXX XXXXXX"
                      value={wizardData.customerPhone}
                      onChange={(e) => updateWizardData("customerPhone", e.target.value)}
                      className="mt-2"
                    />
                    {wizardData.useNameOnly && (
                      <p className="text-xs text-gray-500 mt-1">
                        Required for keeping contact details on file
                      </p>
                    )}
                  </div>

                  {/* Address field only shown when creating new customer (not name-only) */}
                  {!wizardData.useNameOnly && (
                    <div>
                      <Label htmlFor="customer-address" className="text-base font-medium">
                        Address
                      </Label>
                      <Textarea
                        id="customer-address"
                        placeholder="Customer address (optional)"
                        value={wizardData.customerAddress || ""}
                        onChange={(e) => updateWizardData("customerAddress", e.target.value)}
                        className="mt-2"
                        rows={2}
                      />
                    </div>
                  )}
                </>
              )}
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
                  Assign to Staff Member
                </Label>
                <Select 
                  value={wizardData.assignedTo?.toString() || "unassigned"} 
                  onValueChange={(value) => updateWizardData("assignedTo", value === "unassigned" ? undefined : parseInt(value))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choose a staff member (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user) => (
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
                    {selectedCustomer ? (
                      <>
                        {selectedCustomer.phone && <p className="text-sm text-gray-600 flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedCustomer.phone}</p>}
                        {selectedCustomer.email && <p className="text-sm text-gray-600 flex items-center gap-1"><Mail className="h-3 w-3" /> {selectedCustomer.email}</p>}
                        {selectedCustomer.address && <p className="text-sm text-gray-600 flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedCustomer.address}</p>}
                      </>
                    ) : wizardData.useNameOnly ? (
                      <>
                        <p className="text-sm text-amber-600 mb-2">⚠️ Customer profile not saved (name only mode)</p>
                        {wizardData.customerPhone && <p className="text-sm text-gray-600 flex items-center gap-1"><Phone className="h-3 w-3" /> {wizardData.customerPhone}</p>}
                        {wizardData.customerEmail && <p className="text-sm text-gray-600 flex items-center gap-1"><Mail className="h-3 w-3" /> {wizardData.customerEmail}</p>}
                      </>
                    ) : (
                      <>
                        {wizardData.customerEmail && <p className="text-sm text-gray-600 flex items-center gap-1"><Mail className="h-3 w-3" /> {wizardData.customerEmail}</p>}
                        {wizardData.customerPhone && <p className="text-sm text-gray-600 flex items-center gap-1"><Phone className="h-3 w-3" /> {wizardData.customerPhone}</p>}
                        {wizardData.customerAddress && <p className="text-sm text-gray-600 flex items-center gap-1"><MapPin className="h-3 w-3" /> {wizardData.customerAddress}</p>}
                      </>
                    )}
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

              {mode === "create" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-900">Job ID will be assigned automatically</p>
                      <p className="text-sm text-blue-700">A sequential job ID will be generated when you create this job</p>
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {mode === "create" ? "Create New Job" : "Edit Job"}
          </DialogTitle>
        </DialogHeader>
        
        {/* Progress indicator */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4 overflow-x-auto pb-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-shrink-0">
                <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-medium ${
                  currentStep >= step.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentStep > step.id ? (
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    step.id
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-8 sm:w-12 h-0.5 mx-1 sm:mx-2 flex-shrink-0 ${
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
        <div className="min-h-[300px] sm:min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-2 pt-4 sm:pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 order-2 sm:order-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2 order-1 sm:order-2">
            {currentStep < STEPS.length ? (
              <Button
                onClick={handleNext}
                disabled={!canProceedFromStep(currentStep)}
                className="flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 w-full sm:w-auto"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createJobMutation.isPending}
                className="flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 w-full sm:w-auto"
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