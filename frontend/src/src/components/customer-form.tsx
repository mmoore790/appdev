import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Customer } from "@shared/schema";
import { Loader2 } from "lucide-react";
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

// Define the customer schema for form validation
const customerSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Name must be at least 2 characters" })
    .transform((value) => value.trim())
    .refine((value) => value.length >= 2, {
      message: "Name must be at least 2 characters",
    }),
  email: z.string().email({ message: "Invalid email address" }).optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

type CustomerPayload = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

interface CustomerFormProps {
  customerId?: number;
  editMode?: boolean;
  initialName?: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function CustomerForm({
  customerId,
  editMode = false,
  initialName = "",
  onComplete,
  onCancel,
}: CustomerFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: initialName,
      email: "",
      phone: "",
      address: "",
      notes: ""
    }
  });

  const normalizePayload = (values: CustomerFormValues): CustomerPayload => {
    const toOptional = (value?: string | null) => {
      if (value == null) {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    return {
      name: values.name.trim(),
      email: toOptional(values.email),
      phone: toOptional(values.phone),
      address: toOptional(values.address),
      notes: toOptional(values.notes),
    };
  };

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "An unexpected error occurred.";

  // Fetch customer data if in edit mode
  const {
    data: customer,
    isLoading: isCustomerLoading,
    isError: isCustomerError,
    error: customerError,
  } = useQuery<Customer>({
    queryKey: ["/api/customers", customerId],
    queryFn: () => apiRequest<Customer>("GET", `/api/customers/${customerId}`),
    enabled: Boolean(editMode && customerId),
  });

  // Update form values when customer data is loaded
  useEffect(() => {
    if (customer) {
      form.reset({
        name: customer.name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        notes: customer.notes || ""
      });
    }
  }, [customer, form]);

  const [duplicateEmailCheck, setDuplicateEmailCheck] = useState<{ exists: boolean; customer?: { id: number; name: string } } | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<CustomerPayload | null>(null);

  // Check for duplicate email
  const checkEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest<{ exists: boolean; customer?: { id: number; name: string } }>(
        "GET",
        `/api/customers/check-email?email=${encodeURIComponent(email)}`
      );
    },
  });

  // Create customer mutation
  const createCustomer = useMutation({
    mutationFn: async (payload: CustomerPayload) => {
      return apiRequest("POST", "/api/customers", payload);
    },
    onSuccess: () => {
      toast({
        title: "Customer created",
        description: "The customer has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      form.reset({
        name: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      });
      setDuplicateEmailCheck(null);
      setPendingSubmit(null);
      onComplete?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create customer: ${getErrorMessage(error)}`,
        variant: "destructive",
      });
    },
  });

  // Update customer mutation
  const updateCustomer = useMutation({
    mutationFn: async (payload: CustomerPayload) => {
      return apiRequest("PUT", `/api/customers/${customerId}`, payload);
    },
    onSuccess: () => {
      toast({
        title: "Customer updated",
        description: "The customer has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      if (customerId != null) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId] });
      }
      onComplete?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update customer: ${getErrorMessage(error)}`,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  async function onSubmit(values: CustomerFormValues) {
    const payload = normalizePayload(values);
    if (editMode && customerId) {
      updateCustomer.mutate(payload);
    } else {
      // Check for duplicate email if email is provided
      if (payload.email) {
        try {
          const result = await checkEmailMutation.mutateAsync(payload.email);
          if (result.exists && result.customer) {
            setDuplicateEmailCheck(result);
            setPendingSubmit(payload);
            setShowDuplicateDialog(true);
            return;
          }
        } catch (error) {
          console.error("Error checking email:", error);
          // Continue with creation if check fails
        }
      }
      createCustomer.mutate(payload);
    }
  }

  const handleConfirmDuplicate = () => {
    if (pendingSubmit) {
      createCustomer.mutate(pendingSubmit);
      setShowDuplicateDialog(false);
    }
  };

  const isSubmitting = createCustomer.isPending || updateCustomer.isPending;

  if (isCustomerLoading && editMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Customer...</CardTitle>
          <CardDescription>Please wait while we fetch the customer details.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isCustomerError && editMode) {
    const message = getErrorMessage(customerError);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unable to load customer</CardTitle>
          <CardDescription>
            We ran into a problem fetching the customer details. {message}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editMode ? "Edit Customer" : "Add New Customer"}</CardTitle>
        <CardDescription>
          {editMode 
            ? "Update customer information" 
            : "Enter customer details to add them to your database"
          }
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name*</FormLabel>
                  <FormControl>
                    <Input placeholder="Full name or company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Email address" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Physical address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional information or special instructions"
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
                  Saving...
                </span>
              ) : (
                editMode ? "Update Customer" : "Add Customer"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>

      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Email Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              This email is already associated with a customer named{" "}
              <strong>{duplicateEmailCheck?.customer?.name}</strong>. Are you sure you want to create another customer with this email?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDuplicate}>
              Create Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
