import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, CreditCard, Mail, PoundSterling, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";

interface JobPaymentFormProps {
  job: any;
  open: boolean;
  onClose: () => void;
}

export function JobPaymentForm({ job, open, onClose }: JobPaymentFormProps) {
  const [activeTab, setActiveTab] = useState<"mark-paid" | "send-request">("mark-paid");
  const [markPaidForm, setMarkPaidForm] = useState({
    paymentAmount: "",
    invoiceNumber: "",
    paymentMethod: "",
    paymentNotes: ""
  });
  const [paymentRequestForm, setPaymentRequestForm] = useState({
    customerEmail: "",
    amount: "",
    description: ""
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"mark-paid" | "send-request" | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Payment status refresh mutation
  const refreshPaymentStatusMutation = useMutation({
    mutationFn: async (jobId: number) => {
      return apiRequest('POST', `/api/jobs/${jobId}/payments/refresh`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-requests"] });
      
      toast({
        title: "Payment Status Updated",
        description: data.message || "Payment status has been refreshed from Stripe",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh payment status",
        variant: "destructive",
      });
    }
  });

  // Reset forms when dialog opens
  useEffect(() => {
    if (open) {
      setMarkPaidForm({
        paymentAmount: "",
        invoiceNumber: "",
        paymentMethod: "",
        paymentNotes: ""
      });
      setPaymentRequestForm({
        customerEmail: "",
        amount: "",
        description: `Service payment for job ${job.jobId}`
      });
      setActiveTab("mark-paid");
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  }, [open, job.jobId]);

  // Mark job as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      return apiRequest('POST', `/api/jobs/${job.id}/payments/record`, paymentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Payment Recorded",
        description: "Job has been marked as paid successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    }
  });

  // Send payment request mutation
  const sendRequestMutation = useMutation({
    mutationFn: async (requestData: any) => {
      return apiRequest('POST', `/api/jobs/${job.id}/payments/request`, requestData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Payment Request Sent",
        description: "Customer has been notified about the payment",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send payment request",
        variant: "destructive",
      });
    }
  });

  const handleMarkPaidSubmit = () => {
    if (!markPaidForm.paymentAmount || !markPaidForm.paymentMethod) {
      toast({
        title: "Missing Information",
        description: "Please enter payment amount and method",
        variant: "destructive",
      });
      return;
    }
    setConfirmAction("mark-paid");
    setShowConfirmDialog(true);
  };

  const handleSendRequestSubmit = () => {
    if (!paymentRequestForm.customerEmail || !paymentRequestForm.amount) {
      toast({
        title: "Missing Information",
        description: "Please enter customer email and amount",
        variant: "destructive",
      });
      return;
    }
    setConfirmAction("send-request");
    setShowConfirmDialog(true);
  };

  const confirmPaymentAction = () => {
    if (confirmAction === "mark-paid") {
      markPaidMutation.mutate({
        paymentAmount: parseFloat(markPaidForm.paymentAmount),
        invoiceNumber: markPaidForm.invoiceNumber,
        paymentMethod: markPaidForm.paymentMethod,
        paymentNotes: markPaidForm.paymentNotes
      });
    } else if (confirmAction === "send-request") {
      sendRequestMutation.mutate({
        customerEmail: paymentRequestForm.customerEmail,
        amount: parseFloat(paymentRequestForm.amount),
        description: paymentRequestForm.description
      });
    }
    setShowConfirmDialog(false);
    setConfirmAction(null);
  };

  const getPaymentStatusBadge = () => {
    if (!job.paymentStatus || job.paymentStatus === 'unpaid') {
      return <Badge variant="destructive" className="ml-2">Unpaid</Badge>;
    }
    if (job.paymentStatus === 'paid') {
      return <Badge variant="default" className="bg-green-600 ml-2">Paid</Badge>;
    }
    if (job.paymentStatus === 'pending_payment_request') {
      return <Badge variant="secondary" className="ml-2">Request Sent</Badge>;
    }
    return <Badge variant="outline" className="ml-2">{job.paymentStatus}</Badge>;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center">
                <PoundSterling className="h-5 w-5 mr-2" />
                Payment Management - Job {job.jobId}
                {getPaymentStatusBadge()}
              </DialogTitle>
              {job.paymentStatus !== 'paid' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshPaymentStatusMutation.mutate(job.id)}
                  disabled={refreshPaymentStatusMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshPaymentStatusMutation.isPending ? 'animate-spin' : ''}`} />
                  {refreshPaymentStatusMutation.isPending ? 'Checking...' : 'Check Payment Status'}
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Current Payment Status */}
          {job.paymentStatus === 'paid' && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-3">
                <div className="flex items-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                  <CardTitle className="text-green-800 text-lg">Payment Complete</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-green-700">Amount Paid</Label>
                    <p className="font-medium">£{job.paymentAmount ? (job.paymentAmount / 100).toFixed(2) : 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-green-700">Payment Method</Label>
                    <p className="font-medium">{job.paymentMethod || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-green-700">Invoice Number</Label>
                    <p className="font-medium">{job.invoiceNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-green-700">Paid Date</Label>
                    <p className="font-medium">{job.paidAt ? job.paidAt : 'N/A'}</p>
                  </div>
                </div>
                {job.paymentNotes && (
                  <div className="mt-3">
                    <Label className="text-green-700">
                      {job.paymentNotes.includes('VERIFIED') ? '✅ Verification Details' : 'Notes'}
                    </Label>
                    {job.paymentNotes.includes('Receipt:') ? (
                      <div className="space-y-1 mt-1 text-xs font-mono bg-green-100 p-2 rounded">
                        {job.paymentNotes.split(' | ').map((item, index) => (
                          <div key={index}>
                            {item.startsWith('Receipt:') ? (
                              <a 
                                href={item.replace('Receipt: ', '')} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline font-medium"
                              >
                                🧾 View Stripe Receipt
                              </a>
                            ) : (
                              <span className="block text-green-800">{item}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="font-medium">{job.paymentNotes}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {job.paymentStatus !== 'paid' && (
            <>
              {/* Tab Navigation */}
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab("mark-paid")}
                  className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "mark-paid"
                      ? "border-green-600 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 inline mr-2" />
                  Mark as Paid
                </button>
                <button
                  onClick={() => setActiveTab("send-request")}
                  className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "send-request"
                      ? "border-green-600 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Mail className="h-4 w-4 inline mr-2" />
                  Send Payment Request
                </button>
              </div>

              {/* Mark as Paid Form */}
              {activeTab === "mark-paid" && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Manually record payment received for this job.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="payment-amount">Payment Amount (£) *</Label>
                      <Input
                        id="payment-amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={markPaidForm.paymentAmount}
                        onChange={(e) => setMarkPaidForm(prev => ({ ...prev, paymentAmount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="payment-method">Payment Method *</Label>
                      <Select 
                        value={markPaidForm.paymentMethod}
                        onValueChange={(value) => setMarkPaidForm(prev => ({ ...prev, paymentMethod: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="stripe">Stripe</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="invoice-number">Invoice Number</Label>
                    <Input
                      id="invoice-number"
                      placeholder="Optional invoice reference"
                      value={markPaidForm.invoiceNumber}
                      onChange={(e) => setMarkPaidForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="payment-notes">Payment Notes</Label>
                    <Textarea
                      id="payment-notes"
                      placeholder="Optional notes about the payment"
                      value={markPaidForm.paymentNotes}
                      onChange={(e) => setMarkPaidForm(prev => ({ ...prev, paymentNotes: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Send Payment Request Form */}
              {activeTab === "send-request" && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Send a payment request email to the customer with a secure payment link.
                  </p>
                  
                  <div>
                    <Label htmlFor="customer-email">Customer Email *</Label>
                    <Input
                      id="customer-email"
                      type="email"
                      placeholder="customer@example.com"
                      value={paymentRequestForm.customerEmail}
                      onChange={(e) => setPaymentRequestForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="payment-amount-request">Payment Amount (£) *</Label>
                    <Input
                      id="payment-amount-request"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={paymentRequestForm.amount}
                      onChange={(e) => setPaymentRequestForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="payment-description">Description</Label>
                    <Textarea
                      id="payment-description"
                      placeholder="Payment description for the customer"
                      value={paymentRequestForm.description}
                      onChange={(e) => setPaymentRequestForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  {job.paymentStatus === 'pending_payment_request' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <div className="flex items-start">
                        <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 mr-2" />
                        <div className="text-sm">
                          <p className="font-medium text-amber-800">Payment Request Already Sent</p>
                          <p className="text-amber-700 mt-1">
                            A payment request is already pending for this job. Sending another will replace the previous one.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                {activeTab === "mark-paid" ? (
                  <Button 
                    onClick={handleMarkPaidSubmit}
                    disabled={markPaidMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {markPaidMutation.isPending ? "Recording..." : "Mark as Paid"}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSendRequestSubmit}
                    disabled={sendRequestMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendRequestMutation.isPending ? "Sending..." : "Send Request"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment Action</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {confirmAction === "mark-paid" ? (
              <div>
                <p>Are you sure you want to mark this job as paid?</p>
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <p><strong>Job:</strong> {job.jobId}</p>
                  <p><strong>Amount:</strong> £{markPaidForm.paymentAmount}</p>
                  <p><strong>Method:</strong> {markPaidForm.paymentMethod}</p>
                  {markPaidForm.invoiceNumber && <p><strong>Invoice:</strong> {markPaidForm.invoiceNumber}</p>}
                </div>
                <p className="mt-3 text-sm text-amber-600">
                  This action cannot be easily undone. Make sure the payment details are correct.
                </p>
              </div>
            ) : (
              <div>
                <p>Send a payment request to the customer?</p>
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <p><strong>Customer:</strong> {paymentRequestForm.customerEmail}</p>
                  <p><strong>Amount:</strong> £{paymentRequestForm.amount}</p>
                  <p><strong>Description:</strong> {paymentRequestForm.description}</p>
                </div>
                <p className="mt-3 text-sm text-blue-600">
                  The customer will receive an email with a secure payment link.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmPaymentAction}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}