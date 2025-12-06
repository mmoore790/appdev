import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ChevronRight, ChevronLeft, User, Package, Truck, Bell, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const orderItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  itemSku: z.string().optional(),
  itemType: z.enum(["part", "machine", "accessory", "service", "consumable", "other"]),
  quantity: z.number().min(1, "Quantity must be at least 1").default(1),
  unitPrice: z.number().optional(),
  totalPrice: z.number().optional(),
  supplierName: z.string().optional(),
  supplierSku: z.string().optional(),
  notes: z.string().optional(),
  isOrdered: z.boolean().default(false),
});

const orderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().email("Valid email required").optional()
  ),
  customerPhone: z.string().min(1, "Phone number is required"),
  orderDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  status: z.enum(["not_ordered", "ordered", "arrived", "completed"]).default("not_ordered"),
  supplierName: z.string().optional(),
  supplierNotes: z.string().optional(),
  expectedLeadTime: z.number().optional(),
  trackingNumber: z.string().optional(),
  estimatedTotalCost: z.number().optional(),
  actualTotalCost: z.number().optional(),
  depositAmount: z.number().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  notifyOnOrderPlaced: z.boolean().default(true),
  notifyOnArrival: z.boolean().default(true),
  notificationMethod: z.enum(["email", "sms", "both"]).default("email"),
  relatedJobId: z.number().optional(),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface OrderFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: Partial<OrderFormData>;
}

const STEPS = [
  { id: 1, title: "Customer", icon: User, description: "Who is this order for?" },
  { id: 2, title: "Items", icon: Package, description: "What are you ordering?" },
  { id: 3, title: "Supplier & Delivery", icon: Truck, description: "Supplier and delivery details" },
  { id: 4, title: "Review", icon: CheckCircle, description: "Review and submit" },
];

export function OrderForm({ onSuccess, onCancel, initialData }: OrderFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      status: "not_ordered",
      notifyOnOrderPlaced: true,
      notifyOnArrival: true,
      notificationMethod: "email",
      orderDate: new Date().toISOString().split('T')[0],
      items: [
        {
          itemName: "",
          itemType: "part",
          quantity: 1,
        },
      ],
      ...initialData,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const createOrderMutation = useMutation({
    mutationFn: (data: OrderFormData) => apiRequest("POST", "/api/orders", data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      // Also invalidate job-specific orders query if this order is related to a job
      if (variables.relatedJobId) {
        queryClient.invalidateQueries({ queryKey: [`/api/orders/job/${variables.relatedJobId}`] });
      }
      toast({
        title: "Success",
        description: "Order created successfully",
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Order creation error:", error);
      console.error("Error details:", (error as any)?.details);
      
      // Extract validation errors if available
      let errorMessage = error.message || "Failed to create order";
      const errorDetails = (error as any)?.details;
      
      // The ApiError stores the response in details
      if (errorDetails && typeof errorDetails === 'object') {
        if (errorDetails.errors && Array.isArray(errorDetails.errors)) {
          const validationErrors = errorDetails.errors
            .map((e: any) => `• ${e.field || e.path?.join('.') || 'unknown'}: ${e.message}`)
            .join("\n");
          errorMessage = `Validation failed:\n${validationErrors}`;
          console.error("Validation errors:", errorDetails.errors);
        } else if (errorDetails.message) {
          errorMessage = errorDetails.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 15000, // Show longer for validation errors
      });
    },
  });

  const onSubmit = (data: OrderFormData) => {
    // Clean up empty strings and convert to undefined for optional fields
    const cleanedData: any = {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail && data.customerEmail.trim() !== "" ? data.customerEmail : undefined,
      // Determine status based on whether all items are ordered
      status: (() => {
        const allItemsOrdered = data.items.length > 0 && data.items.every(item => item.isOrdered);
        return allItemsOrdered ? "ordered" : "not_ordered";
      })(),
      supplierName: data.supplierName && data.supplierName.trim() !== "" ? data.supplierName : undefined,
      supplierNotes: data.supplierNotes && data.supplierNotes.trim() !== "" ? data.supplierNotes : undefined,
      expectedLeadTime: data.expectedLeadTime,
      trackingNumber: data.trackingNumber && data.trackingNumber.trim() !== "" ? data.trackingNumber : undefined,
      estimatedTotalCost: data.estimatedTotalCost,
      actualTotalCost: data.actualTotalCost,
      depositAmount: data.depositAmount,
      notes: data.notes && data.notes.trim() !== "" ? data.notes : undefined,
      internalNotes: data.internalNotes && data.internalNotes.trim() !== "" ? data.internalNotes : undefined,
      notifyOnOrderPlaced: data.notifyOnOrderPlaced !== undefined ? data.notifyOnOrderPlaced : true,
      notifyOnArrival: false, // Don't notify on arrival during order creation - this will be set when status changes to arrived
      notificationMethod: data.notificationMethod || "email",
      relatedJobId: data.relatedJobId,
      // Handle dates - only send if provided, otherwise let server use defaults
      // Don't send orderDate if empty - server will use default (now())
      expectedDeliveryDate: data.expectedDeliveryDate && data.expectedDeliveryDate.trim() !== "" ? data.expectedDeliveryDate : undefined,
      // Clean up items - ensure required fields are present
      items: data.items.map(item => {
        const cleanedItem: any = {
          itemName: item.itemName,
          itemType: item.itemType,
          quantity: item.quantity || 1,
        };
        
        // Only include optional fields if they have values
        if (item.itemSku && item.itemSku.trim() !== "") cleanedItem.itemSku = item.itemSku;
        if (item.unitPrice !== undefined && item.unitPrice !== null) cleanedItem.unitPrice = item.unitPrice;
        if (item.totalPrice !== undefined && item.totalPrice !== null) cleanedItem.totalPrice = item.totalPrice;
        if (item.supplierName && item.supplierName.trim() !== "") cleanedItem.supplierName = item.supplierName;
        if (item.supplierSku && item.supplierSku.trim() !== "") cleanedItem.supplierSku = item.supplierSku;
        if (item.notes && item.notes.trim() !== "") cleanedItem.notes = item.notes;
        cleanedItem.isOrdered = item.isOrdered || false;
        
        return cleanedItem;
      }),
    };
    
    console.log("Submitting order data:", cleanedData);
    createOrderMutation.mutate(cleanedData);
  };

  const validateStep = async (step: number): Promise<boolean> => {
    let fieldsToValidate: (keyof OrderFormData)[] = [];

    switch (step) {
      case 1:
        // Only validate required fields, email is optional
        fieldsToValidate = ["customerName", "customerPhone"];
        break;
      case 2:
        // Validate items
        const items = form.getValues("items");
        if (items.length === 0) {
          toast({
            title: "Validation Error",
            description: "Please add at least one item to the order",
            variant: "destructive",
          });
          return false;
        }
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item.itemName || item.itemName.trim() === "") {
            form.setError(`items.${i}.itemName`, { message: "Item name is required" });
            return false;
          }
        }
        return true;
      case 3:
        // Optional step, no validation needed
        return true;
      case 4:
        // Optional step, no validation needed
        return true;
      default:
        return true;
    }

    const result = await form.trigger(fieldsToValidate as any);
    if (!result) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
    }
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = (currentStep / STEPS.length) * 100;
  const currentStepConfig = STEPS[currentStep - 1];
  const CurrentStepIcon = currentStepConfig.icon;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-4">Customer Information</h3>
              <p className="text-sm text-neutral-600 mb-6">
                Enter the customer details for this order. At minimum, name and phone are required.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Smith" {...field} />
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
                      <Input placeholder="e.g., 01234 567890" {...field} />
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
                      <Input type="email" placeholder="e.g., john@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        );

      case 2:
        const items = form.watch("items") || [];
        const allItemsOrdered = items.length > 0 && items.every(item => item.isOrdered);
        const someItemsOrdered = items.some(item => item.isOrdered);
        const orderedCount = items.filter(item => item.isOrdered).length;
        
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-4">Order Items</h3>
              <p className="text-sm text-neutral-600 mb-6">
                Add the items you're ordering. You can add multiple items to a single order.
              </p>
              
              {/* Order Status Summary */}
              {items.length > 0 && (
                <div className={`mb-4 p-4 rounded-lg border ${
                  allItemsOrdered 
                    ? "bg-green-50 border-green-200" 
                    : someItemsOrdered 
                    ? "bg-yellow-50 border-yellow-200" 
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-center gap-2">
                    {allItemsOrdered ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <div className="font-medium text-green-900">All items ordered</div>
                          <div className="text-sm text-green-700">Order status will be set to "Ordered"</div>
                        </div>
                      </>
                    ) : someItemsOrdered ? (
                      <>
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                        <div>
                          <div className="font-medium text-yellow-900">Some items not ordered yet</div>
                          <div className="text-sm text-yellow-700">
                            {orderedCount} of {items.length} items ordered. Order status will be "Not Ordered" until all items are marked as ordered.
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-gray-600" />
                        <div>
                          <div className="font-medium text-gray-900">No items ordered yet</div>
                          <div className="text-sm text-gray-700">Check the "Ordered?" box for each item when it's been ordered.</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-semibold">Item {index + 1}</h4>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.itemName`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Replacement Blade" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.itemType`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="part">Part</SelectItem>
                              <SelectItem value="machine">Machine</SelectItem>
                              <SelectItem value="accessory">Accessory</SelectItem>
                              <SelectItem value="service">Service</SelectItem>
                              <SelectItem value="consumable">Consumable</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.itemSku`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU / Part Number</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., XYZ-123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.unitPrice`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Price (£)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.supplierName`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional supplier" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.isOrdered`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Ordered?</FormLabel>
                            <p className="text-xs text-neutral-500">
                              Check if this item has been ordered
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* Show warning if item is not ordered */}
                  {!form.watch(`items.${index}.isOrdered`) && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      ⚠️ This item has not been ordered yet
                    </div>
                  )}
                </Card>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ itemName: "", itemType: "part", quantity: 1 })}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Item
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-4">Supplier & Delivery Information</h3>
              <p className="text-sm text-neutral-600 mb-6">
                Optional supplier details and delivery information. You can skip this step if not needed.
              </p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Supplier Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="supplierName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Parts Plus Ltd" {...field} />
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
                        <Textarea placeholder="Any relevant notes about the supplier..." {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Delivery Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                        <FormLabel>Expected Delivery Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                            placeholder="e.g., 7"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            value={field.value || ""}
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
                          <Input placeholder="Tracking number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes about the order..." {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>
        );

      case 4:
        const formValues = form.getValues();
        const totalItems = formValues.items.length;
        const totalQuantity = formValues.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-4">Review Order</h3>
              <p className="text-sm text-neutral-600 mb-6">
                Please review all the information before submitting the order.
              </p>
            </div>
            
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-neutral-600">Name</div>
                      <div className="font-medium">{formValues.customerName}</div>
                    </div>
                    <div>
                      <div className="text-sm text-neutral-600">Phone</div>
                      <div className="font-medium">{formValues.customerPhone}</div>
                    </div>
                  </div>
                  {formValues.customerEmail && (
                    <div>
                      <div className="text-sm text-neutral-600">Email</div>
                      <div className="font-medium">{formValues.customerEmail}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Order Items ({totalItems})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {formValues.items.map((item, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">{item.itemName}</span>
                              <Badge variant="outline">{item.itemType}</Badge>
                              {item.itemSku && (
                                <span className="text-sm text-neutral-500">({item.itemSku})</span>
                              )}
                            </div>
                            <div className="text-sm text-neutral-600">
                              Quantity: {item.quantity}
                              {item.unitPrice && ` × £${item.unitPrice.toFixed(2)}`}
                              {item.unitPrice && (
                                <span className="ml-2 font-medium">
                                  = £{(item.quantity * item.unitPrice).toFixed(2)}
                                </span>
                              )}
                            </div>
                            <div className="mt-2">
                              {item.isOrdered ? (
                                <Badge variant="default" className="bg-green-600">✓ Ordered</Badge>
                              ) : (
                                <Badge variant="outline" className="border-yellow-500 text-yellow-700">⚠ Not Ordered</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-neutral-600">Total Items:</span>
                      <span className="font-medium">{totalQuantity}</span>
                    </div>
                    {(() => {
                      const orderedCount = formValues.items.filter(item => item.isOrdered).length;
                      const allOrdered = formValues.items.length > 0 && formValues.items.every(item => item.isOrdered);
                      return (
                        <div className={`text-sm pt-2 border-t ${allOrdered ? 'text-green-700' : 'text-yellow-700'}`}>
                          {allOrdered ? (
                            <span>✓ All items ordered - Order status: <strong>Ordered</strong></span>
                          ) : (
                            <span>⚠ {orderedCount} of {formValues.items.length} items ordered - Order status: <strong>Not Ordered</strong></span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>

              {formValues.supplierName && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Supplier</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="font-medium">{formValues.supplierName}</div>
                    {formValues.supplierNotes && (
                      <div className="mt-2">
                        <div className="text-sm text-neutral-600">Notes:</div>
                        <div className="text-sm">{formValues.supplierNotes}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {formValues.expectedDeliveryDate && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Delivery</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      <div className="text-neutral-600">Expected Delivery:</div>
                      <div className="font-medium">
                        {new Date(formValues.expectedDeliveryDate).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="notificationMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notification Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="both">Both Email & SMS</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-3 pt-2">
                    <FormField
                      control={form.control}
                      name="notifyOnOrderPlaced"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Notify customer when order is placed</FormLabel>
                            <p className="text-xs text-neutral-500">
                              Customer will receive a confirmation email when the order is created
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Only submit if we're on the final step (review step) AND it was triggered by the submit button
    if (currentStep === STEPS.length) {
      form.handleSubmit(onSubmit)(e);
    } else {
      // Otherwise, prevent submission and just move to next step
      handleNext();
    }
  };

  const handleCreateOrderClick = () => {
    // Explicitly validate and submit when Create Order button is clicked
    if (currentStep === STEPS.length) {
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <Form {...form}>
      <form 
        onSubmit={handleFormSubmit}
        onKeyDown={(e) => {
          // Prevent Enter key from submitting form on review step unless explicitly on submit button
          if (e.key === 'Enter' && currentStep === STEPS.length) {
            const target = e.target as HTMLElement;
            // Only allow Enter to submit if it's the submit button itself
            if (target.tagName !== 'BUTTON' || target.getAttribute('type') !== 'submit') {
              e.preventDefault();
            }
          }
        }}
        className="space-y-6"
      >
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600">Step {currentStep} of {STEPS.length}</span>
            <span className="text-neutral-600">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isActive
                        ? "bg-blue-600 border-blue-600 text-white"
                        : isCompleted
                        ? "bg-green-600 border-green-600 text-white"
                        : "bg-white border-neutral-300 text-neutral-400"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <StepIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <div className={`text-xs font-medium ${isActive ? "text-blue-600" : "text-neutral-500"}`}>
                      {step.title}
                    </div>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 ${
                      isCompleted ? "bg-green-600" : "bg-neutral-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="pt-6">
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <div>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            )}
            {currentStep < STEPS.length ? (
              <Button type="button" onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="button" onClick={handleCreateOrderClick} disabled={createOrderMutation.isPending}>
                {createOrderMutation.isPending ? "Creating..." : "Create Order"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
