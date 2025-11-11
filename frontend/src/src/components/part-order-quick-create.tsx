import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const quickPartOrderSchema = z.object({
  partName: z.string().min(1, "Part name is required"),
  partNumber: z.string().optional(),
  supplier: z.string().min(1, "Supplier is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  estimatedCost: z
    .union([z.coerce.number().min(0, "Cost cannot be negative"), z.literal("")])
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(1, "Customer phone is required"),
  customerEmail: z
    .string()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
});

type QuickPartOrderFormValues = z.infer<typeof quickPartOrderSchema>;

export interface PartOrderQuickCreateProps {
  jobId: number;
  jobCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  defaultNotes?: string;
  onCreated?: (part: any) => void;
}

export function PartOrderQuickCreate({
  jobId,
  jobCode,
  open,
  onOpenChange,
  customerName,
  customerPhone,
  customerEmail,
  defaultNotes,
  onCreated,
}: PartOrderQuickCreateProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<QuickPartOrderFormValues>({
    resolver: zodResolver(quickPartOrderSchema),
    defaultValues: {
      partName: "",
      partNumber: "",
      supplier: "",
      quantity: 1,
      estimatedCost: undefined,
      expectedDeliveryDate: "",
      notes: defaultNotes ?? "",
      customerName,
      customerPhone: customerPhone ?? "",
      customerEmail: customerEmail ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        partName: "",
        partNumber: "",
        supplier: "",
        quantity: 1,
        estimatedCost: undefined,
        expectedDeliveryDate: "",
        notes: defaultNotes ?? "",
        customerName,
        customerPhone: customerPhone ?? "",
        customerEmail: customerEmail ?? "",
      });
    }
  }, [open, customerName, customerPhone, customerEmail, defaultNotes, form]);

  const createPartOrderMutation = useMutation({
    mutationFn: async (values: QuickPartOrderFormValues) => {
      const payload = {
        partName: values.partName,
        partNumber: values.partNumber || undefined,
        supplier: values.supplier,
        quantity: values.quantity,
        estimatedCost: values.estimatedCost,
        expectedDeliveryDate: values.expectedDeliveryDate || undefined,
        notes: values.notes
          ? values.notes
          : `Auto-created from job ${jobCode} parts request`,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail || undefined,
        relatedJobId: jobId,
      };

      return apiRequest("POST", "/api/parts-on-order", payload);
    },
    onSuccess: (part) => {
      toast({
        title: "Part order created",
        description: "The part order has been logged and linked to this job.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/parts-on-order"] });
      queryClient.invalidateQueries({ queryKey: [`/api/parts-on-order/job/${jobId}`] });

      if (onCreated) {
        onCreated(part);
      }

      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create part order",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: QuickPartOrderFormValues) => {
    createPartOrderMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex flex-col space-y-1">
            <span>Order Parts for {jobCode}</span>
            <span className="text-sm font-normal text-muted-foreground">
              Capture supplier and part details. Weʼll link this order to the job automatically.
            </span>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="partName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Part name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Blade belt, Carburettor..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="partNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Part number</FormLabel>
                    <FormControl>
                      <Input placeholder="Manufacturer ref (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier *</FormLabel>
                    <FormControl>
                      <Input placeholder="Parts Plus Ltd" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="estimatedCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated cost (£)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
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
                    <FormLabel>Expected delivery</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Any special instructions or supplier references"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <FormControl>
                      <Input {...field} disabled />
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
                    <FormLabel>Customer phone *</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="customerEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Optional but helpful" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPartOrderMutation.isPending}>
                {createPartOrderMutation.isPending ? "Saving..." : "Create part order"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
