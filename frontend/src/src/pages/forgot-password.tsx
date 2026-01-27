import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api";
import logoPath from "@assets/logo-m.png";

// Step 1: Request reset code
const requestResetSchema = z.object({
  emailOrUsername: z.string().min(1, "Email or username is required"),
});

// Step 2: Verify code
const verifyCodeSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

// Step 3: Reset password
const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(7, "Password must be at least 7 characters long")
    .regex(/\d/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RequestResetFormValues = z.infer<typeof requestResetSchema>;
type VerifyCodeFormValues = z.infer<typeof verifyCodeSchema>;
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const requestResetForm = useForm<RequestResetFormValues>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: {
      emailOrUsername: "",
    },
  });

  const verifyCodeForm = useForm<VerifyCodeFormValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: {
      code: "",
    },
  });

  const resetPasswordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onRequestReset(data: RequestResetFormValues) {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(resolveApiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emailOrUsername: data.emailOrUsername }),
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ message: "Request failed" }));
        throw new Error(result?.message || "Failed to request password reset");
      }

      setEmailOrUsername(data.emailOrUsername);
      setStep(2);
      toast({
        title: "Reset code sent",
        description: "Please check your email for the reset code.",
        duration: 5000,
      });
    } catch (err) {
      console.error("Request reset error:", err);
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function onVerifyCode(data: VerifyCodeFormValues) {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(resolveApiUrl("/api/auth/verify-reset-code"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: data.code,
          emailOrUsername: emailOrUsername,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ message: "Verification failed" }));
        throw new Error(result?.message || "Invalid or expired code");
      }

      setStep(3);
      toast({
        title: "Code verified",
        description: "Please enter your new password.",
        duration: 3000,
      });
    } catch (err) {
      console.error("Verify code error:", err);
      const errorMessage = err instanceof Error ? err.message : "Invalid or expired code";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function onResetPassword(data: ResetPasswordFormValues) {
    setError(null);
    setIsLoading(true);

    try {
      const code = verifyCodeForm.getValues("code");
      const response = await fetch(resolveApiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code,
          emailOrUsername: emailOrUsername,
          newPassword: data.newPassword,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ message: "Reset failed" }));
        throw new Error(result?.message || "Failed to reset password");
      }

      toast({
        title: "Password reset successful",
        description: "Your password has been reset. Redirecting to login...",
        duration: 3000,
      });

      // Redirect to login after a short delay
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      console.error("Reset password error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to reset password";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-emerald-50/30" />
        <div className="absolute -left-32 top-10 h-[32rem] w-[32rem] rounded-full bg-emerald-100/40 blur-[200px]" />
        <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-sky-100/40 blur-[180px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <main className="container mx-auto flex flex-1 items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
          <section className="w-full max-w-md space-y-6 sm:space-y-8 px-2">
            <div className="space-y-3 sm:space-y-4">
              <img
                src={logoPath}
                alt="Moore Horticulture Equipment Logo"
                className="mx-auto h-20 sm:h-24 w-auto drop-shadow-[0_10px_30px_rgba(16,185,129,0.2)]"
              />
            </div>

            <Card className="border border-gray-200 bg-white text-gray-900 shadow-xl shadow-gray-200/50">
              <CardHeader className="space-y-2 p-4 sm:p-6">
                <CardTitle className="text-xl sm:text-2xl font-semibold text-gray-900 text-center">
                  {step === 1 && "Forgot Password"}
                  {step === 2 && "Enter Reset Code"}
                  {step === 3 && "Create New Password"}
                </CardTitle>
                <CardDescription className="text-sm sm:text-base text-gray-600 text-center">
                  {step === 1 && "Enter your email or username to receive a reset code"}
                  {step === 2 && "Enter the 6-digit code sent to your email"}
                  {step === 3 && "Enter your new password"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {error && (
                  <Alert variant="destructive" className="mb-4 border-rose-300 bg-rose-50 text-rose-800">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Step 1: Request Reset */}
                {step === 1 && (
                  <Form {...requestResetForm}>
                    <form onSubmit={requestResetForm.handleSubmit(onRequestReset)} className="space-y-5">
                      <FormField
                        control={requestResetForm.control}
                        name="emailOrUsername"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">Email or Username</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="email@example.com or username"
                                className="h-14 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="h-12 sm:h-14 w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 text-base sm:text-lg font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-600 hover:to-emerald-800 disabled:opacity-70 min-h-[44px]"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Send Reset Code"
                        )}
                      </Button>
                    </form>
                  </Form>
                )}

                {/* Step 2: Verify Code */}
                {step === 2 && (
                  <Form {...verifyCodeForm}>
                    <form onSubmit={verifyCodeForm.handleSubmit(onVerifyCode)} className="space-y-5">
                      <FormField
                        control={verifyCodeForm.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">Reset Code</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="000000"
                                maxLength={6}
                                className="h-14 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 text-center text-2xl tracking-widest font-mono"
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                                  field.onChange(value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-gray-500 mt-1">
                              Enter the 6-digit code sent to your email
                            </p>
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="h-12 sm:h-14 w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 text-base sm:text-lg font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-600 hover:to-emerald-800 disabled:opacity-70 min-h-[44px]"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          "Verify Code"
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => setStep(1)}
                        disabled={isLoading}
                      >
                        Back
                      </Button>
                    </form>
                  </Form>
                )}

                {/* Step 3: Reset Password */}
                {step === 3 && (
                  <Form {...resetPasswordForm}>
                    <form onSubmit={resetPasswordForm.handleSubmit(onResetPassword)} className="space-y-5">
                      <FormField
                        control={resetPasswordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">New Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Enter new password"
                                  className="h-14 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 pr-10"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                  tabIndex={-1}
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-5 w-5" />
                                  ) : (
                                    <Eye className="h-5 w-5" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-gray-500 mt-1">
                              Must be at least 7 characters and contain at least one number
                            </p>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={resetPasswordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">Confirm Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showConfirmPassword ? "text" : "password"}
                                  placeholder="Confirm new password"
                                  className="h-14 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 pr-10"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                  tabIndex={-1}
                                >
                                  {showConfirmPassword ? (
                                    <EyeOff className="h-5 w-5" />
                                  ) : (
                                    <Eye className="h-5 w-5" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="h-12 sm:h-14 w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 text-base sm:text-lg font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-600 hover:to-emerald-800 disabled:opacity-70 min-h-[44px]"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Resetting...
                          </>
                        ) : (
                          "Reset Password"
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => setStep(2)}
                        disabled={isLoading}
                      >
                        Back
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-2 sm:gap-3 text-center text-xs sm:text-sm text-gray-600 p-4 sm:p-6 pt-0">
                <p>
                  Remember your password?{" "}
                  <a 
                    href="/login" 
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/login");
                    }}
                    className="font-medium text-emerald-600 hover:text-emerald-700 underline-offset-2"
                  >
                    Sign in
                  </a>
                </p>
              </CardFooter>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
