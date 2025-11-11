import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/queryClient";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, XCircle, Clock, Mail, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useTheme } from "@/components/theme/theme-provider";

export default function Settings() {
  // Company information
  const [companyInfo, setCompanyInfo] = useState({
    name: "Moore Horticulture Equipment",
    address: "9 Drumalig Road, BT27 6UD",
    phone: "02897510804",
    email: "info@mooresmowers.co.uk",
    website: "www.mooresmowers.co.uk"
  });
  
  // Theme preferences
  const { theme, setTheme: setThemePreference, resolvedTheme } = useTheme();
  
  // Job backup countdown
  const [timeUntilBackup, setTimeUntilBackup] = useState("");

  // Load company info from localStorage if available
  useEffect(() => {
    const savedCompanyInfo = localStorage.getItem('companyInfo');
    if (savedCompanyInfo) {
      try {
        setCompanyInfo(JSON.parse(savedCompanyInfo));
      } catch (error) {
        console.error('Error parsing saved company info:', error);
      }
    }
  }, []);

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

  // Query for next backup date
  const { data: nextBackupData } = useQuery<{ nextBackupDate: string }>({
    queryKey: ["/api/backup/next-backup-date"],
    refetchInterval: 60000, // Update every minute
  });

  // Mutation for sending manual backup email
  const sendBackupMutation = useMutation({
    mutationFn: async () => {
      console.log("Starting backup email send...");
      const response = await apiRequest("/api/backup/send-job-backup", { method: "POST" });
      console.log("Backup email response:", response);
      return response;
    },
    onSuccess: (data) => {
      console.log("Backup email success:", data);
      toast({
        title: "Backup email sent",
        description: "Weekly job backup email has been sent successfully to both recipients.",
      });
    },
    onError: (error) => {
      console.error("Backup email error:", error);
      toast({
        title: "Error",
        description: `Failed to send backup email: ${error?.message || 'Please try again.'}`,
        variant: "destructive",
      });
    },
  });

  // Update countdown timer
  useEffect(() => {
    if (nextBackupData?.nextBackupDate) {
      const updateCountdown = () => {
        const nextDate = new Date(nextBackupData.nextBackupDate);
        const timeLeft = formatDistanceToNow(nextDate, { addSuffix: true });
        setTimeUntilBackup(timeLeft);
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [nextBackupData]);

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
    localStorage.setItem('companyInfo', JSON.stringify(companyInfo));
    toast({
      title: "Settings saved",
      description: "Company information has been updated.",
    });
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
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input 
                    id="company-name" 
                    value={companyInfo.name} 
                    onChange={(e) => setCompanyInfo({...companyInfo, name: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-address">Address</Label>
                  <Input 
                    id="company-address" 
                    value={companyInfo.address} 
                    onChange={(e) => setCompanyInfo({...companyInfo, address: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Phone Number</Label>
                  <Input 
                    id="company-phone" 
                    value={companyInfo.phone} 
                    onChange={(e) => setCompanyInfo({...companyInfo, phone: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-email">Email Address</Label>
                  <Input 
                    id="company-email" 
                    value={companyInfo.email} 
                    onChange={(e) => setCompanyInfo({...companyInfo, email: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-website">Website</Label>
                  <Input 
                    id="company-website" 
                    value={companyInfo.website}
                    onChange={(e) => setCompanyInfo({...companyInfo, website: e.target.value})}
                  />
                </div>
                
                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={saveCompanyInfo}
                      className="bg-primary hover:bg-primary/90"
                    >
                      Save Changes
                    </Button>
                  </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-2">
                  <Label htmlFor="theme-select">Theme</Label>
                  <Select value={theme} onValueChange={(value) => setThemePreference(value as "light" | "dark" | "system")}>
                    <SelectTrigger id="theme-select">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Currently using <span className="font-semibold text-foreground">{resolvedTheme}</span> mode
                  </p>
                </div>
                
                <Separator className="my-4" />
                
                {/* Job Backup Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">Job Backup System</h3>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">Next backup email:</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {timeUntilBackup ? `${timeUntilBackup}` : 'Loading...'}
                    </p>
                    <p className="text-sm text-gray-600 mb-3">
                      Weekly job backup emails are automatically sent to matthew1111moore@gmail.com every Monday at 9 AM.
                    </p>
                    <Button
                      onClick={() => sendBackupMutation.mutate()}
                      disabled={sendBackupMutation.isPending}
                      className="bg-primary/90 hover:bg-primary"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {sendBackupMutation.isPending ? 'Sending...' : 'Send Backup Now'}
                    </Button>
                  </div>
                </div>
                
                <div className="pt-4 flex justify-end">
                  <Button className="bg-primary hover:bg-primary/90">
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