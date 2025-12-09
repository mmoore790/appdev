import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Phone, MapPin, FileText, Send, Calendar, User, MessageSquare, Pencil, ExternalLink, Briefcase, PhoneCall, Package, Plus, Shield, ShieldCheck, ShieldX, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerForm } from "@/components/customer-form";
import { AssetForm } from "@/components/asset-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type CustomerDetails = {
  customer: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
  };
  emailHistory: Array<{
    id: number;
    subject: string;
    body: string;
    emailType: string;
    sentAt: string;
    sentBy: number | null;
    metadata: any;
  }>;
  callbacks: Array<{
    id: number;
    customerName: string;
    phoneNumber: string;
    subject: string;
    details?: string | null;
    status: string;
    priority: string;
    requestedAt: string;
    completedAt?: string | null;
    assignedTo?: number | null;
    notes?: string | null;
  }>;
  jobs: Array<{
    id: number;
    jobId: string;
    description: string;
    status: string;
    createdAt: string;
    completedAt?: string | null;
    customerId?: number | null;
  }>;
};

export default function CustomerDetailPage() {
  // Try both route patterns - details route first, then fallback to simple id route
  const [matchDetails, paramsDetails] = useRoute<{ id: string }>("/customers/:id/details");
  const [matchSimple, paramsSimple] = useRoute<{ id: string }>("/customers/:id");
  const [location, setLocation] = useLocation();
  
  // Get params from whichever route matched (prefer details route)
  const params = matchDetails ? paramsDetails : (matchSimple ? paramsSimple : null);
  
  // Fallback: parse ID from URL if route didn't match
  let customerId: number | null = null;
  if (params?.id) {
    customerId = parseInt(params.id, 10);
  } else {
    // Try to extract from URL manually
    const match = location.match(/\/customers\/(\d+)(?:\/details)?/);
    if (match && match[1]) {
      customerId = parseInt(match[1], 10);
    }
  }
  
  // State declarations (must be before early returns)
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCallback, setSelectedCallback] = useState<any>(null);
  const [isCallbackDetailOpen, setIsCallbackDetailOpen] = useState(false);
  const [isCreateCallbackDialogOpen, setIsCreateCallbackDialogOpen] = useState(false);
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false);
  const [equipmentPendingDelete, setEquipmentPendingDelete] = useState<{
    id: number;
    serialNumber: string;
    makeModel?: string | null;
  } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Callback form schema
  const callbackFormSchema = z.object({
    customerId: z.coerce.number().optional(),
    customerName: z.string().min(2, {
      message: "Customer name is required"
    }),
    phoneNumber: z.string().min(5, "Phone number is required"),
    subject: z.string().min(3, "Subject is required"),
    details: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high'], {
      required_error: "Priority is required"
    }),
    assignedTo: z.coerce.number().optional().nullable(),
    status: z.enum(['pending', 'completed']).default('pending')
  });

  type CallbackFormValues = z.infer<typeof callbackFormSchema>;

  // Callback form
  const callbackForm = useForm<CallbackFormValues>({
    resolver: zodResolver(callbackFormSchema),
    defaultValues: {
      customerName: "",
      phoneNumber: "",
      subject: "",
      details: "",
      priority: "medium",
      status: "pending",
      customerId: undefined,
      assignedTo: null,
    },
  });

  // Fetch customer data first (before using it in other hooks/functions)
  const { data, isLoading, isError } = useQuery<CustomerDetails>({
    queryKey: ["/api/customers", customerId, "details"],
    queryFn: () => apiRequest<CustomerDetails>("GET", `/api/customers/${customerId}/details`),
    enabled: !!customerId,
  });

  // Fetch equipment/assets for this customer
  const { data: equipment = [], isLoading: isLoadingEquipment } = useQuery<Array<{
    id: number;
    serialNumber: string;
    make?: string | null;
    model?: string | null;
    purchaseDate?: string | null;
    warrantyDurationMonths?: number | null;
    warrantyExpiryDate?: string | null;
    notes?: string | null;
  }>>({
    queryKey: ["/api/equipment/customer", customerId],
    queryFn: () => apiRequest("GET", `/api/equipment/customer/${customerId}`),
    enabled: !!customerId,
  });

  // Delete equipment mutation
  const deleteEquipmentMutation = useMutation({
    mutationFn: async (equipmentId: number) => {
      await apiRequest("DELETE", `/api/equipment/${equipmentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Equipment deleted",
        description: "The equipment has been successfully removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment/customer", customerId] });
      setEquipmentPendingDelete(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to delete equipment.";
      toast({
        title: "Failed to delete equipment",
        description: message,
        variant: "destructive",
      });
    },
  });

  const confirmDeleteEquipment = () => {
    if (!equipmentPendingDelete) return;
    deleteEquipmentMutation.mutate(equipmentPendingDelete.id);
  };

  // Fetch users for assignee dropdown
  const { data: usersData } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users"),
  });

  const users = Array.isArray(usersData) ? usersData : [];

  // Create callback mutation
  const createCallbackMutation = useMutation({
    mutationFn: async (data: CallbackFormValues) => {
      return apiRequest("POST", "/api/callbacks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/callbacks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "details"] });
      toast({
        title: "Success",
        description: "Callback request created successfully",
      });
      setIsCreateCallbackDialogOpen(false);
      callbackForm.reset();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to create callback request";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Open create callback dialog with pre-populated data
  const handleOpenCreateCallback = () => {
    if (data?.customer) {
      callbackForm.reset({
        customerId: data.customer.id,
        customerName: data.customer.name,
        phoneNumber: data.customer.phone || "",
        subject: "",
        details: "",
        priority: "medium",
        status: "pending",
        assignedTo: null,
      });
      setIsCreateCallbackDialogOpen(true);
    }
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!isCreateCallbackDialogOpen && data?.customer) {
      callbackForm.reset({
        customerId: data.customer.id,
        customerName: data.customer.name,
        phoneNumber: data.customer.phone || "",
        subject: "",
        details: "",
        priority: "medium",
        status: "pending",
        assignedTo: null,
      });
    }
  }, [isCreateCallbackDialogOpen, data?.customer]);

  const handleCreateCallback = (values: CallbackFormValues) => {
    createCallbackMutation.mutate(values);
  };

  // Fetch full callback details when one is selected
  const { data: callbackDetails } = useQuery<{
    id: number;
    customerName: string;
    phoneNumber: string;
    subject: string;
    details?: string | null;
    status: string;
    priority: string;
    requestedAt: string;
    completedAt?: string | null;
    notes?: string | null;
  }>({
    queryKey: ["/api/callbacks", selectedCallback?.id],
    queryFn: () => apiRequest("GET", `/api/callbacks/${selectedCallback?.id}`),
    enabled: !!selectedCallback?.id && isCallbackDetailOpen,
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiRequest("PUT", `/api/customers/${customerId}`, payload);
    },
    onSuccess: () => {
      toast({
        title: "Customer updated",
        description: "The customer has been successfully updated.",
      });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "details"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to update customer.";
      toast({
        title: "Failed to update customer",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleViewCallback = (callback: any) => {
    setSelectedCallback(callback);
    setIsCallbackDetailOpen(true);
  };

  const sendEmailMutation = useMutation({
    mutationFn: async ({ subject, body }: { subject: string; body: string }) => {
      return apiRequest("POST", `/api/customers/${customerId}/send-email`, { subject, body });
    },
    onSuccess: () => {
      toast({
        title: "Email sent",
        description: "The email has been sent successfully.",
      });
      setIsEmailDialogOpen(false);
      setEmailSubject("");
      setEmailBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "details"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to send email.";
      toast({
        title: "Failed to send email",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleSendEmail = () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast({
        title: "Validation error",
        description: "Subject and body are required.",
        variant: "destructive",
      });
      return;
    }
    sendEmailMutation.mutate({ subject: emailSubject, body: emailBody });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-4 sm:py-6 md:py-8 px-3 sm:px-4">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mx-auto py-4 sm:py-6 md:py-8 px-3 sm:px-4">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-red-600">Failed to load customer details.</p>
            <Button onClick={() => setLocation("/customers")} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Customers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { customer, emailHistory, callbacks, jobs = [] } = data;

  return (
    <div className="container mx-auto py-4 sm:py-6 md:py-8 px-3 sm:px-4">
      <div className="mb-4">
        <Button variant="ghost" onClick={() => setLocation("/customers")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Customers
        </Button>
      </div>

      <PageHeader
        title={customer.name}
        description="Customer details and contact history"
        icon={<User className="h-6 w-6" />}
      />

      {/* Equipment/Assets Section */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Registered Equipment
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Register new machinery/equipment for this customer, and automatically track its warranty status
              </p>
            </div>
            <Dialog open={isAssetDialogOpen} onOpenChange={setIsAssetDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9">
                  <Plus className="mr-2 h-4 w-4" />
                  Register New Equipment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                {customerId != null && (
                  <AssetForm
                    customerId={customerId}
                    onComplete={() => {
                      setIsAssetDialogOpen(false);
                      queryClient.invalidateQueries({ queryKey: ["/api/equipment/customer", customerId] });
                    }}
                    onCancel={() => setIsAssetDialogOpen(false)}
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingEquipment ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : equipment.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No equipment registered for this customer yet.</p>
              <p className="text-sm mt-2">Click "Register New Equipment" to add equipment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipment.map((asset) => {
                const warrantyExpiryDate = asset.warrantyExpiryDate ? new Date(asset.warrantyExpiryDate) : null;
                const isWarrantyExpired = warrantyExpiryDate ? warrantyExpiryDate < new Date() : null;
                const isWarrantyExpiringSoon = warrantyExpiryDate 
                  ? warrantyExpiryDate >= new Date() && warrantyExpiryDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  : false;

                return (
                  <Card key={asset.id} className="border-l-4 border-l-blue-500 relative group">
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="font-semibold text-sm">
                              {asset.make && asset.model ? `${asset.make} ${asset.model}` : asset.make || asset.model || "Equipment"}
                            </h4>
                            <div className="flex items-center gap-2">
                              {warrantyExpiryDate && (
                                <div className="flex items-center gap-1">
                                  {isWarrantyExpired ? (
                                    <ShieldX className="h-4 w-4 text-red-500" />
                                  ) : isWarrantyExpiringSoon ? (
                                    <Shield className="h-4 w-4 text-yellow-500" />
                                  ) : (
                                    <ShieldCheck className="h-4 w-4 text-green-500" />
                                  )}
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEquipmentPendingDelete({
                                    id: asset.id,
                                    serialNumber: asset.serialNumber,
                                    makeModel: asset.make && asset.model ? `${asset.make} ${asset.model}` : asset.make || asset.model || "Equipment",
                                  });
                                }}
                                aria-label={`Delete equipment ${asset.serialNumber}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Serial: {asset.serialNumber}
                          </p>
                        </div>

                        {asset.purchaseDate && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Purchased: </span>
                            <span>{format(new Date(asset.purchaseDate), "MMM d, yyyy")}</span>
                          </div>
                        )}

                        {warrantyExpiryDate && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Warranty: </span>
                            <span className={
                              isWarrantyExpired 
                                ? "text-red-600 font-medium"
                                : isWarrantyExpiringSoon
                                ? "text-yellow-600 font-medium"
                                : "text-green-600 font-medium"
                            }>
                              {isWarrantyExpired 
                                ? `Expired ${format(warrantyExpiryDate, "MMM d, yyyy")}`
                                : `Expires ${format(warrantyExpiryDate, "MMM d, yyyy")}`
                              }
                            </span>
                          </div>
                        )}

                        {asset.notes && (
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {asset.notes}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Customer Info Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Customer Information</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditDialogOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.email && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-base">{customer.email}</p>
                </div>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-base">{customer.phone}</p>
                </div>
              </div>
            )}
            {customer.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Address</p>
                  <p className="text-base">{customer.address}</p>
                </div>
              </div>
            )}
            {customer.notes && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Notes</p>
                  <p className="text-base whitespace-pre-wrap">{customer.notes}</p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {customer.email && (
                <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" variant="outline">
                      <Send className="mr-2 h-4 w-4" />
                      Quick Email
                    </Button>
                  </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Send Email to {customer.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="email-subject">Subject *</Label>
                      <Input
                        id="email-subject"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Email subject"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email-body">Message *</Label>
                      <Textarea
                        id="email-body"
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        placeholder="Email message"
                        className="min-h-[200px]"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEmailDialogOpen(false);
                          setEmailSubject("");
                          setEmailBody("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSendEmail}
                        disabled={sendEmailMutation.isPending || !emailSubject.trim() || !emailBody.trim()}
                      >
                        {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              )}
              {customer.phone && (
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={handleOpenCreateCallback}
                >
                  <PhoneCall className="mr-2 h-4 w-4" />
                  Create Callback
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contact History</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="emails" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="emails">
                  <Mail className="mr-2 h-4 w-4" />
                  Emails ({emailHistory.length})
                </TabsTrigger>
                <TabsTrigger value="callbacks">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Callbacks ({callbacks.length})
                </TabsTrigger>
                <TabsTrigger value="jobs">
                  <Briefcase className="mr-2 h-4 w-4" />
                  Jobs ({data?.jobs?.length || 0})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="emails" className="mt-4">
                {emailHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No emails sent to this customer yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {emailHistory.map((email) => (
                      <Card key={email.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">{email.subject}</h4>
                              <p className="text-sm text-muted-foreground">
                                {email.emailType === "manual" ? "Manual Email" : 
                                 email.emailType === "job_booked" ? "Job Booked" :
                                 email.emailType === "payment_request" ? "Payment Request" :
                                 email.emailType}
                              </p>
                            </div>
                            <div className="text-right text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4 inline mr-1" />
                              {format(new Date(email.sentAt), "MMM d, yyyy h:mm a")}
                            </div>
                          </div>
                          <div className="mt-3 p-3 bg-muted rounded-md">
                            <p className="text-sm whitespace-pre-wrap">{email.body}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="callbacks" className="mt-4">
                {callbacks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No callbacks for this customer.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {callbacks.map((callback) => (
                      <Card 
                        key={callback.id} 
                        className="border-l-4 border-l-green-500 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleViewCallback(callback)}
                      >
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h4 className="font-semibold">{callback.subject}</h4>
                              <p className="text-sm text-muted-foreground">
                                {callback.customerName} • {callback.phoneNumber}
                              </p>
                            </div>
                            <div className="text-right flex items-start gap-2">
                              <ExternalLink className="h-4 w-4 text-muted-foreground mt-1" />
                              <div>
                                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  callback.priority === "high" ? "bg-red-100 text-red-800" :
                                  callback.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
                                  "bg-green-100 text-green-800"
                                }`}>
                                  {callback.priority}
                                </span>
                                <p className="text-sm text-muted-foreground mt-1">
                                  <Calendar className="h-4 w-4 inline mr-1" />
                                  {format(new Date(callback.requestedAt), "MMM d, yyyy h:mm a")}
                                </p>
                              </div>
                            </div>
                          </div>
                          {callback.details && (
                            <div className="mt-3 p-3 bg-muted rounded-md">
                              <p className="text-sm whitespace-pre-wrap line-clamp-2">{callback.details}</p>
                            </div>
                          )}
                          <div className="mt-2 flex items-center justify-between">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              callback.status === "completed" ? "bg-green-100 text-green-800" :
                              "bg-yellow-100 text-yellow-800"
                            }`}>
                              {callback.status}
                            </span>
                            <p className="text-xs text-muted-foreground">Click to view full details</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="jobs" className="mt-4">
                {!data?.jobs || data.jobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No jobs found for this customer.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.jobs.map((job) => (
                      <Card 
                        key={job.id} 
                        className="border-l-4 border-l-blue-500 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setLocation(`/workshop/jobs/${job.id}`)}
                      >
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">{job.jobId}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {job.description}
                              </p>
                            </div>
                            <div className="text-right flex items-start gap-2">
                              <ExternalLink className="h-4 w-4 text-muted-foreground mt-1" />
                              <div>
                                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  job.status === "completed" ? "bg-green-100 text-green-800" :
                                  job.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                                  "bg-yellow-100 text-yellow-800"
                                }`}>
                                  {job.status}
                                </span>
                                <p className="text-sm text-muted-foreground mt-1">
                                  <Calendar className="h-4 w-4 inline mr-1" />
                                  {format(new Date(job.createdAt), "MMM d, yyyy")}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          {customerId != null && (
            <CustomerForm
              key={customerId}
              customerId={customerId}
              editMode
              onComplete={() => {
                setIsEditDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "details"] });
              }}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Callback Detail Dialog */}
      <Dialog open={isCallbackDetailOpen} onOpenChange={setIsCallbackDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Callback Details</DialogTitle>
          </DialogHeader>
          {callbackDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Customer Name</Label>
                  <p className="text-base">{callbackDetails.customerName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
                  <p className="text-base">{callbackDetails.phoneNumber}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Subject</Label>
                  <p className="text-base">{callbackDetails.subject}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Priority</Label>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    callbackDetails.priority === "high" ? "bg-red-100 text-red-800" :
                    callbackDetails.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {callbackDetails.priority}
                  </span>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    callbackDetails.status === "completed" ? "bg-green-100 text-green-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {callbackDetails.status}
                  </span>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Requested At</Label>
                  <p className="text-base">
                    {format(new Date(callbackDetails.requestedAt), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
                {callbackDetails.completedAt && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Completed At</Label>
                    <p className="text-base">
                      {format(new Date(callbackDetails.completedAt), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                )}
              </div>
              {callbackDetails.details && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Details</Label>
                  <div className="mt-2 p-3 bg-muted rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{callbackDetails.details}</p>
                  </div>
                </div>
              )}
              {callbackDetails.notes && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
                  <div className="mt-2 p-3 bg-muted rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{callbackDetails.notes}</p>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCallbackDetailOpen(false);
                    setSelectedCallback(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setIsCallbackDetailOpen(false);
                    setLocation(`/callbacks`);
                  }}
                >
                  View in Callbacks
                </Button>
              </div>
            </div>
          ) : selectedCallback ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Customer Name</Label>
                  <p className="text-base">{selectedCallback.customerName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
                  <p className="text-base">{selectedCallback.phoneNumber}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Subject</Label>
                  <p className="text-base">{selectedCallback.subject}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Priority</Label>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    selectedCallback.priority === "high" ? "bg-red-100 text-red-800" :
                    selectedCallback.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {selectedCallback.priority}
                  </span>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    selectedCallback.status === "completed" ? "bg-green-100 text-green-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {selectedCallback.status}
                  </span>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Requested At</Label>
                  <p className="text-base">
                    {format(new Date(selectedCallback.requestedAt), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
                {selectedCallback.completedAt && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Completed At</Label>
                    <p className="text-base">
                      {format(new Date(selectedCallback.completedAt), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                )}
              </div>
              {selectedCallback.details && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Details</Label>
                  <div className="mt-2 p-3 bg-muted rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{selectedCallback.details}</p>
                  </div>
                </div>
              )}
              {selectedCallback.notes && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
                  <div className="mt-2 p-3 bg-muted rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{selectedCallback.notes}</p>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCallbackDetailOpen(false);
                    setSelectedCallback(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setIsCallbackDetailOpen(false);
                    setLocation(`/callbacks`);
                  }}
                >
                  View in Callbacks
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading callback details...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Callback Dialog */}
      <Dialog open={isCreateCallbackDialogOpen} onOpenChange={setIsCreateCallbackDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Callback Request</DialogTitle>
          </DialogHeader>
          <Form {...callbackForm}>
            <form onSubmit={callbackForm.handleSubmit(handleCreateCallback)} className="space-y-4">
              <FormField
                control={callbackForm.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Customer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={callbackForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={callbackForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject *</FormLabel>
                    <FormControl>
                      <Input placeholder="Callback subject" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={callbackForm.control}
                name="details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Details</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional details about the callback request"
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={callbackForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={callbackForm.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign To</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))} 
                        value={field.value?.toString() || "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {users.map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateCallbackDialogOpen(false);
                    callbackForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createCallbackMutation.isPending}
                >
                  {createCallbackMutation.isPending ? "Creating..." : "Create Callback"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Equipment Confirmation Dialog */}
      <AlertDialog
        open={equipmentPendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !deleteEquipmentMutation.isPending) {
            setEquipmentPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Equipment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this equipment? This will permanently remove{" "}
              <strong>
                {equipmentPendingDelete?.makeModel
                  ? equipmentPendingDelete.makeModel
                  : equipmentPendingDelete?.serialNumber
                  ? `Serial ${equipmentPendingDelete.serialNumber}`
                  : "this equipment"}
              </strong>{" "}
              from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEquipmentMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteEquipment}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
              disabled={deleteEquipmentMutation.isPending}
            >
              {deleteEquipmentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

