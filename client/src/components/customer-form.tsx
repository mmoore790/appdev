import { useEffect } from "react";
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

// Define the customer schema for form validation
const customerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }).optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal(""))
});

interface CustomerFormProps {
  customerId?: number;
  editMode?: boolean;
  onComplete?: () => void;
}

export function CustomerForm({ customerId, editMode = false, onComplete }: CustomerFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      notes: ""
    }
  });

  // Fetch customer data if in edit mode
  const { data: customer, isLoading } = useQuery({
    queryKey: customerId ? [`/api/customers/${customerId}`] : null,
    enabled: !!customerId
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

  // Create customer mutation
  const createCustomer = useMutation({
    mutationFn: async (data: z.infer<typeof customerSchema>) => {
      return apiRequest("POST", "/api/customers", data);
    },
    onSuccess: () => {
      toast({
        title: "Customer created",
        description: "The customer has been successfully created."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      if (onComplete) onComplete();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create customer: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Update customer mutation
  const updateCustomer = useMutation({
    mutationFn: async (data: z.infer<typeof customerSchema>) => {
      return apiRequest("PUT", `/api/customers/${customerId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Customer updated",
        description: "The customer has been successfully updated."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
      if (onComplete) onComplete();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update customer: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Form submission handler
  function onSubmit(data: z.infer<typeof customerSchema>) {
    if (editMode && customerId) {
      updateCustomer.mutate(data);
    } else {
      createCustomer.mutate(data);
    }
  }

  if (isLoading && editMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Customer...</CardTitle>
          <CardDescription>Please wait while we fetch the customer details.</CardDescription>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              onClick={onComplete}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="bg-green-700 hover:bg-green-800"
              disabled={createCustomer.isPending || updateCustomer.isPending}
            >
              {createCustomer.isPending || updateCustomer.isPending ? (
                <span className="flex items-center">
                  <span className="material-icons animate-spin mr-2">refresh</span>
                  Saving...
                </span>
              ) : (
                editMode ? "Update Customer" : "Add Customer"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
