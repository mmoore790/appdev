import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Search, Package, CheckCircle, Clock, Truck, AlertCircle, Mail, Phone, FileText } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// Form validation schema
const orderLookupSchema = z.object({
  orderNumber: z.string().min(3, "Order number must be at least 3 characters"),
  email: z.string().email("Please enter a valid email address"),
});

type OrderLookupFormValues = z.infer<typeof orderLookupSchema>;

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status: string;
  trackingNumber?: string;
  estimatedTotalCost?: number;
  actualTotalCost?: number;
  notes?: string;
}

interface OrderItem {
  id: number;
  itemName: string;
  itemSku?: string;
  itemType: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
}

const ORDER_STATUSES = {
  NOT_ORDERED: 'not_ordered',
  ORDERED: 'ordered',
  ARRIVED: 'arrived',
  COMPLETED: 'completed',
} as const;

const getStatusConfig = (status: string) => {
  const statusConfig: Record<string, { label: string; icon: any; color: string; description: string }> = {
    not_ordered: {
      label: "Not Ordered",
      icon: FileText,
      color: "bg-gray-100 text-gray-800",
      description: "Your order is being prepared",
    },
    ordered: {
      label: "Ordered",
      icon: Package,
      color: "bg-blue-100 text-blue-800",
      description: "Your order has been placed with the supplier",
    },
    arrived: {
      label: "Arrived",
      icon: CheckCircle,
      color: "bg-green-100 text-green-800",
      description: "Your order has arrived and is ready for pickup",
    },
    completed: {
      label: "Completed",
      icon: CheckCircle,
      color: "bg-green-200 text-green-900",
      description: "Your order has been completed",
    },
  };

  return statusConfig[status] || {
    label: status,
    icon: Package,
    color: "bg-gray-100 text-gray-800",
    description: "Order status",
  };
};

export default function OrderTracker() {
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const form = useForm<OrderLookupFormValues>({
    resolver: zodResolver(orderLookupSchema),
    defaultValues: {
      orderNumber: "",
      email: "",
    },
  });

  // Extract order number from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderNumber = params.get('orderNumber');
    const email = params.get('email');

    if (orderNumber) {
      form.setValue('orderNumber', orderNumber);
    }

    if (email) {
      form.setValue('email', email);
    }

    // If both are present, auto-submit
    if (orderNumber && email) {
      const submitForm = async () => {
        await onSubmit({ orderNumber, email });
      };
      submitForm();
    }
  }, []);

  // Fetch order items if order is found
  const { data: orderItems = [] } = useQuery<OrderItem[]>({
    queryKey: [`/api/orders/${orderData?.id}/items`],
    enabled: isVerified && !!orderData,
  });

  const onSubmit = async (values: OrderLookupFormValues) => {
    setIsLoading(true);
    setError(null);
    setOrderData(null);
    setIsVerified(false);

    try {
      // Search for order by number
      const searchResponse = await apiRequest("GET", `/api/orders/search?q=${encodeURIComponent(values.orderNumber)}`);
      
      const ordersArray = Array.isArray(searchResponse) ? searchResponse : [];
      if (ordersArray.length === 0) {
        setError("Order not found. Please check your order number and try again.");
        setIsLoading(false);
        return;
      }

      // Find order that matches email
      const matchingOrder = ordersArray.find(
        (order: Order) =>
          order.orderNumber.toLowerCase() === values.orderNumber.toLowerCase() &&
          order.customerEmail?.toLowerCase() === values.email.toLowerCase()
      );

      if (!matchingOrder) {
        setError("Order not found or email does not match. Please verify your details and try again.");
        setIsLoading(false);
        return;
      }

      setOrderData(matchingOrder);
      setIsVerified(true);
    } catch (err: any) {
      setError(err.message || "An error occurred while looking up your order. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const statusConfig = orderData ? getStatusConfig(orderData.status) : null;
  const StatusIcon = statusConfig?.icon || Package;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-neutral-800 mb-2">Track Your Order</h1>
          <p className="text-neutral-600">Enter your order number and email to view order status</p>
        </div>

        {/* Search Form */}
        {!isVerified && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Order Lookup</CardTitle>
              <CardDescription>
                Enter your order details to track your order status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="orderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., ORD-20240115-0001"
                            {...field}
                            className="text-lg"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="your.email@example.com"
                            {...field}
                            className="text-lg"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Track Order
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Order Details */}
        {isVerified && orderData && (
          <div className="space-y-6">
            {/* Order Status Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Order {orderData.orderNumber}</CardTitle>
                    <CardDescription className="mt-1">
                      Placed on {format(new Date(orderData.orderDate), "MMMM d, yyyy 'at' h:mm a")}
                    </CardDescription>
                  </div>
                  {statusConfig && (
                    <Badge className={`${statusConfig.color} text-lg px-4 py-2`}>
                      <StatusIcon className="h-4 w-4 mr-2" />
                      {statusConfig.label}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-neutral-600 mb-2">Current Status</p>
                    <p className="text-lg font-medium">{statusConfig?.description}</p>
                  </div>
                  {orderData.trackingNumber && (
                    <div>
                      <p className="text-sm text-neutral-600 mb-2">Tracking Number</p>
                      <p className="text-lg font-mono font-semibold">{orderData.trackingNumber}</p>
                    </div>
                  )}
                  {orderData.expectedDeliveryDate && (
                    <div>
                      <p className="text-sm text-neutral-600 mb-2">Expected Delivery</p>
                      <p className="text-lg">
                        {format(new Date(orderData.expectedDeliveryDate), "EEEE, MMMM d, yyyy")}
                      </p>
                    </div>
                  )}
                  {orderData.actualDeliveryDate && (
                    <div>
                      <p className="text-sm text-neutral-600 mb-2">Delivered On</p>
                      <p className="text-lg">
                        {format(new Date(orderData.actualDeliveryDate), "EEEE, MMMM d, yyyy")}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            {orderItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Order Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {orderItems.map((item) => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-lg">{item.itemName}</h4>
                              <Badge variant="outline">{item.itemType}</Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {item.itemSku && (
                                <div>
                                  <div className="text-neutral-600">SKU</div>
                                  <div className="font-mono">{item.itemSku}</div>
                                </div>
                              )}
                              <div>
                                <div className="text-neutral-600">Quantity</div>
                                <div className="font-medium">{item.quantity}</div>
                              </div>
                              {item.unitPrice && (
                                <div>
                                  <div className="text-neutral-600">Unit Price</div>
                                  <div className="font-medium">£{item.unitPrice.toFixed(2)}</div>
                                </div>
                              )}
                              {item.totalPrice && (
                                <div>
                                  <div className="text-neutral-600">Total</div>
                                  <div className="font-medium">£{item.totalPrice.toFixed(2)}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Customer</span>
                  <span className="font-medium">{orderData.customerName}</span>
                </div>
                {orderData.customerPhone && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-600 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone
                    </span>
                    <span className="font-medium">{orderData.customerPhone}</span>
                  </div>
                )}
                {orderData.customerEmail && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-600 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </span>
                    <span className="font-medium">{orderData.customerEmail}</span>
                  </div>
                )}
                <Separator />
                {(orderData.estimatedTotalCost || orderData.actualTotalCost) && (
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total Cost</span>
                    <span className="text-lg font-bold">
                      {orderData.actualTotalCost
                        ? `£${orderData.actualTotalCost.toFixed(2)}`
                        : orderData.estimatedTotalCost
                        ? `£${orderData.estimatedTotalCost.toFixed(2)} (estimated)`
                        : "-"}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {orderData.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Order Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-700">{orderData.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* New Search Button */}
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => {
                  setOrderData(null);
                  setIsVerified(false);
                  form.reset();
                  setError(null);
                }}
              >
                Track Another Order
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

