import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { XCircle, CreditCard } from "lucide-react";

export default function PaymentCancel() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-fit">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-gray-900">Payment Cancelled</CardTitle>
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600 leading-relaxed">
            Your payment was cancelled. No charges have been made to your account.
          </p>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-orange-800">
              <CreditCard className="h-4 w-4" />
              <p className="text-sm font-medium">Need Help?</p>
            </div>
            <p className="text-sm text-orange-700 mt-1">
              If you experienced any issues during payment, please contact us directly.
            </p>
          </div>
          
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-500">
              <strong>Moore Horticulture Equipment</strong><br />
              Email: info@mooresmowers.co.uk<br />
              We're here to help with your service needs.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}