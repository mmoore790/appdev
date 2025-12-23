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
  
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // User creation state
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    role: "staff" as "staff" | "mechanic" | "admin",
  });

  // Fetch user count and limits
  const { data: userCountData } = useQuery<{
    current: number;
    max: number;
    plan: string;
    canAddMore: boolean;
  }>({
    queryKey: ["/api/users/count/current"],
    enabled: addUserDialogOpen, // Only fetch when dialog is open
  });

  // Create new user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserForm) => {
      return await apiRequest<User>("/api/users", { method: "POST", data: userData });
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: "The user account has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/count/current"] });
      setAddUserDialogOpen(false);
      setNewUserForm({
        username: "",
        password: "",
        fullName: "",
        email: "",
        role: "staff",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || `Failed to create user: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleCreateUser = () => {
    if (!newUserForm.username || !newUserForm.password || !newUserForm.fullName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (username, password, and full name).",
        variant: "destructive"
      });
      return;
    }
    createUserMutation.mutate(newUserForm);
  };

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
            <TabsList className="inline-flex w-auto min-w-full h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground md:w-full md:grid md:grid-cols-2">
              <TabsTrigger value="general" className="whitespace-nowrap">General</TabsTrigger>
              <TabsTrigger value="users" className="whitespace-nowrap">Users</TabsTrigger>
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
                
                {/* User count info */}
                {userCountData && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          Users: {userCountData.current} / {userCountData.max} ({userCountData.plan} plan)
                        </p>
                        {!userCountData.canAddMore && (
                          <p className="text-xs text-blue-700 mt-1">
                            {userCountData.plan.toLowerCase() === "starter" 
                              ? "Your starter plan only allows the admin user. Contact support@boltdown.co.uk or upgrade your plan to add more users."
                              : `You have reached the maximum number of users for your ${userCountData.plan} plan. Contact support@boltdown.co.uk or upgrade your plan.`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        className="bg-green-700 hover:bg-green-800"
                        disabled={userCountData && !userCountData.canAddMore}
                      >
                        <span className="material-icons mr-2 text-sm">Add</span>
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>
                          Create a new user account for your business. All fields are required.
                        </DialogDescription>
                      </DialogHeader>
                      {userCountData && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-xs text-blue-700">
                            Users: {userCountData.current} / {userCountData.max} ({userCountData.plan} plan)
                          </p>
                        </div>
                      )}
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="new-user-fullname">Full Name *</Label>
                          <Input
                            id="new-user-fullname"
                            value={newUserForm.fullName}
                            onChange={(e) => setNewUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                            placeholder="John Doe"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-user-username">Username *</Label>
                          <Input
                            id="new-user-username"
                            value={newUserForm.username}
                            onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))}
                            placeholder="johndoe"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-user-password">Password *</Label>
                          <Input
                            id="new-user-password"
                            type="password"
                            value={newUserForm.password}
                            onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Enter password"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-user-email">Email</Label>
                          <Input
                            id="new-user-email"
                            type="email"
                            value={newUserForm.email}
                            onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="john@example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-user-role">Role *</Label>
                          <Select
                            value={newUserForm.role}
                            onValueChange={(value: "staff" | "mechanic" | "admin") => 
                              setNewUserForm(prev => ({ ...prev, role: value }))
                            }
                          >
                            <SelectTrigger id="new-user-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="staff">Staff</SelectItem>
                              <SelectItem value="mechanic">Mechanic</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button 
                          onClick={handleCreateUser}
                          className="bg-green-700 hover:bg-green-800"
                          disabled={createUserMutation.isPending}
                        >
                          {createUserMutation.isPending ? "Creating..." : "Create User"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}