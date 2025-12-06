import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/logo-m.png";

// Business type
type Business = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
};

// Form validation schema
const registerSchema = z.object({
  createNewBusiness: z.boolean(),
  businessName: z.string().optional(),
  businessId: z.number().optional(),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Please enter a valid email address"),
  fullName: z.string().min(3, "Full name must be at least 3 characters"),
  requestedRole: z.enum(["staff", "mechanic", "admin"]).optional(),
  department: z.string().min(2, "Department must be at least 2 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
}).refine((data) => {
  if (data.createNewBusiness) {
    return data.businessName && data.businessName.length >= 2;
  } else {
    return data.businessId !== undefined;
  }
}, {
  message: "Please provide business information",
  path: ["businessName"],
}).refine((data) => {
  if (!data.createNewBusiness) {
    return data.requestedRole !== undefined;
  }
  return true;
}, {
  message: "Please select a role",
  path: ["requestedRole"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      createNewBusiness: false,
      businessName: "",
      businessId: undefined,
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      fullName: "",
      requestedRole: "staff",
      department: "",
    },
  });

  const createNewBusiness = form.watch("createNewBusiness");

  // Fetch businesses when component mounts
  useEffect(() => {
    async function fetchBusinesses() {
      setLoadingBusinesses(true);
      try {
        const response = await fetch("/api/auth/businesses");
        if (response.ok) {
          const data = await response.json();
          setBusinesses(data.filter((b: Business) => b.isActive));
        }
      } catch (err) {
        console.error("Error fetching businesses:", err);
      } finally {
        setLoadingBusinesses(false);
      }
    }
    fetchBusinesses();
  }, []);

  async function onSubmit(data: RegisterFormValues) {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: any = {
        username: data.username,
        password: data.password,
        email: data.email,
        fullName: data.fullName,
        requestedRole: data.requestedRole,
        department: data.department,
        createNewBusiness: data.createNewBusiness,
      };

      if (data.createNewBusiness) {
        payload.businessName = data.businessName;
      } else {
        payload.businessId = data.businessId;
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Registration failed");
      }

      const responseData = await response.json();

      // Show success message in the form
      const successMessage = data.createNewBusiness
        ? `Registration successful! Your business "${responseData.businessName || data.businessName}" has been created. Please log in.`
        : "Registration successful! Please log in.";
      
      setSuccess(successMessage);
      
      // Also show a toast notification
      toast({
        title: "Registration Successful",
        description: data.createNewBusiness
          ? `Your business has been created. You can now log in as an administrator.`
          : "Your account has been created. Please log in.",
        duration: 5000,
      });
      
      form.reset();
      
      // Redirect to login page after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      
      // Show error toast
      toast({
        title: "Registration Failed",
        description: err instanceof Error ? err.message : "An unexpected error occurred",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 py-8">
      <div className="w-full max-w-md p-4">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <img src={logoPath} alt="Moore Horticulture Equipment Logo" className="h-20 object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold text-center text-green-700">Register User</CardTitle>
            <CardDescription className="text-center">
              Create a new account to access the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="mb-4 bg-green-50 border-green-200 text-green-800">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Business Selection */}
                <FormField
                  control={form.control}
                  name="createNewBusiness"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Business</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => field.onChange(value === "new")}
                          value={field.value ? "new" : "existing"}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="new" id="new-business" />
                            <Label htmlFor="new-business" className="font-normal cursor-pointer">
                              Create New Business
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="existing" id="existing-business" />
                            <Label htmlFor="existing-business" className="font-normal cursor-pointer">
                              Join Existing Business
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {createNewBusiness ? (
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter business name" {...field} />
                        </FormControl>
                        <FormDescription>
                          You will be set as the administrator for this business.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="businessId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Business</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                          disabled={loadingBusinesses}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={loadingBusinesses ? "Loading businesses..." : "Select a business"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {businesses.map((business) => (
                              <SelectItem key={business.id} value={business.id.toString()}>
                                {business.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="name@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!createNewBusiness && (
                  <FormField
                    control={form.control}
                    name="requestedRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Requested Role</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="staff">Standard User</SelectItem>
                            <SelectItem value="mechanic">Mechanic</SelectItem>
                            <SelectItem value="admin">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Note: Your role must be approved by an administrator.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {createNewBusiness && (
                  <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> When creating a new business, you will automatically be set as the administrator.
                    </p>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Workshop, Sales, Admin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full bg-green-600 hover:bg-green-700 text-white" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Register"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col">
            <p className="text-sm text-center text-gray-500 mt-2">
              Already have an account?{" "}
              <a href="/login" className="text-green-600 hover:text-green-800 hover:underline">
                Login
              </a>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}