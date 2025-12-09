import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/queryClient";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

type Business = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  jobTrackerEnabled?: boolean | null;
  hourlyLabourFee?: number | null; // Stored in pence (e.g., 5000 = £50.00)
};

export default function Settings() {
  // Company information (per business, from backend)
  const [companyInfo, setCompanyInfo] = useState<Business | null>(null);
  
  // Display value for hourly labour fee (allows free typing)
  const [hourlyLabourFeeDisplay, setHourlyLabourFeeDisplay] = useState<string>("");
  
  // Other settings
  const [theme, setTheme] = useState("light");

  // Load company info from backend
  const { data: businessData, error: businessError, isLoading: isLoadingBusiness } = useQuery<Business>({
    queryKey: ["/api/business/me"],
  });

  useEffect(() => {
    if (businessData) {
      console.log("Business data loaded:", businessData);
      setCompanyInfo(businessData);
      // Set display value for hourly labour fee
      if (businessData.hourlyLabourFee !== null && businessData.hourlyLabourFee !== undefined) {
        setHourlyLabourFeeDisplay((businessData.hourlyLabourFee / 100).toString());
      } else {
        setHourlyLabourFeeDisplay("");
      }
    } else if (businessError) {
      console.error("Error loading business data:", businessError);
      toast({
        title: "Error loading company settings",
        description: businessError instanceof Error ? businessError.message : "Failed to load company information",
        variant: "destructive",
      });
    }
  }, [businessData, businessError]);

  const updateBusinessMutation = useMutation({
    mutationFn: async (updates: Partial<Business>) => {
      return await apiRequest<Business>("/api/business/me", {
        method: "PUT",
        data: updates,
      });
    },
    onSuccess: (updated) => {
      setCompanyInfo(updated);
      // Update display value for hourly labour fee
      if (updated.hourlyLabourFee !== null && updated.hourlyLabourFee !== undefined) {
        setHourlyLabourFeeDisplay((updated.hourlyLabourFee / 100).toString());
      } else {
        setHourlyLabourFeeDisplay("");
      }
      toast({
        title: "Settings saved",
        description: "Company information has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/business/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update company information: ${error.message || "Please try again."}`,
        variant: "destructive",
      });
    },
  });

  const logoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);
      
      // Use the apiRequest helper but with FormData (which needs special handling)
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "";
      const url = apiBaseUrl ? `${apiBaseUrl}/api/business/logo` : "/api/business/logo";
      
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        let errorMessage = "Failed to upload logo";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If response isn't JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      return (await response.json()) as { logoUrl: string };
    },
    onSuccess: ({ logoUrl }) => {
      setCompanyInfo((prev) => (prev ? { ...prev, logoUrl } : prev));
      toast({
        title: "Logo updated",
        description: "Company logo has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/business/me"] });
    },
    onError: (error: any) => {
      console.error("Logo upload error:", error);
      toast({
        title: "Error uploading logo",
        description: error.message || "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Define basic types
  type User = {
    id: number;
    username: string;
    fullName: string;
    email: string | null;
    role: string;
    avatarUrl?: string | null;
    isActive: boolean;
  };
  
  // Define types for registration requests
  type RegistrationRequest = {
    id: number;
    username: string;
    email: string;
    fullName: string;
    status: string;
    requestedRole: string;
    department?: string;
    reason?: string;
    createdAt: string;
    reviewedBy?: number;
    reviewedAt?: string;
    notes?: string;
  };
  
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  
  const { data: registrationRequests, isLoading: loadingRequests } = useQuery<RegistrationRequest[]>({
    queryKey: ["/api/auth/registration-requests"],
  });

  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [selectedRole, setSelectedRole] = useState("staff");
  const [rejectionNotes, setRejectionNotes] = useState("");
  
  // Define mutation parameter type
  type ApproveParams = {
    id: number;
    role: string;
    notes: string;
  };
  
  type RejectParams = {
    id: number;
    notes: string;
  };
  
  // Approve registration request
  const approveMutation = useMutation({
    mutationFn: async (params: ApproveParams) => {
      return await apiRequest(`/api/auth/approve-registration/${params.id}`, "POST", { 
        role: params.role, 
        notes: params.notes 
      });
    },
    onSuccess: () => {
      toast({
        title: "Registration approved",
        description: "The user account has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/registration-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setSelectedRequest(null);
      setApprovalNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to approve registration: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Reject registration request
  const rejectMutation = useMutation({
    mutationFn: async (params: RejectParams) => {
      return await apiRequest(`/api/auth/reject-registration/${params.id}`, "POST", { 
        notes: params.notes 
      });
    },
    onSuccess: () => {
      toast({
        title: "Registration rejected",
        description: "The registration request has been rejected."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/registration-requests"] });
      setSelectedRequest(null);
      setRejectionNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to reject registration: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Save company information
  const saveCompanyInfo = () => {
    if (!companyInfo) return;
    const { id, ...updates } = companyInfo;
    updateBusinessMutation.mutate(updates);
  };

  return (
    <>
      <PageHeader title="Settings" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <Tabs defaultValue="general" className="w-full">
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex w-auto min-w-full h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground md:w-full md:grid md:grid-cols-4">
              <TabsTrigger value="general" className="whitespace-nowrap">General</TabsTrigger>
              <TabsTrigger value="users" className="whitespace-nowrap">Users</TabsTrigger>
              <TabsTrigger value="registrations" className="whitespace-nowrap">Registrations</TabsTrigger>
              <TabsTrigger value="system" className="whitespace-nowrap">System</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="general" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  Update your company details and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingBusiness ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
                    <p className="mt-3 text-sm text-gray-600">Loading company settings...</p>
                  </div>
                ) : businessError ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-red-600">Failed to load company settings. Please refresh the page.</p>
                  </div>
                ) : (
                  <>
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input 
                    id="company-name" 
                    value={companyInfo?.name || ""} 
                    onChange={(e) => setCompanyInfo(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-address">Address</Label>
                  <Input 
                    id="company-address" 
                    value={companyInfo?.address || ""} 
                    onChange={(e) => setCompanyInfo(prev => prev ? { ...prev, address: e.target.value } : prev)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Phone Number</Label>
                  <Input 
                    id="company-phone" 
                    value={companyInfo?.phone || ""} 
                    onChange={(e) => setCompanyInfo(prev => prev ? { ...prev, phone: e.target.value } : prev)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-email">Email Address</Label>
                  <Input 
                    id="company-email" 
                    value={companyInfo?.email || ""} 
                    onChange={(e) => setCompanyInfo(prev => prev ? { ...prev, email: e.target.value } : prev)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-website">Website</Label>
                  <Input 
                    id="company-website" 
                    value={companyInfo?.website || ""}
                    onChange={(e) => setCompanyInfo(prev => prev ? { ...prev, website: e.target.value } : prev)}
                  />
                </div>

                <div className="space-y-4">
                  <Label>Company Logo</Label>
                  <div className="flex items-center gap-4">
                    {companyInfo?.logoUrl && (
                      <img
                        src={companyInfo.logoUrl}
                        alt="Company logo"
                        className="h-12 w-12 rounded-md border object-contain bg-white"
                        onError={(e) => {
                          console.error("Failed to load logo image:", companyInfo.logoUrl);
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <div className="flex flex-col gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={logoUploadMutation.isPending}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            console.log("Uploading logo file:", file.name, file.size, file.type);
                            logoUploadMutation.mutate(file);
                          }
                        }}
                      />
                      {logoUploadMutation.isPending && (
                        <p className="text-sm text-gray-500">Uploading logo...</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="hourly-labour-fee">Hourly Labour Rate (Excluding VAT) (£)</Label>
                    <Input 
                      id="hourly-labour-fee" 
                      type="number"
                      step="0.01"
                      min="0"
                      value={hourlyLabourFeeDisplay}
                      onChange={(e) => {
                        const value = e.target.value;
                        setHourlyLabourFeeDisplay(value);
                        // Convert to pence and update companyInfo
                        if (value === "" || value === ".") {
                          setCompanyInfo(prev => prev ? { ...prev, hourlyLabourFee: null } : prev);
                        } else {
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue) && numValue >= 0) {
                            const penceValue = Math.round(numValue * 100);
                            setCompanyInfo(prev => prev ? { ...prev, hourlyLabourFee: penceValue } : prev);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // Format to 2 decimal places on blur
                        const value = e.target.value;
                        if (value && value !== ".") {
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue) && numValue >= 0) {
                            setHourlyLabourFeeDisplay(numValue.toFixed(2));
                            const penceValue = Math.round(numValue * 100);
                            setCompanyInfo(prev => prev ? { ...prev, hourlyLabourFee: penceValue } : prev);
                          } else {
                            setHourlyLabourFeeDisplay("");
                            setCompanyInfo(prev => prev ? { ...prev, hourlyLabourFee: null } : prev);
                          }
                        } else {
                          setHourlyLabourFeeDisplay("");
                          setCompanyInfo(prev => prev ? { ...prev, hourlyLabourFee: null } : prev);
                        }
                      }}
                      placeholder="e.g., 50.00"
                    />
                    <p className="text-sm text-gray-500">
                      The hourly rate used to calculate labour charges in job sheets. This will be multiplied by the total labour hours.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="job-tracker-enabled">Job Status Tracker</Label>
                      <p className="text-sm text-gray-500">
                        Enable customers to track their job status online. When enabled, tracker links will appear in job receipts and email confirmations.
                      </p>
                    </div>
                    <Switch
                      id="job-tracker-enabled"
                      checked={companyInfo?.jobTrackerEnabled ?? true}
                      onCheckedChange={(checked) => 
                        setCompanyInfo(prev => prev ? { ...prev, jobTrackerEnabled: checked } : prev)
                      }
                    />
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <Button 
                    onClick={saveCompanyInfo} 
                    className="bg-green-700 hover:bg-green-800"
                    disabled={!companyInfo || isLoadingBusiness}
                  >
                    Save Changes
                  </Button>
                </div>
                  </>
                )}
                
                <Separator className="my-4" />
                
                <div className="space-y-2">
                  <Label htmlFor="theme-select">Theme</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger id="theme-select">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Separator className="my-4" />
                
                <div className="pt-4 flex justify-end">
                  <Button className="bg-green-700 hover:bg-green-800">
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          

          <TabsContent value="users" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage user accounts and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-200 table-fixed">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Username
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th scope="col" className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-200">
                      {users?.map((user) => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {user.avatarUrl ? (
                                <img className="h-8 w-8 rounded-full" src={user.avatarUrl} alt="" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                  <span className="text-sm font-medium text-green-700">
                                    {user.fullName.charAt(0)}
                                  </span>
                                </div>
                              )}
                              <div className="ml-4">
                                <div className="text-sm font-medium text-neutral-900">
                                  {user.fullName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-neutral-500">{user.username}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.role === 'admin' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Button variant="ghost" className="text-green-700 hover:text-green-800">
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-4 flex justify-end">
                  <Button className="bg-green-700 hover:bg-green-800">
                    <span className="material-icons mr-2 text-sm">Add</span>
                    Add User
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="registrations" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Registration Requests</CardTitle>
                <CardDescription>
                  Review and manage user registration requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRequests ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
                  </div>
                ) : registrationRequests && registrationRequests.length > 0 ? (
                  <div className="rounded-md border overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 table-fixed">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Full Name
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Username
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Requested Role
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th scope="col" className="relative px-6 py-3">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-neutral-200">
                        {registrationRequests.map((request) => (
                          <tr key={request.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                              {request.fullName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                              {request.username}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                              {request.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                              {request.requestedRole.charAt(0).toUpperCase() + request.requestedRole.slice(1)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {request.status === 'pending' && (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                  <Clock className="w-3 h-3 mr-1" /> Pending
                                </span>
                              )}
                              {request.status === 'approved' && (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
                                </span>
                              )}
                              {request.status === 'rejected' && (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                  <XCircle className="w-3 h-3 mr-1" /> Rejected
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {request.status === 'pending' && (
                                <div className="flex space-x-2 justify-end">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="text-green-700 border-green-700 hover:bg-green-50">
                                        Approve
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Approve Registration Request</DialogTitle>
                                        <DialogDescription>
                                          Approve this registration request and create a new user account. You can assign a role and add notes.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="approve-role">Assign Role</Label>
                                          <Select 
                                            value={selectedRole} 
                                            onValueChange={setSelectedRole}
                                            defaultValue={request.requestedRole || "staff"}
                                          >
                                            <SelectTrigger id="approve-role">
                                              <SelectValue placeholder="Select role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="admin">Admin</SelectItem>
                                              <SelectItem value="staff">Staff</SelectItem>
                                              <SelectItem value="mechanic">Mechanic</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="approval-notes">Notes (Optional)</Label>
                                          <Textarea 
                                            id="approval-notes" 
                                            placeholder="Add any additional notes"
                                            value={approvalNotes}
                                            onChange={(e) => setApprovalNotes(e.target.value)}
                                          />
                                        </div>
                                      </div>
                                      <DialogFooter>
                                        <DialogClose asChild>
                                          <Button variant="outline">Cancel</Button>
                                        </DialogClose>
                                        <Button 
                                          onClick={() => {
                                            setSelectedRequest(request);
                                            approveMutation.mutate({
                                              id: request.id,
                                              role: selectedRole,
                                              notes: approvalNotes
                                            });
                                          }}
                                          className="bg-green-700 hover:bg-green-800"
                                          disabled={approveMutation.isPending}
                                        >
                                          {approveMutation.isPending ? "Processing..." : "Approve"}
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                  
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="text-red-700 border-red-700 hover:bg-red-50">
                                        Reject
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Reject Registration Request</DialogTitle>
                                        <DialogDescription>
                                          Reject this registration request. Please provide a reason for the rejection.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="rejection-notes">Reason for Rejection</Label>
                                          <Textarea 
                                            id="rejection-notes" 
                                            placeholder="Please provide a reason for rejecting this request"
                                            value={rejectionNotes}
                                            onChange={(e) => setRejectionNotes(e.target.value)}
                                          />
                                        </div>
                                      </div>
                                      <DialogFooter>
                                        <DialogClose asChild>
                                          <Button variant="outline">Cancel</Button>
                                        </DialogClose>
                                        <Button 
                                          variant="destructive"
                                          onClick={() => {
                                            setSelectedRequest(request);
                                            rejectMutation.mutate({
                                              id: request.id,
                                              notes: rejectionNotes
                                            });
                                          }}
                                          disabled={rejectMutation.isPending}
                                        >
                                          {rejectMutation.isPending ? "Processing..." : "Reject"}
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              )}
                              {request.status !== 'pending' && (
                                <Button variant="ghost" size="sm" className="text-neutral-500">
                                  View Details
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-sm text-neutral-500">No registration requests found.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="system" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>
                  View system information and manage maintenance settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Software Version</h3>
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-800">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm text-neutral-500">Current Version</div>
                        <div className="mt-1 text-lg font-semibold">1.5.2</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-800">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm text-neutral-500">Database Version</div>
                        <div className="mt-1 text-lg font-semibold">3.2.1</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">System Health</h3>
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-800">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm text-neutral-500">Server Status</div>
                        <div className="flex items-center mt-1">
                          <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
                          <span className="text-sm font-medium">Operational</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-500">Storage Usage</span>
                        <span className="font-medium">45%</span>
                      </div>
                      <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                        <div className="h-2 bg-green-500 rounded-full" style={{ width: '45%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Maintenance</h3>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Run Database Maintenance
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      Clear System Cache
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Export System Logs
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}