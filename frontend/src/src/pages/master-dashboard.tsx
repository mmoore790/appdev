import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { 
  Building2, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  UserPlus,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Business {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  subscriptionTier?: string | null;
  userLimit?: number | null;
  textCredits?: number;
  isActive: boolean;
  createdAt: string;
  userCount?: number;
  activeUserCount?: number;
}

interface Analytics {
  businesses?: {
    total?: number;
    active?: number;
  };
  users?: {
    total?: number;
    active?: number;
    byRole?: {
      master?: number;
      admin?: number;
      staff?: number;
      mechanic?: number;
    };
  };
}

interface User {
  id: number;
  username: string;
  email?: string;
  fullName: string;
  role: string;
  businessId: number;
  businessName?: string;
  isActive: boolean;
  createdAt: string;
}

interface Overview {
  businesses: {
    active: number;
    inactive: number;
    total: number;
  };
  users: {
    master: number;
    admin: number;
    staff: number;
    mechanic: number;
    total: number;
  };
}


export default function MasterDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("businesses");
  const [businessDialogOpen, setBusinessDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [deleteBusinessDialogOpen, setDeleteBusinessDialogOpen] = useState(false);
  const [permanentDeleteBusinessDialogOpen, setPermanentDeleteBusinessDialogOpen] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);
  const [showInactiveBusinesses, setShowInactiveBusinesses] = useState(false);
  const [userViewMode, setUserViewMode] = useState<"all" | "business">("all");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [selectedBusinessForUsers, setSelectedBusinessForUsers] = useState<number | null>(null);

  // Form state
  const [businessForm, setBusinessForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    subscriptionTier: "",
    userLimit: "",
    textCredits: "",
  });

  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    fullName: "",
    password: "",
    role: "staff",
    businessId: ""
  });

  // Fetch data with error handling
  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery<Overview>({
    queryKey: ["/api/master/dashboard/overview"],
    retry: 1,
  });

  const { data: businesses = [], isLoading: businessesLoading, error: businessesError } = useQuery<Business[]>({
    queryKey: ["/api/master/businesses"],
    retry: 1,
  });

  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<User[]>({
    queryKey: ["/api/master/users"],
    retry: 1,
  });

  const { data: analytics, error: analyticsError } = useQuery<Analytics>({
    queryKey: ["/api/master/analytics"],
    retry: 1,
  });

  const selectedBusiness = selectedBusinessId && businesses
    ? businesses.find((business) => business.id === selectedBusinessId) || null
    : null;
  // Determine which users to display based on view mode
  const allUsers = Array.isArray(users) ? users : [];
  const activeAllUsers = allUsers.filter((user) => user?.isActive);
  
  // Business users for the selected business (for business view)
  const businessUsersForView = selectedBusinessForUsers && Array.isArray(users)
    ? users.filter((user) => user?.businessId === selectedBusinessForUsers)
    : [];
  const activeBusinessUsersForView = businessUsersForView.filter((user) => user?.isActive);
  
  // Base users based on view mode (exclude master users from business/user management views)
  const rawBaseUsers = userViewMode === "all" 
    ? (showInactiveUsers ? allUsers : activeAllUsers)
    : (showInactiveUsers ? businessUsersForView : activeBusinessUsersForView);
  const baseUsers = Array.isArray(rawBaseUsers)
    ? rawBaseUsers.filter((user) => user?.role !== "master")
    : [];
  
  // Apply search filter
  const searchFilteredUsers = userSearchQuery && baseUsers.length > 0
    ? baseUsers.filter((user) => 
        user?.username?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        user?.fullName?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        user?.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        user?.businessName?.toLowerCase().includes(userSearchQuery.toLowerCase())
      )
    : baseUsers;
  
  // Apply role filter
  const roleFilteredUsers = userRoleFilter === "all"
    ? searchFilteredUsers
    : searchFilteredUsers.filter((user) => user?.role === userRoleFilter);

  const displayedAllUsers = Array.isArray(roleFilteredUsers)
    ? roleFilteredUsers.filter((user) => user?.role !== "master")
    : [];
  
  // For backward compatibility with business selection
  const businessUsers = selectedBusinessId && Array.isArray(users)
    ? users.filter((user) => user?.businessId === selectedBusinessId)
    : [];
  const activeBusinessUsers = businessUsers.filter((user) => user?.isActive);

  useEffect(() => {
    if (businesses.length === 0) {
      setSelectedBusinessId(null);
      return;
    }

    const hasSelection = selectedBusinessId && businesses.some((biz) => biz.id === selectedBusinessId);
    if (!hasSelection) {
      setSelectedBusinessId(businesses[0].id);
    }
  }, [businesses, selectedBusinessId]);

  useEffect(() => {
    if (!editingUser && selectedBusinessId) {
      setUserForm((prev) => ({
        ...prev,
        businessId: selectedBusinessId.toString(),
      }));
    }
  }, [editingUser, selectedBusinessId]);

  // Mutations
  const createBusinessMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/master/businesses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master/businesses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/dashboard/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/analytics"] });
      setBusinessDialogOpen(false);
      setEditingBusiness(null);
      setBusinessForm({ name: "", email: "", phone: "", address: "", subscriptionTier: "", userLimit: "", textCredits: "" });
      toast({
        title: "Success",
        description: "Business created successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.response?.data?.message || "Failed to create business";
      toast({
        title: "Error Creating Business",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateBusinessMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/master/businesses/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master/businesses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/dashboard/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/analytics"] });
      setBusinessDialogOpen(false);
      setEditingBusiness(null);
      setBusinessForm({ name: "", email: "", phone: "", address: "", subscriptionTier: "", userLimit: "", textCredits: "" });
      toast({
        title: "Success",
        description: "Business updated successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.response?.data?.message || "Failed to update business";
      toast({
        title: "Error Updating Business",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteBusinessMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/master/businesses/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master/businesses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/dashboard/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/analytics"] });
      setDeleteBusinessDialogOpen(false);
      setSelectedBusinessId(null);
      toast({
        title: "Success",
        description: "Business deactivated successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.response?.data?.message || "Failed to deactivate business";
      toast({
        title: "Error Deactivating Business",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const permanentDeleteBusinessMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/master/businesses/${id}/permanent`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master/businesses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/dashboard/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/users"] });
      setPermanentDeleteBusinessDialogOpen(false);
      setSelectedBusinessId(null);
      toast({
        title: "Success",
        description: "Business and all data permanently deleted",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.response?.data?.message || "Failed to delete business";
      toast({
        title: "Error Deleting Business",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/master/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/dashboard/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/businesses"] }); // Refresh to update user counts
      setUserDialogOpen(false);
      setEditingUser(null);
      setUserForm({ 
        username: "", 
        email: "", 
        fullName: "", 
        password: "", 
        role: "staff", 
        businessId: selectedBusinessId ? selectedBusinessId.toString() : "" 
      });
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.response?.data?.message || "Failed to create user";
      toast({
        title: "Error Creating User",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/master/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/dashboard/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/businesses"] }); // Refresh to update user counts
      setUserDialogOpen(false);
      setEditingUser(null);
      setUserForm({ 
        username: "", 
        email: "", 
        fullName: "", 
        password: "", 
        role: "staff", 
        businessId: selectedBusinessId ? selectedBusinessId.toString() : "" 
      });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.response?.data?.message || "Failed to update user";
      toast({
        title: "Error Updating User",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/master/users/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/dashboard/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master/businesses"] }); // Refresh to update user counts
      setDeleteUserDialogOpen(false);
      setSelectedUserId(null);
      toast({
        title: "Success",
        description: "User deactivated successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.response?.data?.message || "Failed to deactivate user";
      toast({
        title: "Error Deactivating User",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });


  const handleOpenBusinessDialog = (business?: Business) => {
    if (business) {
      setEditingBusiness(business);
      setBusinessForm({
        name: business.name,
        email: business.email || "",
        phone: business.phone || "",
        address: business.address || "",
        subscriptionTier: business.subscriptionTier ?? "",
        userLimit: business.userLimit != null ? String(business.userLimit) : "",
        textCredits: (business.textCredits ?? 0).toString(),
      });
    } else {
      setEditingBusiness(null);
      setBusinessForm({ name: "", email: "", phone: "", address: "", subscriptionTier: "", userLimit: "", textCredits: "" });
    }
    setBusinessDialogOpen(true);
  };

  const handleSelectBusiness = (business: Business) => {
    setSelectedBusinessId(business.id);
    setActiveTab("businesses");
  };

  const handleOpenUserDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        username: user.username,
        email: user.email || "",
        fullName: user.fullName,
        password: "",
        role: user.role,
        businessId: user.businessId.toString()
      });
      setUserDialogOpen(true);
      return;
    }

    // For new users, pre-select business if one is selected, otherwise allow them to choose
    setEditingUser(null);
    setUserForm({ 
      username: "", 
      email: "", 
      fullName: "", 
      password: "", 
      role: "staff", 
      businessId: selectedBusinessId ? selectedBusinessId.toString() : "" 
    });
    setUserDialogOpen(true);
  };

  const handleSubmitBusiness = () => {
    // Validate business name
    if (!businessForm.name || !businessForm.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Business name is required",
        variant: "destructive",
      });
      return;
    }

    // Validate email format if provided
    if (businessForm.email && businessForm.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(businessForm.email.trim())) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid email address",
          variant: "destructive",
        });
        return;
      }
    }

    // Trim all string fields; parse userLimit as number
    const userLimitNum = businessForm.userLimit.trim() === "" ? undefined : parseInt(businessForm.userLimit.trim(), 10);
    if (businessForm.userLimit.trim() !== "" && (isNaN(userLimitNum!) || userLimitNum! < 0)) {
      toast({
        title: "Validation Error",
        description: "User limit must be a non-negative number",
        variant: "destructive",
      });
      return;
    }
    // Parse textCredits (default 0 if empty)
    const textCreditsNum = businessForm.textCredits.trim() === "" ? 0 : parseInt(businessForm.textCredits.trim(), 10);
    if (businessForm.textCredits.trim() !== "" && (isNaN(textCreditsNum) || textCreditsNum < 0)) {
      toast({
        title: "Validation Error",
        description: "Text credits must be a non-negative number",
        variant: "destructive",
      });
      return;
    }
    const cleanedData = {
      name: businessForm.name.trim(),
      email: businessForm.email.trim() || undefined,
      phone: businessForm.phone.trim() || undefined,
      address: businessForm.address.trim() || undefined,
      subscriptionTier: businessForm.subscriptionTier.trim() || undefined,
      userLimit: userLimitNum,
      textCredits: textCreditsNum,
    };

    if (editingBusiness) {
      updateBusinessMutation.mutate({ id: editingBusiness.id, data: cleanedData });
    } else {
      createBusinessMutation.mutate(cleanedData);
    }
  };

  const handleSubmitUser = () => {
    // Validate required fields with specific error messages
    if (!userForm.username?.trim()) {
      toast({
        title: "Validation Error",
        description: "Username is required",
        variant: "destructive",
      });
      return;
    }

    // Validate username format (alphanumeric and underscore, 3-30 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(userForm.username.trim())) {
      toast({
        title: "Validation Error",
        description: "Username must be 3-30 characters and contain only letters, numbers, and underscores",
        variant: "destructive",
      });
      return;
    }

    if (!userForm.email?.trim()) {
      toast({
        title: "Validation Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userForm.email.trim())) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (!userForm.fullName?.trim()) {
      toast({
        title: "Validation Error",
        description: "Full name is required",
        variant: "destructive",
      });
      return;
    }

    if (!userForm.businessId || userForm.businessId === "") {
      toast({
        title: "Validation Error",
        description: "Please select a business",
        variant: "destructive",
      });
      return;
    }

    if (!editingUser && !userForm.password?.trim()) {
      toast({
        title: "Validation Error",
        description: "Password is required for new users",
        variant: "destructive",
      });
      return;
    }

    // Validate password strength for new users
    if (!editingUser && userForm.password && userForm.password.trim().length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    // Validate password strength for updates (if provided)
    if (editingUser && userForm.password && userForm.password.trim().length > 0 && userForm.password.trim().length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    const businessIdNum = parseInt(userForm.businessId);
    if (isNaN(businessIdNum)) {
      toast({
        title: "Validation Error",
        description: "Invalid business selection. Please select a business again.",
        variant: "destructive",
      });
      return;
    }

    const data: any = {
      username: userForm.username.trim(),
      email: userForm.email.trim(),
      fullName: userForm.fullName.trim(),
      role: userForm.role,
      businessId: businessIdNum,
    };

    // Only include password if it's provided and not empty
    if (userForm.password?.trim()) {
      data.password = userForm.password.trim();
    }

    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data });
    } else {
      createUserMutation.mutate(data);
    }
  };


  const activeBusinesses = Array.isArray(businesses) ? businesses.filter(b => b?.isActive) : [];
  const displayedBusinesses = showInactiveBusinesses ? (Array.isArray(businesses) ? businesses : []) : activeBusinesses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Master Dashboard</h1>
          <p className="text-muted-foreground">
            Platform-wide overview and management
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/master/dashboard/overview"] });
            queryClient.invalidateQueries({ queryKey: ["/api/master/businesses"] });
            queryClient.invalidateQueries({ queryKey: ["/api/master/users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/master/analytics"] });
            toast({
              title: "Refreshing data",
              description: "All data is being refreshed...",
            });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {(overviewError || businessesError || usersError) && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <span className="font-semibold">Error loading data:</span>
              <span className="text-sm">
                {overviewError?.message || businessesError?.message || usersError?.message || "Unknown error"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Stats */}
      {overviewLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : overviewError ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Failed to load overview data. Please refresh the page.
            </div>
          </CardContent>
        </Card>
      ) : overview ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Businesses</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.businesses.total}</div>
              <p className="text-xs text-muted-foreground">
                {overview.businesses.active} active{overview.businesses.inactive > 0 ? `, ${overview.businesses.inactive} inactive` : ''}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.users.total}</div>
              <p className="text-xs text-muted-foreground">
                {overview.users.admin} admins, {overview.users.staff} staff, {overview.users.mechanic} mechanics
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="businesses">Businesses</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button onClick={() => handleOpenBusinessDialog()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Business
            </Button>
            <Button
              onClick={() => handleOpenUserDialog()}
              size="sm"
              variant="outline"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        <TabsContent value="businesses" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Businesses</CardTitle>
                  <CardDescription>
                    Manage businesses and their access. Showing {displayedBusinesses.length} of {businesses?.length || 0} businesses.
                  </CardDescription>
                </div>
                {businesses && businesses.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="show-inactive-businesses" className="text-sm cursor-pointer">
                      Show inactive
                    </Label>
                    <input
                      id="show-inactive-businesses"
                      type="checkbox"
                      checked={showInactiveBusinesses}
                      onChange={(e) => setShowInactiveBusinesses(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {businessesLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading businesses...</p>
                </div>
              ) : businessesError ? (
                <div className="text-center py-8 text-destructive">
                  <p className="font-semibold">Error loading businesses</p>
                  <p className="text-sm mt-1">{businessesError?.message || "Unknown error"}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedBusinesses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {showInactiveBusinesses 
                            ? "No businesses found" 
                            : "No active businesses found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedBusinesses.map((business) => (
                        <TableRow
                          key={business.id}
                          onClick={() => handleSelectBusiness(business)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            selectedBusinessId === business.id
                              ? "bg-emerald-50/80"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <TableCell className="font-medium flex items-center gap-2">
                            {business.name}
                            {selectedBusinessId === business.id && (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                                Selected
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{business.email || "-"}</TableCell>
                          <TableCell>{business.userCount || 0}</TableCell>
                          <TableCell>
                            <Badge variant={business.isActive ? "default" : "secondary"}>
                              {business.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(business.createdAt), "MMM d, yyyy")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedBusinessId(business.id);
                                  setActiveTab("users");
                                }}
                              >
                                View team
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenBusinessDialog(business);
                                }}
                                title="Edit business"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {business.isActive ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedBusinessId(business.id);
                                    setDeleteBusinessDialogOpen(true);
                                  }}
                                  title="Deactivate business"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedBusinessId(business.id);
                                      setPermanentDeleteBusinessDialogOpen(true);
                                    }}
                                    title="Permanently delete business"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Selected Business Overview</CardTitle>
                <CardDescription>
                  {selectedBusiness
                    ? `Live data for ${selectedBusiness.name}`
                    : "Select a business to view its profile and team activity."}
                </CardDescription>
              </div>
              {selectedBusiness && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenBusinessDialog(selectedBusiness)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit details
                  </Button>
                  <Button size="sm" onClick={() => setActiveTab("users")}>
                    <Users className="h-4 w-4 mr-2" />
                    Manage team
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!selectedBusiness ? (
                <p className="text-sm text-muted-foreground">
                  Choose a business from the table above to review its contact information, activity, and workforce.
                </p>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="text-2xl font-semibold text-slate-900">{selectedBusiness.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedBusiness.address || "No address on file"}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border bg-slate-50/60 p-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total users</p>
                      <p className="text-2xl font-semibold text-slate-900">{businessUsers.length}</p>
                    </div>
                    <div className="rounded-xl border bg-slate-50/60 p-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active users</p>
                      <p className="text-2xl font-semibold text-emerald-700">{activeBusinessUsers.length}</p>
                    </div>
                    <div className="rounded-xl border bg-slate-50/60 p-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created</p>
                      <p className="text-2xl font-semibold text-slate-900">
                        {format(new Date(selectedBusiness.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-slate-700">Primary email</p>
                      <p className="text-muted-foreground">{selectedBusiness.email || "Not provided"}</p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-slate-700">Primary phone</p>
                      <p className="text-muted-foreground">{selectedBusiness.phone || "Not provided"}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Users</CardTitle>
                    <CardDescription>
                      Manage all users across the platform. Showing {displayedAllUsers.length} of {allUsers.length} user{allUsers.length !== 1 ? 's' : ''}.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="show-inactive-all" className="text-sm cursor-pointer">
                      Show inactive
                    </Label>
                    <input
                      id="show-inactive-all"
                      type="checkbox"
                      checked={showInactiveUsers}
                      onChange={(e) => setShowInactiveUsers(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </div>
                </div>
                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Search by name, username, email, or business..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="w-[180px]">
                    <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="master">Master</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="mechanic">Mechanic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading users...</p>
                </div>
              ) : usersError ? (
                <div className="text-center py-8 text-destructive">
                  <p className="font-semibold">Error loading users</p>
                  <p className="text-sm mt-1">{usersError?.message || "Unknown error"}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Business</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedAllUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          {userSearchQuery || userRoleFilter !== "all"
                            ? "No users match your filters"
                            : showInactiveUsers 
                              ? "No users found" 
                              : "No active users found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedAllUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.fullName}</TableCell>
                          <TableCell>{user.email || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {user.businessName || "Unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(newRole) => {
                                updateUserMutation.mutate({
                                  id: user.id,
                                  data: { role: newRole }
                                });
                              }}
                              disabled={updateUserMutation.isPending}
                            >
                              <SelectTrigger className="w-[120px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="staff">Staff</SelectItem>
                                <SelectItem value="mechanic">Mechanic</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? "default" : "secondary"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(user.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenUserDialog(user)}
                                title="Edit user"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {user.isActive ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedUserId(user.id);
                                    setDeleteUserDialogOpen(true);
                                  }}
                                  title="Deactivate user"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    updateUserMutation.mutate({
                                      id: user.id,
                                      data: { isActive: true }
                                    });
                                  }}
                                  disabled={updateUserMutation.isPending}
                                  title="Activate user"
                                >
                                  Activate
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Business Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsError ? (
                  <div className="text-center py-8 text-destructive">
                    <p className="font-semibold">Error loading analytics</p>
                    <p className="text-sm mt-1">{analyticsError?.message || "Unknown error"}</p>
                  </div>
                ) : analytics ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Businesses</p>
                      <p className="text-2xl font-bold">{analytics.businesses?.total || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Businesses</p>
                      <p className="text-2xl font-bold">{analytics.businesses?.active || 0}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>User Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsError ? (
                  <div className="text-center py-8 text-destructive">
                    <p className="font-semibold">Error loading analytics</p>
                    <p className="text-sm mt-1">{analyticsError?.message || "Unknown error"}</p>
                  </div>
                ) : analytics ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Users</p>
                      <p className="text-2xl font-bold">{analytics.users?.total || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Users</p>
                      <p className="text-2xl font-bold">{analytics.users?.active || 0}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Masters</p>
                        <p className="text-lg font-semibold">{analytics.users?.byRole?.master || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Admins</p>
                        <p className="text-lg font-semibold">{analytics.users?.byRole?.admin || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Staff</p>
                        <p className="text-lg font-semibold">{analytics.users?.byRole?.staff || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Mechanics</p>
                        <p className="text-lg font-semibold">{analytics.users?.byRole?.mechanic || 0}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>



    {/* Business Dialog */}
      <Dialog open={businessDialogOpen} onOpenChange={setBusinessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBusiness ? "Edit Business" : "Create Business"}</DialogTitle>
            <DialogDescription>
              {editingBusiness ? "Update business information" : "Add a new business to the platform"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Business Name *</Label>
              <Input
                id="name"
                value={businessForm.name}
                onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })}
                placeholder="Business name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={businessForm.email}
                onChange={(e) => setBusinessForm({ ...businessForm, email: e.target.value })}
                placeholder="business@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={businessForm.phone}
                onChange={(e) => setBusinessForm({ ...businessForm, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={businessForm.address}
                onChange={(e) => setBusinessForm({ ...businessForm, address: e.target.value })}
                placeholder="Business address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subscription">Subscription</Label>
              <Select
                value={businessForm.subscriptionTier || undefined}
                onValueChange={(value) => setBusinessForm({ ...businessForm, subscriptionTier: value })}
              >
                <SelectTrigger id="subscription">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Starter">Starter</SelectItem>
                  <SelectItem value="Pro">Pro</SelectItem>
                  <SelectItem value="Pro Plus">Pro Plus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="userLimit">User Limit</Label>
              <Input
                id="userLimit"
                type="number"
                min={0}
                value={businessForm.userLimit}
                onChange={(e) => setBusinessForm({ ...businessForm, userLimit: e.target.value })}
                placeholder="e.g. 5"
              />
              <p className="text-xs text-muted-foreground">Maximum number of users allowed on this account. Leave blank for no limit.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="textCredits">Text Credits</Label>
              <Input
                id="textCredits"
                type="number"
                min={0}
                value={businessForm.textCredits}
                onChange={(e) => setBusinessForm({ ...businessForm, textCredits: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">Number of text/SMS credits allocated. Default is 0. Optional.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBusinessDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitBusiness}
              disabled={createBusinessMutation.isPending || updateBusinessMutation.isPending}
            >
              {createBusinessMutation.isPending || updateBusinessMutation.isPending ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {editingBusiness ? "Updating..." : "Creating..."}
                </>
              ) : (
                editingBusiness ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Dialog */}
      <Dialog 
        open={userDialogOpen} 
        onOpenChange={(open) => {
          setUserDialogOpen(open);
          if (!open) {
            // Reset form when dialog closes
            setEditingUser(null);
            setUserForm({ 
              username: "", 
              email: "", 
              fullName: "", 
              password: "", 
              role: "staff", 
              businessId: selectedBusinessId ? selectedBusinessId.toString() : "" 
            });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Create User"}</DialogTitle>
            <DialogDescription>
              {editingUser 
                ? "Update user information. Leave password blank to keep the current password. You can change the user's business, role, and other details." 
                : "Add a new user to the platform. Select a business from the dropdown below. All fields marked with * are required."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                placeholder="Username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={userForm.fullName}
                onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password {editingUser ? "(leave blank to keep current)" : "*"}</Label>
              <Input
                id="password"
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="Password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="businessId">Business *</Label>
              {activeBusinesses.length === 0 ? (
                <div className="rounded-md border border-dashed border-muted-foreground/25 p-4 text-center text-sm text-muted-foreground">
                  No active businesses available. Please create a business first.
                </div>
              ) : (
              <Select
                  value={userForm.businessId || undefined}
                onValueChange={(value) => setUserForm({ ...userForm, businessId: value })}
              >
                <SelectTrigger>
                    <SelectValue placeholder={selectedBusinessId ? "Select business" : "Select a business"} />
                </SelectTrigger>
                <SelectContent>
                  {activeBusinesses.map((business) => (
                    <SelectItem key={business.id} value={business.id.toString()}>
                      {business.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={userForm.role}
                onValueChange={(value) => setUserForm({ ...userForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="mechanic">Mechanic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitUser}
              disabled={createUserMutation.isPending || updateUserMutation.isPending}
            >
              {createUserMutation.isPending || updateUserMutation.isPending ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {editingUser ? "Updating..." : "Creating..."}
                </>
              ) : (
                editingUser ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Business Dialog */}
      <AlertDialog open={deleteBusinessDialogOpen} onOpenChange={setDeleteBusinessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Business?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will deactivate the business <strong>{selectedBusiness?.name}</strong> and prevent new logins. All existing data will be preserved and can be reactivated later.
              </p>
              {selectedBusiness && businessUsers.length > 0 && (
                <p className="text-orange-600 font-semibold mt-3 pt-3 border-t border-orange-200">
                  ⚠️ Warning: This will also deactivate all {businessUsers.length} user{businessUsers.length !== 1 ? 's' : ''} associated with this business. 
                  They will no longer be able to log in to the system.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteBusinessDialogOpen(false);
                setPermanentDeleteBusinessDialogOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              Delete Permanently Instead
            </Button>
            <AlertDialogAction
              onClick={() => selectedBusinessId && deleteBusinessMutation.mutate(selectedBusinessId)}
              disabled={deleteBusinessMutation.isPending}
              className="bg-orange-600 text-white hover:bg-orange-700 w-full sm:w-auto"
            >
              {deleteBusinessMutation.isPending ? "Deactivating..." : `Deactivate Business${selectedBusiness && businessUsers.length > 0 ? ` and ${businessUsers.length} User${businessUsers.length !== 1 ? 's' : ''}` : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanently Delete Business Dialog */}
      <AlertDialog open={permanentDeleteBusinessDialogOpen} onOpenChange={setPermanentDeleteBusinessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Permanently Delete Business?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-semibold text-destructive">
                ⚠️ DANGER: This action cannot be undone!
              </p>
              <p>
                This will <strong>permanently delete</strong> the business <strong>{selectedBusiness?.name}</strong> and <strong>ALL associated data</strong>, including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                {selectedBusiness && businessUsers.length > 0 && (
                  <li><strong>{businessUsers.length} user{businessUsers.length !== 1 ? 's' : ''}</strong></li>
                )}
                <li>All customers and their records</li>
                <li>All jobs and job history</li>
                <li>All equipment records</li>
                <li>All tasks, services, and time entries</li>
                <li>All payment records</li>
                <li>All messages and notifications</li>
                <li>All other business data</li>
              </ul>
              <p className="text-destructive font-semibold pt-2 border-t border-destructive/20">
                This data will be permanently lost and cannot be recovered.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setPermanentDeleteBusinessDialogOpen(false);
                setDeleteBusinessDialogOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              Deactivate Instead
            </Button>
            <AlertDialogAction
              onClick={() => selectedBusinessId && permanentDeleteBusinessMutation.mutate(selectedBusinessId)}
              disabled={permanentDeleteBusinessMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
            >
              {permanentDeleteBusinessMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the user and prevent them from logging in. Their data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUserId && deleteUserMutation.mutate(selectedUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

