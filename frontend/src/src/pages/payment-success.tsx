import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, CreditCard, AlertCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PaymentSessionStatus {
  session: {
    id: string;
    status: string;
    payment_status: string;
    amount_total: number;
    currency: string;
    customer_details?: {
      email: string;
      name?: string;
    };
  };
  paymentRequest?: {
    id: number;
    description: string;
    status: string;
  };
}

export default function PaymentSuccess() {
  const [, navigate] = useLocation();
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    // Extract session_id from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const sessionIdParam = urlParams.get('session_id');
    
    if (sessionIdParam) {
      setSessionId(sessionIdParam);
    } else {
      // No session ID found, redirect to public tracker as a safe default
      navigate('/job-tracker');
    }
  }, [navigate]);

  // Fetch payment session status
  const { data: sessionStatus, isLoading, error } = useQuery<PaymentSessionStatus>({
    queryKey: ['/api/stripe/session', sessionId],
    queryFn: () => apiRequest(`/api/stripe/session/${sessionId}`),
    enabled: !!sessionId, // Only run query if sessionId exists
    retry: 3,
    retryDelay: 1000
  });

  const formatAmount = (amountInCents: number, currency: string) => {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: currency.toUpperCase() 
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Processing Payment...</h2>
            <p className="text-gray-600">
              Please wait while we verify your payment details.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !sessionStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Payment Verification</h2>
            <p className="text-gray-600 mb-6">
              We're having trouble verifying your payment. If you were charged, please contact us directly and we'll sort this out.
            </p>
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500">
                <strong>Moore Horticulture Equipment</strong><br />
                Email: info@mooresmowers.co.uk<br />
                We're here to help with your payment enquiry.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = sessionStatus.session;
  const paymentRequest = sessionStatus.paymentRequest;
  const isPaymentSuccessful = session.payment_status === 'paid';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-4">
          {isPaymentSuccessful ? (
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          ) : (
            <AlertCircle className="h-16 w-16 text-orange-600 mx-auto mb-4" />
          )}
          <CardTitle className="text-2xl">
            {isPaymentSuccessful ? 'Payment Successful!' : 'Payment Processing'}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Payment Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Amount</span>
              <span className="text-lg font-semibold">
                {formatAmount(session.amount_total, session.currency)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Status</span>
              <Badge variant={isPaymentSuccessful ? "default" : "secondary"}>
                {session.payment_status === 'paid' ? 'Paid' : 'Processing'}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Session ID</span>
              <span className="text-xs font-mono text-gray-500 break-all">
                {session.id.substring(0, 20)}...
              </span>
            </div>

            {session.customer_details?.email && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Email</span>
                <span className="text-sm">{session.customer_details.email}</span>
              </div>
            )}
          </div>

          {/* Payment Request Details */}
          {paymentRequest && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Invoice Details</span>
              </div>
              <p className="text-sm text-blue-800">{paymentRequest.description}</p>
              <Badge variant="outline" className="mt-2 text-xs">
                Request #{paymentRequest.id}
              </Badge>
            </div>
          )}

          {/* Success Message */}
          {isPaymentSuccessful && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 text-center">
                <strong>Thank you for your payment!</strong><br />
                We've received your payment successfully and your service request will be processed.
              </p>
            </div>
          )}

          {/* Contact Information */}
          <div className="pt-4 border-t text-center">
            <p className="text-sm text-gray-500">
              <strong>Moore Horticulture Equipment</strong><br />
              Email: info@mooresmowers.co.uk<br />
              Thank you for choosing our services.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}