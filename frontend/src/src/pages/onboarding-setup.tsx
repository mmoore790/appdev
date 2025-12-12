import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api";
import logoPath from "@assets/logo-m.png";

// Step 1: Email verification schema
const emailVerificationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// Step 2: Account creation schema
const accountCreationSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(255, "Business name is too long"),
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username is too long"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1, "Full name is required").max(255, "Full name is too long"),
});

type EmailVerificationValues = z.infer<typeof emailVerificationSchema>;
type AccountCreationValues = z.infer<typeof accountCreationSchema>;

interface SubscriptionInfo {
  email: string;
  planName: string | null;
  status: string;
  accountCreated: boolean;
}

export default function OnboardingSetupPage() {
  const [step, setStep] = useState<"verify" | "create">("verify");
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const emailForm = useForm<EmailVerificationValues>({
    resolver: zodResolver(emailVerificationSchema),
    defaultValues: {
      email: "",
    },
  });

  const accountForm = useForm<AccountCreationValues>({
    resolver: zodResolver(accountCreationSchema),
    defaultValues: {
      businessName: "",
      username: "",
      password: "",
      fullName: "",
    },
  });

  // Pre-fill email from URL params if available
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      emailForm.setValue("email", emailParam);
    }
  }, [emailForm]);

  async function onVerifyEmail(data: EmailVerificationValues) {
    setError(null);
    setIsVerifying(true);

    try {
      const response = await fetch(resolveApiUrl("/api/subscriptions/verify-email"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      });

      const result = await response.json();

      if (!response.ok || !result.valid) {
        throw new Error(result.message || "Subscription verification failed");
      }

      setSubscriptionInfo(result.subscription);
      setStep("create");
      
      // Pre-fill full name with email name part if possible
      const emailName = data.email.split("@")[0];
      if (emailName) {
        accountForm.setValue("fullName", emailName.charAt(0).toUpperCase() + emailName.slice(1));
      }
      
      toast({
        title: "Subscription verified",
        description: "Please complete your account setup below.",
        duration: 3000,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to verify subscription";
      setError(errorMessage);
      toast({
        title: "Verification failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsVerifying(false);
    }
  }

  async function onCreateAccount(data: AccountCreationValues) {
    if (!subscriptionInfo) {
      setError("Please verify your email first");
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch(resolveApiUrl("/api/subscriptions/create-account"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: subscriptionInfo.email,
          businessName: data.businessName,
          username: data.username,
          password: data.password,
          fullName: data.fullName,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Account creation failed");
      }

      toast({
        title: "Account created successfully!",
        description: "Redirecting you to login...",
        duration: 3000,
      });

      // Redirect to login after a short delay
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create account";
      setError(errorMessage);
      toast({
        title: "Account creation failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/50 py-8 px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <img src={logoPath} alt="Logo" className="h-16 object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              {step === "verify" ? "Verify Your Subscription" : "Create Your Account"}
            </CardTitle>
            <CardDescription className="text-center">
              {step === "verify"
                ? "Enter the email address associated with your subscription"
                : "Complete your account setup to get started"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "verify" ? (
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onVerifyEmail)} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            {...field}
                            disabled={isVerifying}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the email address you used when purchasing your subscription
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isVerifying}>
                    {isVerifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify Subscription"
                    )}
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...accountForm}>
                <form onSubmit={accountForm.handleSubmit(onCreateAccount)} className="space-y-4">
                  {subscriptionInfo && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <div className="font-semibold mb-1">Subscription Verified</div>
                        <div className="text-sm">
                          Email: {subscriptionInfo.email}
                          {subscriptionInfo.planName && (
                            <> • Plan: {subscriptionInfo.planName}</>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <FormField
                    control={accountForm.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Your Business Name"
                            {...field}
                            disabled={isCreating}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={accountForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Your Full Name"
                            {...field}
                            disabled={isCreating}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={accountForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Choose a username"
                            {...field}
                            disabled={isCreating}
                          />
                        </FormControl>
                        <FormDescription>
                          This will be used to log in to your account
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={accountForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Create a secure password"
                            {...field}
                            disabled={isCreating}
                          />
                        </FormControl>
                        <FormDescription>
                          Must be at least 8 characters long
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setStep("verify");
                        setError(null);
                      }}
                      disabled={isCreating}
                    >
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isCreating}>
                      {isCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

