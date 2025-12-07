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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { resolveApiUrl } from "@/lib/api";
import logoPath from "@assets/logo-m.png";

// Form validation schema - accepts either email or username
const loginSchema = z.object({
  email: z.string().min(1, "Email or username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormValues) {
    setError(null);
    setIsLoading(true);

    try {
      const loginUrl = resolveApiUrl("/api/auth/login");
      console.log("[Login] API URL:", loginUrl);
      console.log("[Login] Origin:", window.location.origin);
      
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
        throw new Error(result?.message || "Login failed");
      }
      
      const result = await response.json();

      const authToken = response.headers.get("X-Auth-Token");
      const userRole = result?.user?.role;
      const destination = userRole === "master" ? "/master" : "/dashboard";

      toast({
        title: "Welcome back",
        description: `Securing your workspace...`,
        duration: 1500,
      });

      if (authToken) {
        localStorage.setItem("authToken", authToken);
        console.log("[Login] Auth token stored in localStorage:", authToken.substring(0, 20) + "...");
      } else {
        console.warn("[Login] No X-Auth-Token header received from server");
      }

      // Set the user data in the query cache immediately so useAuth() knows we're authenticated
      // This prevents the redirect from triggering an auth check that fails
      queryClient.setQueryData(["/api/auth/me"], result.user);
      console.log("[Login] User data set in query cache:", result.user);

      // Clear all other cached queries to ensure fresh data for the new user
      // But preserve the auth query data we just set
      queryClient.getQueryCache().getAll().forEach(query => {
        if (query.queryKey[0] !== "/api/auth/me") {
          queryClient.removeQueries({ queryKey: query.queryKey });
        }
      });

      // Use React Router navigation instead of window.location.href to preserve query cache
      // This ensures the user data we just set persists across navigation
      console.log("[Login] Redirecting to:", destination);
      navigate(destination);
    } catch (err) {
      console.error("Login error:", err);
      let errorMessage = "An unexpected error occurred";
      
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        errorMessage = "Cannot connect to server. Please check your connection and ensure the backend is running. If this persists, it may be a CORS configuration issue.";
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
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
                className="mx-auto h-28 sm:h-36 w-auto drop-shadow-[0_10px_30px_rgba(16,185,129,0.2)]"
              />
            </div>

            <Card className="border border-gray-200 bg-white text-gray-900 shadow-xl shadow-gray-200/50">
              <CardHeader className="space-y-2 p-4 sm:p-6">
                <CardTitle className="text-xl sm:text-2xl font-semibold text-gray-900 text-center">
                  Login
                </CardTitle>
                <CardDescription className="text-sm sm:text-base text-gray-600 text-center">
                  Access your business, online, and secure
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {error && (
                  <Alert variant="destructive" className="mb-4 border-rose-300 bg-rose-50 text-rose-800">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField
                      control={form.control}
                      name="email"
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

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700">Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="••••••••"
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
                          Authorising...
                        </>
                      ) : (
                        "Enter workspace"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 sm:gap-3 text-center text-xs sm:text-sm text-gray-600 p-4 sm:p-6 pt-0">
                <p>
                  Need to register an account?{" "}
                  <a href="mailto:support@boltdown.co.uk" className="font-medium text-emerald-600 hover:text-emerald-700 underline-offset-2">
                    Request access
                  </a>
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 break-words">
                  Email: support@boltdown.co.uk • +44 7476888602
                </p>
              </CardFooter>
            </Card>
          </section>
        </main>

      </div>
    </div>
  );
}