import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const orderEditSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().email("Valid email required").optional()
  ),
  customerPhone: z.string().min(1, "Phone number is required"),
  customerAddress: z.string().optional(),
  customerNotes: z.string().optional(),
  orderDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  actualDeliveryDate: z.string().optional(),
  supplierName: z.string().optional(),
  supplierNotes: z.string().optional(),
  expectedLeadTime: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().optional()
  ),
  trackingNumber: z.string().optional(),
  estimatedTotalCost: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().optional()
  ),
  actualTotalCost: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().optional()
  ),
  depositAmount: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().optional()
  ),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  notificationMethod: z.enum(["email", "sms", "both"]).optional(),
  notifyOnOrderPlaced: z.boolean().optional(),
  notifyOnArrival: z.boolean().optional(),
});

type OrderEditFormData = z.infer<typeof orderEditSchema>;

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerAddress?: string;
  customerNotes?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  supplierName?: string;
  supplierNotes?: string;
  expectedLeadTime?: number;
  trackingNumber?: string;
  estimatedTotalCost?: number;
  actualTotalCost?: number;
  depositAmount?: number;
  notes?: string;
  internalNotes?: string;
  notificationMethod?: string;
  notifyOnOrderPlaced?: boolean;
  notifyOnArrival?: boolean;
}

interface OrderEditFormProps {
  order: Order;
  onSuccess?: () => void;
  onCancel?: () => void;
  onUpdate: (data: Partial<OrderEditFormData>) => Promise<void>;
}

export function OrderEditForm({ order, onSuccess, onCancel, onUpdate }: OrderEditFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OrderEditFormData>({
    resolver: zodResolver(orderEditSchema),
    defaultValues: {
      customerName: order.customerName,
      customerEmail: order.customerEmail || "",
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress || "",
      customerNotes: order.customerNotes || "",
      orderDate: order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : "",
      expectedDeliveryDate: order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toISOString().split('T')[0] : "",
      actualDeliveryDate: order.actualDeliveryDate ? new Date(order.actualDeliveryDate).toISOString().split('T')[0] : "",
      supplierName: order.supplierName || "",
      supplierNotes: order.supplierNotes || "",
      expectedLeadTime: order.expectedLeadTime,
      trackingNumber: order.trackingNumber || "",
      estimatedTotalCost: order.estimatedTotalCost,
      actualTotalCost: order.actualTotalCost,
      depositAmount: order.depositAmount,
      notes: order.notes || "",
      internalNotes: order.internalNotes || "",
      notificationMethod: (order.notificationMethod as "email" | "sms" | "both") || "email",
      notifyOnOrderPlaced: order.notifyOnOrderPlaced,
      notifyOnArrival: order.notifyOnArrival,
    },
  });

  const onSubmit = async (data: OrderEditFormData) => {
    setIsSubmitting(true);
    try {
      // Clean up empty strings and convert to undefined
      const cleanedData: any = {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail && data.customerEmail.trim() !== "" ? data.customerEmail.trim() : undefined,
        customerAddress: data.customerAddress && data.customerAddress.trim() !== "" ? data.customerAddress.trim() : undefined,
        customerNotes: data.customerNotes && data.customerNotes.trim() !== "" ? data.customerNotes.trim() : undefined,
        supplierName: data.supplierName && data.supplierName.trim() !== "" ? data.supplierName.trim() : undefined,
        supplierNotes: data.supplierNotes && data.supplierNotes.trim() !== "" ? data.supplierNotes.trim() : undefined,
        trackingNumber: data.trackingNumber && data.trackingNumber.trim() !== "" ? data.trackingNumber.trim() : undefined,
        notes: data.notes && data.notes.trim() !== "" ? data.notes.trim() : undefined,
        internalNotes: data.internalNotes && data.internalNotes.trim() !== "" ? data.internalNotes.trim() : undefined,
        expectedLeadTime: data.expectedLeadTime !== undefined && data.expectedLeadTime !== null ? data.expectedLeadTime : undefined,
        estimatedTotalCost: data.estimatedTotalCost !== undefined && data.estimatedTotalCost !== null ? data.estimatedTotalCost : undefined,
        actualTotalCost: data.actualTotalCost !== undefined && data.actualTotalCost !== null ? data.actualTotalCost : undefined,
        depositAmount: data.depositAmount !== undefined && data.depositAmount !== null ? data.depositAmount : undefined,
        notificationMethod: data.notificationMethod || "email",
        notifyOnOrderPlaced: data.notifyOnOrderPlaced,
        notifyOnArrival: data.notifyOnArrival,
      };

      // Handle dates
      if (data.orderDate && data.orderDate.trim() !== "") {
        cleanedData.orderDate = new Date(data.orderDate + 'T00:00:00').toISOString();
      }
      if (data.expectedDeliveryDate && data.expectedDeliveryDate.trim() !== "") {
        cleanedData.expectedDeliveryDate = new Date(data.expectedDeliveryDate + 'T00:00:00').toISOString();
      }
      if (data.actualDeliveryDate && data.actualDeliveryDate.trim() !== "") {
        cleanedData.actualDeliveryDate = new Date(data.actualDeliveryDate + 'T00:00:00').toISOString();
      }

      await onUpdate(cleanedData);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="customerNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Order Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="orderDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expectedDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Delivery</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="actualDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Delivery</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Supplier Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Supplier Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="supplierName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplierNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="expectedLeadTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Lead Time (Days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value === "" || e.target.value === null ? undefined : parseInt(e.target.value) || undefined)}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trackingNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tracking Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Financial Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Financial Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="estimatedTotalCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Total Cost (£)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value === "" || e.target.value === null ? undefined : parseFloat(e.target.value) || undefined)}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="actualTotalCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Total Cost (£)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value === "" || e.target.value === null ? undefined : parseFloat(e.target.value) || undefined)}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="depositAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deposit Amount (£)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value === "" || e.target.value === null ? undefined : parseFloat(e.target.value) || undefined)}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Notes visible to customer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="internalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes (Staff Only)</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Internal notes not visible to customer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Order"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

