import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Schema for asset form validation
const assetSchema = z.object({
  serialNumber: z
    .string()
    .min(1, { message: "Serial number is required" })
    .transform((value) => value.trim())
    .refine((value) => value.length >= 1, {
      message: "Serial number is required",
    }),
  makeModel: z.string().optional().or(z.literal("")),
  purchaseDate: z.string().optional().or(z.literal("")),
  warrantyDuration: z.string().optional().or(z.literal("")),
  warrantyDurationUnit: z.enum(["months", "years"]).optional(),
  notes: z.string().optional().or(z.literal("")),
}).refine((data) => {
  // If warranty duration is provided, unit must be specified
  if (data.warrantyDuration && data.warrantyDuration.trim() !== "") {
    return !!data.warrantyDurationUnit;
  }
  return true;
}, {
  message: "Warranty duration unit is required when duration is specified",
  path: ["warrantyDurationUnit"],
});

type AssetFormValues = z.infer<typeof assetSchema>;

type AssetPayload = {
  serialNumber: string;
  customerId: number;
  makeModel?: string;
  purchaseDate?: string;
  warrantyDurationMonths?: number;
  notes?: string;
};

interface AssetFormProps {
  customerId: number;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function AssetForm({
  customerId,
  onComplete,
  onCancel,
}: AssetFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      serialNumber: "",
      makeModel: "",
      purchaseDate: "",
      warrantyDuration: "",
      warrantyDurationUnit: "months",
      notes: "",
    },
  });

  // Convert warranty duration to months
  const convertWarrantyToMonths = (duration: string, unit: "months" | "years" | undefined): number | undefined => {
    if (!duration || duration.trim() === "") {
      return undefined;
    }
    const num = parseFloat(duration);
    if (isNaN(num) || num <= 0) {
      return undefined;
    }
    return unit === "years" ? Math.round(num * 12) : Math.round(num);
  };

  const normalizePayload = (values: AssetFormValues): AssetPayload => {
    const toOptional = (value?: string | null) => {
      if (value == null) {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const warrantyDurationMonths = convertWarrantyToMonths(
      values.warrantyDuration || "",
      values.warrantyDurationUnit
    );

    return {
      serialNumber: values.serialNumber.trim(),
      customerId,
      makeModel: toOptional(values.makeModel),
      purchaseDate: toOptional(values.purchaseDate),
      warrantyDurationMonths,
      notes: toOptional(values.notes),
    };
  };

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "An unexpected error occurred.";

  // Create asset mutation
  const createAsset = useMutation({
    mutationFn: async (payload: AssetPayload) => {
      return apiRequest("POST", "/api/equipment", payload);
    },
    onSuccess: () => {
      toast({
        title: "Equipment registered",
        description: "The equipment has been successfully registered.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment/customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "details"] });
      form.reset({
        serialNumber: "",
        makeModel: "",
        purchaseDate: "",
        warrantyDuration: "",
        warrantyDurationUnit: "months",
        notes: "",
      });
      onComplete?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to register equipment: ${getErrorMessage(error)}`,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  async function onSubmit(values: AssetFormValues) {
    const payload = normalizePayload(values);
    createAsset.mutate(payload);
  }

  const isSubmitting = createAsset.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register New Equipment</CardTitle>
        <CardDescription>
          Enter equipment details to register it for this customer
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="Equipment serial number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="makeModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Make & Model</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Husqvarna 235, Stihl MS 271" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="warrantyDuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warranty Duration</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 3" 
                        min="0"
                        step="0.5"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="warrantyDurationUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration Unit</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="months">Months</SelectItem>
                        <SelectItem value="years">Years</SelectItem>
                      </SelectContent>
                    </Select>
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
                      placeholder="Additional information about this equipment"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (isSubmitting) {
                  return;
                }
                if (onCancel) {
                  onCancel();
                } else {
                  onComplete?.();
                }
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-green-700 hover:bg-green-800"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </span>
              ) : (
                "Register Equipment"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
