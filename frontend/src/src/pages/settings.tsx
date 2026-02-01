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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  subscriptionTier?: string | null;
  userLimit?: number | null;
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

  // Active settings tab (for loading user count when on Users tab)
  const [settingsTab, setSettingsTab] = useState("general");

  // Fetch user count and limits when on Users tab
  const { data: userCountData } = useQuery<{
    current: number;
    max: number;
    plan: string;
    canAddMore: boolean;
  }>({
    queryKey: ["/api/users/count/current"],
    enabled: settingsTab === "users",
  });

  // Edit user state
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    fullName: "",
    username: "",
    email: "",
    role: "staff" as "staff" | "mechanic" | "admin",
    newPassword: "",
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
    onError: (error: unknown) => {
      const msg = (error as { message?: string })?.message ?? "Failed to create user.";
      toast({
        title: "Error",
        description: msg,
        variant: "destructive"
      });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { fullName?: string; username?: string; email?: string; role?: string; newPassword?: string } }) => {
      return await apiRequest<User>(`/api/users/${id}`, { method: "PUT", data });
    },
    onSuccess: () => {
      toast({ title: "User updated", description: "User details have been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/count/current"] });
      setEditUserDialogOpen(false);
      setEditingUser(null);
      setEditUserForm({ fullName: "", username: "", email: "", role: "staff", newPassword: "" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: (error as { message?: string })?.message ?? "Failed to update user.",
        variant: "destructive",
      });
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest<{ message: string }>(`/api/users/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "User removed", description: "The user has been removed from your business." });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/count/current"] });
      setEditUserDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: (error as { message?: string })?.message ?? "Failed to remove user.",
        variant: "destructive",
      });
    },
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
    if (userCountData && !userCountData.canAddMore) {
      toast({
        title: "User limit reached",
        description: "Contact Boltdown support to increase your user limit.",
        variant: "destructive"
      });
      return;
    }
    createUserMutation.mutate(newUserForm);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserForm({
      fullName: user.fullName,
      username: user.username,
      email: user.email ?? "",
      role: user.role as "staff" | "mechanic" | "admin",
      newPassword: "",
    });
    setEditUserDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    if (!editUserForm.fullName.trim() || !editUserForm.username.trim()) {
      toast({
        title: "Validation Error",
        description: "Full name and username are required.",
        variant: "destructive",
      });
      return;
    }
    const payload: { fullName?: string; username?: string; email?: string; role?: string; newPassword?: string } = {
      fullName: editUserForm.fullName.trim(),
      username: editUserForm.username.trim(),
      email: editUserForm.email?.trim() || undefined,
      role: editUserForm.role,
    };
    if (editUserForm.newPassword.trim()) payload.newPassword = editUserForm.newPassword;
    updateUserMutation.mutate({ id: editingUser.id, data: payload });
  };

  const handleRemoveUser = () => {
    if (!editingUser) return;
    if (!window.confirm(`Remove ${editingUser.fullName} from your business? They will no longer be able to log in.`)) return;
    deactivateUserMutation.mutate(editingUser.id);
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
        <Tabs value={settingsTab} onValueChange={setSettingsTab} className="w-full">
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex w-auto min-w-full h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground md:w-full md:grid md:grid-cols-2">
              <TabsTrigger value="general" className="whitespace-nowrap">General</TabsTrigger>
              <TabsTrigger value="users" className="whitespace-nowrap">Users</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="general" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
                <CardDescription>
                  Update your company details and preferences. Expand each section to edit.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                  <Accordion type="multiple" defaultValue={["account-plan"]} className="w-full">
                    {/* Account plan (read-only) */}
                    <AccordionItem value="account-plan">
                      <AccordionTrigger className="text-left">Account plan</AccordionTrigger>
                      <AccordionContent>
                        <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-muted-foreground">Subscription</Label>
                              <p className="text-base font-medium">
                                {companyInfo?.subscriptionTier ?? "—"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-muted-foreground">User limit</Label>
                              <p className="text-base font-medium">
                                {companyInfo?.userLimit != null ? companyInfo.userLimit : "—"}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Subscription and user limit are set when your account is created. Contact your administrator to change them.
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Company details */}
                    <AccordionItem value="company-details">
                      <AccordionTrigger className="text-left">Company details</AccordionTrigger>
                      <AccordionContent className="space-y-4">
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
                      </AccordionContent>
                    </AccordionItem>

                    {/* Branding / Logo */}
                    <AccordionItem value="branding">
                      <AccordionTrigger className="text-left">Branding & logo</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <Label>Company Logo</Label>
                          <div className="flex items-center gap-4">
                            {companyInfo?.logoUrl && (
                              <img
                                src={companyInfo.logoUrl}
                                alt="Company logo"
                                className="h-12 w-12 rounded-md border object-contain bg-white"
                                onError={(e) => {
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
                                  if (file) logoUploadMutation.mutate(file);
                                }}
                              />
                              {logoUploadMutation.isPending && (
                                <p className="text-sm text-muted-foreground">Uploading logo...</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Labour & billing */}
                    <AccordionItem value="labour-billing">
                      <AccordionTrigger className="text-left">Labour & billing</AccordionTrigger>
                      <AccordionContent>
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
                              if (value === "" || value === ".") {
                                setCompanyInfo(prev => prev ? { ...prev, hourlyLabourFee: null } : prev);
                              } else {
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue) && numValue >= 0) {
                                  setCompanyInfo(prev => prev ? { ...prev, hourlyLabourFee: Math.round(numValue * 100) } : prev);
                                }
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value;
                              if (value && value !== ".") {
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue) && numValue >= 0) {
                                  setHourlyLabourFeeDisplay(numValue.toFixed(2));
                                  setCompanyInfo(prev => prev ? { ...prev, hourlyLabourFee: Math.round(numValue * 100) } : prev);
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
                          <p className="text-sm text-muted-foreground">
                            The hourly rate used to calculate labour charges in job sheets.
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Job tracker */}
                    <AccordionItem value="job-tracker">
                      <AccordionTrigger className="text-left">Job status tracker</AccordionTrigger>
                      <AccordionContent>
                        <div className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <Label htmlFor="job-tracker-enabled">Allow customers to track job status</Label>
                            <p className="text-sm text-muted-foreground">
                              When enabled, tracker links appear in job receipts and email confirmations.
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
                      </AccordionContent>
                    </AccordionItem>

                    {/* Appearance */}
                    <AccordionItem value="appearance">
                      <AccordionTrigger className="text-left">Appearance</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <Label htmlFor="theme-select">Theme</Label>
                          <Select value={theme} onValueChange={setTheme}>
                            <SelectTrigger id="theme-select" className="max-w-xs">
                              <SelectValue placeholder="Select theme" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="dark">Dark</SelectItem>
                              <SelectItem value="system">System</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                {!isLoadingBusiness && !businessError && (
                  <div className="mt-6 flex justify-end border-t pt-4">
                    <Button
                      onClick={saveCompanyInfo}
                      className="bg-green-700 hover:bg-green-800"
                      disabled={!companyInfo || isLoadingBusiness}
                    >
                      Save changes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          

          <TabsContent value="users" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage user accounts and permissions. Expand each section as needed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" defaultValue={["team-members", "usage-limits"]} className="w-full">
                  <AccordionItem value="team-members">
                    <AccordionTrigger className="text-left">Team members</AccordionTrigger>
                    <AccordionContent>
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
                            <Button
                              variant="ghost"
                              className="text-green-700 hover:text-green-800"
                              onClick={() => openEditUser(user)}
                            >
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        className="bg-green-700 hover:bg-green-800"
                        disabled={userCountData && !userCountData.canAddMore}
                      >
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg sm:max-w-xl overflow-y-auto max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>
                          Create a new user account for your business. Username, password, and full name are required.
                        </DialogDescription>
                      </DialogHeader>
                      {userCountData && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
                          <p className="text-blue-900 font-medium">
                            Users: {userCountData.current} / {userCountData.max} ({userCountData.plan} plan)
                          </p>
                          {!userCountData.canAddMore && (
                            <p className="text-blue-700 mt-1 text-xs">
                              User limit reached. Contact Boltdown support to increase your limit.
                            </p>
                          )}
                        </div>
                      )}
                      <div className="grid gap-4 py-4 sm:grid-cols-1">
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
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="staff">Staff</SelectItem>
                              <SelectItem value="mechanic">Mechanic</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter className="flex flex-wrap gap-2 sm:gap-0">
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button 
                          onClick={handleCreateUser}
                          className="bg-green-700 hover:bg-green-800"
                          disabled={createUserMutation.isPending || (userCountData && !userCountData.canAddMore)}
                        >
                          {createUserMutation.isPending ? "Creating..." : "Create User"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Edit User dialog */}
                  <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
                    <DialogContent className="max-w-lg sm:max-w-xl overflow-y-auto max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                          Update user details, reset password, or remove the user from your business.
                        </DialogDescription>
                      </DialogHeader>
                      {editingUser && (
                        <>
                          <div className="grid gap-4 py-4 sm:grid-cols-1">
                            <div className="space-y-2">
                              <Label htmlFor="edit-user-fullname">Full Name</Label>
                              <Input
                                id="edit-user-fullname"
                                value={editUserForm.fullName}
                                onChange={(e) => setEditUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                                placeholder="Full name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-user-username">Username</Label>
                              <Input
                                id="edit-user-username"
                                value={editUserForm.username}
                                onChange={(e) => setEditUserForm(prev => ({ ...prev, username: e.target.value }))}
                                placeholder="Username"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-user-email">Email</Label>
                              <Input
                                id="edit-user-email"
                                type="email"
                                value={editUserForm.email}
                                onChange={(e) => setEditUserForm(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="Email"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-user-role">Role</Label>
                              <Select
                                value={editUserForm.role}
                                onValueChange={(value: "staff" | "mechanic" | "admin") =>
                                  setEditUserForm(prev => ({ ...prev, role: value }))
                                }
                              >
                                <SelectTrigger id="edit-user-role">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="staff">Staff</SelectItem>
                                  <SelectItem value="mechanic">Mechanic</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-user-new-password">New password (leave blank to keep current)</Label>
                              <Input
                                id="edit-user-new-password"
                                type="password"
                                value={editUserForm.newPassword}
                                onChange={(e) => setEditUserForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                placeholder="Enter new password to reset"
                              />
                            </div>
                          </div>
                          <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
                            <div className="order-2 sm:order-1">
                              <Button
                                variant="destructive"
                                onClick={handleRemoveUser}
                                disabled={deactivateUserMutation.isPending}
                              >
                                {deactivateUserMutation.isPending ? "Removing..." : "Remove user"}
                              </Button>
                            </div>
                            <div className="flex gap-2 order-1 sm:order-2">
                              <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogClose>
                              <Button
                                onClick={handleUpdateUser}
                                className="bg-green-700 hover:bg-green-800"
                                disabled={updateUserMutation.isPending}
                              >
                                {updateUserMutation.isPending ? "Saving..." : "Save changes"}
                              </Button>
                            </div>
                          </DialogFooter>
                        </>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="usage-limits">
                    <AccordionTrigger className="text-left">Usage & limits</AccordionTrigger>
                    <AccordionContent>
                      {userCountData ? (
                        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label className="text-muted-foreground">Current users</Label>
                              <p className="text-base font-medium">{userCountData.current} / {userCountData.max}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Plan</Label>
                              <p className="text-base font-medium">{userCountData.plan}</p>
                            </div>
                          </div>
                          {!userCountData.canAddMore && (
                            <p className="text-sm text-amber-700">
                              User limit reached. Contact Boltdown support to increase your limit.
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Loading usage...</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}