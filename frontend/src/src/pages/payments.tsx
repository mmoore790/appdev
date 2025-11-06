import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CreditCard, ExternalLink, Copy, Check, RefreshCw, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PaymentRequest {
  id: number;
  jobId?: number;
  customerEmail: string;
  amount: number;
  currency: string;
  description: string;
  checkoutId?: string;
  checkoutReference: string;
  paymentLink?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  expiresAt?: string;
  createdBy: number;
  transactionId?: string;
  transactionCode?: string;
  authCode?: string;
}

interface Job {
  id: number;
  jobId: string;
  customerId: number;
  equipmentId: number;
  assignedTo?: number;
  priority: string;
  status: string;
  description: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
  customer?: {
    name: string;
    email?: string;
  };
  equipment?: {
    brand: string;
    model: string;
    serialNumber?: string;
  };
}

interface Customer {
  id: number;
  name: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
}

interface StripeStatus {
  configured: boolean;
  message: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800", 
  failed: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-800"
};

export default function Payments() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [copiedStates, setCopiedStates] = useState<Record<number, boolean>>({});
  const { toast } = useToast();

  // Fetch payment requests
  const { data: paymentRequests = [], isLoading: isLoadingPayments, refetch: refetchPayments } = useQuery<PaymentRequest[]>({
    queryKey: ['/api/payment-requests'],
  });

  // Fetch jobs for selection
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  // Fetch customers for email lookup
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  // Fetch Stripe configuration status
  const { data: stripeStatus } = useQuery<StripeStatus>({
    queryKey: ['/api/stripe/status'],
  });

  // Create payment request mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (data: {
      jobId?: number;
      customerEmail?: string;
      amount: number;
      currency: string;
      description: string;
    }) => {
      console.log("Sending payment data:", data);
      return apiRequest('/api/payment-requests', {
        method: 'POST',
        data: data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Payment request created",
        description: "Payment link has been generated successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating payment request",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    }
  });

  // Refresh payment status mutation
  const refreshStatusMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      return apiRequest(`/api/payment-requests/${paymentId}/status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      toast({
        title: "Status updated",
        description: "Payment status has been refreshed"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error refreshing status",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setSelectedJobId("");
    setCustomerEmail("");
    setAmount("");
    setDescription("");
  };

  const handleJobSelection = (jobId: string) => {
    setSelectedJobId(jobId === "none" ? "" : jobId);
    
    if (jobId && jobId !== "none") {
      const selectedJob = jobs.find(job => job.id === parseInt(jobId));
      if (selectedJob) {
        setCustomerEmail(selectedJob.customer?.email || "");
        setDescription(`Service payment for ${selectedJob.jobId} - ${selectedJob.equipment?.brand} ${selectedJob.equipment?.model}`);
      }
    } else {
      setCustomerEmail("");
      setDescription("");
    }
  };

  const handleCreatePayment = () => {
    if (!amount || !description || !customerEmail) {
      toast({
        title: "Missing required fields",
        description: "Please fill in amount, description, and customer email",
        variant: "destructive"
      });
      return;
    }

    const paymentData = {
      jobId: selectedJobId ? parseInt(selectedJobId) : undefined,
      customerEmail: customerEmail,
      amount: parseFloat(amount),
      currency: "GBP",
      description
    };

    createPaymentMutation.mutate(paymentData);
  };

  const copyToClipboard = async (text: string, paymentId: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [paymentId]: true }));
      toast({
        title: "Copied to clipboard",
        description: "Payment link copied successfully"
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [paymentId]: false }));
      }, 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const formatAmount = (amountInPence: number) => {
    return (amountInPence / 100).toFixed(2);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Requests</h1>
          <p className="text-muted-foreground">Generate and manage customer payment links</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Create Payment Request
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Payment Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Stripe Status Alert */}
              {stripeStatus && !stripeStatus.configured && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    Stripe integration not configured. Payment links will not be generated.
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="job-select">Link to Job (optional)</Label>
                <Select value={selectedJobId} onValueChange={handleJobSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No job selected</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id.toString()}>
                        {job.jobId} - {job.customer?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-email">Customer Email *</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (£)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Invoice #2024-001 - Service & repair work completed"
                  required
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleCreatePayment} 
                  disabled={createPaymentMutation.isPending}
                  className="flex-1"
                >
                  {createPaymentMutation.isPending ? "Creating..." : "Create Payment Request"}
                </Button>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stripe Configuration Status */}
      {stripeStatus && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {stripeStatus.configured ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">Stripe Integration Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Stripe Integration Not Configured</span>
                </div>
              )}
              <span className="text-sm text-muted-foreground ml-2">
                {stripeStatus.message}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Requests List */}
      <div className="space-y-4">
        {isLoadingPayments ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading payment requests...</p>
          </div>
        ) : paymentRequests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No payment requests yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first payment request to get started
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                Create Payment Request
              </Button>
            </CardContent>
          </Card>
        ) : (
          paymentRequests.map((payment) => (
            <Card key={payment.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">
                      £{formatAmount(payment.amount)}
                    </CardTitle>
                    <Badge className={statusColors[payment.status] || "bg-gray-100 text-gray-800"}>
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refreshStatusMutation.mutate(payment.id)}
                      disabled={refreshStatusMutation.isPending}
                    >
                      <RefreshCw className={`h-4 w-4 ${refreshStatusMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium mb-1">Description</h4>
                    <p className="text-sm text-muted-foreground">{payment.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Reference:</span>
                      <br />
                      <span className="text-muted-foreground font-mono">{payment.checkoutReference}</span>
                    </div>
                    <div>
                      <span className="font-medium">Created:</span>
                      <br />
                      <span className="text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleString('en-GB', {
                          timeZone: 'Europe/London',
                          day: '2-digit',
                          month: '2-digit', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {payment.customerEmail && (
                    <div>
                      <span className="font-medium text-sm">Customer Email:</span>
                      <br />
                      <span className="text-sm text-muted-foreground">{payment.customerEmail}</span>
                    </div>
                  )}

                  {payment.paidAt && (
                    <div>
                      <span className="font-medium text-sm">Paid At:</span>
                      <br />
                      <span className="text-sm text-green-600">
                        {new Date(payment.paidAt).toLocaleString('en-GB', {
                          timeZone: 'Europe/London',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric', 
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}

                  {payment.transactionCode && (
                    <div>
                      <span className="font-medium text-sm">Transaction Code:</span>
                      <br />
                      <span className="text-sm text-muted-foreground font-mono">{payment.transactionCode}</span>
                    </div>
                  )}

                  {payment.paymentLink && (
                    <Separator />
                  )}

                  {payment.paymentLink && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(payment.paymentLink!, payment.id)}
                        className="flex items-center gap-2"
                      >
                        {copiedStates[payment.id] ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {copiedStates[payment.id] ? "Copied!" : "Copy Link"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(payment.paymentLink, '_blank')}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open Link
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}