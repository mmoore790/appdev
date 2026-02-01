import React, { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HorizontalNav } from "@/components/ui/horizontal-nav";
import { Spinner } from "@/components/ui/spinner";
import logLogo from "@/assets/logo-m.png";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import Workshop from "@/pages/workshop";
import WorkshopJobDetail from "@/pages/workshop-job-detail";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import Register from "@/pages/register";
import Account from "@/pages/account";
import Customers from "@/pages/customers";
import CustomerDetail from "@/pages/customer-detail";
import PaymentSuccess from "@/pages/payment-success";
import PaymentCancel from "@/pages/payment-cancel";
import Callbacks from "@/pages/callbacks";
import JobTracker from "@/pages/job-tracker";
import Orders from "@/pages/orders";
import OrderTracker from "@/pages/order-tracker";
import Activities from "@/pages/activities";
import CalendarPage from "@/pages/calendar";
import MasterDashboard from "@/pages/master-dashboard";
import Messages from "@/pages/messages";
import GettingStarted from "@/pages/getting-started";
import OnboardingSetup from "@/pages/onboarding-setup";
import { useAuth } from "./hooks/useAuth";

// Protected route component
interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  allowedRoles?: string[];
  [key: string]: any;
}

function ProtectedRoute({ component: Component, allowedRoles, ...rest }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, error, user } = useAuth();
  const [, navigate] = useLocation();
  
  useEffect(() => {
    // Don't redirect if we're still loading
    if (isLoading) {
      return;
    }

    // Only redirect if we're sure the user is not authenticated
    // With returnNull behavior, 401 errors won't set error, they'll just return null user
    if (!isAuthenticated) {
      // Check if we have a token in localStorage - if so, give it more time to work
      const hasToken = typeof window !== "undefined" && localStorage.getItem("authToken");
      if (!hasToken) {
        console.log("Not authenticated and no token, redirecting to login page");
        navigate("/login");
      } else {
        // We have a token - the auth query might still be loading or retrying
        // Give it more time (3 seconds) before redirecting
        console.log("Not authenticated but token exists, waiting for auth check...");
        const timeoutId = setTimeout(() => {
          // Re-check authentication state after delay
          if (!isAuthenticated) {
            console.log("Still not authenticated after delay with token, redirecting to login");
            console.log("Token in localStorage:", localStorage.getItem("authToken") ? "exists" : "missing");
            navigate("/login");
          }
        }, 3000);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && allowedRoles && user && !allowedRoles.includes(user.role)) {
      const fallback = user.role === "master" ? "/master" : "/dashboard";
      navigate(fallback);
    }
  }, [allowedRoles, user, isAuthenticated, isLoading, navigate]);
  
  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-r from-slate-50 to-blue-50/50">
        <Spinner size="lg" text="Loading your dashboard..." />
      </div>
    );
  }
  
  // Only render the component if the user is authenticated
  if (!isAuthenticated) {
    return null;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <Component {...rest} />;
}

const operationalRoles = ["admin", "staff", "mechanic"];

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/onboarding/setup-account" component={OnboardingSetup} />
      {/* Registration is now master-only - removed public route */}
      <Route path="/job-tracker" component={JobTracker} />
      <Route path="/track" component={JobTracker} /> {/* Alternative URL for job tracking */}
      <Route path="/order-tracker" component={OrderTracker} />
      <Route path="/track-order" component={OrderTracker} /> {/* Alternative URL for order tracking */}
      
      {/* Master-only routes */}
      <Route path="/master">
        {() => <ProtectedRoute component={MasterDashboard} allowedRoles={["master"]} />}
      </Route>
      
      {/* Protected routes */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/getting-started">
        {() => <ProtectedRoute component={GettingStarted} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/tasks">
        {() => <ProtectedRoute component={Tasks} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/workshop/jobs/:jobId">
        {() => <ProtectedRoute component={WorkshopJobDetail} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/workshop">
        {() => <ProtectedRoute component={Workshop} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/analytics">
        {() => <ProtectedRoute component={Analytics} allowedRoles={["admin"]} />}
      </Route>
      <Route path="/customers">
        {() => <ProtectedRoute component={Customers} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/customers/:id/details">
        {() => <ProtectedRoute component={CustomerDetail} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/customers/:id">
        {() => <ProtectedRoute component={CustomerDetail} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} allowedRoles={["admin"]} />}
      </Route>
      <Route path="/account">
        {() => <ProtectedRoute component={Account} />}
      </Route>

      <Route path="/callbacks">
        {() => <ProtectedRoute component={Callbacks} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/payments/success" component={PaymentSuccess} />
      <Route path="/payments/cancel" component={PaymentCancel} />
      <Route path="/orders">
        {() => <ProtectedRoute component={Orders} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/activities">
        {() => <ProtectedRoute component={Activities} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/calendar">
        {() => <ProtectedRoute component={CalendarPage} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/messages">
        {() => <ProtectedRoute component={Messages} allowedRoles={operationalRoles} />}
      </Route>
      <Route path="/">
        {() => <ProtectedRoute component={DefaultLanding} />}
      </Route>
      
      {/* Not found route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function DefaultLanding() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      navigate(user.role === "master" ? "/master" : "/dashboard", { replace: true });
    }
  }, [isLoading, user, navigate]);

  return (
    <div className="flex justify-center items-center h-screen bg-gradient-to-r from-slate-50 to-blue-50/50">
      <Spinner size="lg" text="Loading your workspace..." />
    </div>
  );
}

function AuthAwareLayout() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const publicRoutes = ['/login', '/forgot-password', '/onboarding/setup-account']; // Registration removed - now master-only
  const customerPortalRoutes = ['/job-tracker', '/order-tracker', '/track-order', '/payments/success', '/payments/cancel']; // Customer-facing pages
  
  const isPublicRoute = publicRoutes.includes(location);
  const isCustomerPortalRoute = customerPortalRoutes.includes(location);
  
  // For login, registration, job tracker, and payment pages, don't show the sidebar/header
  if (!isAuthenticated || isPublicRoute || isCustomerPortalRoute) {
    return (
      <div className="bg-slate-50 min-h-screen">
        <Router />
      </div>
    );
  }
  
  // For protected routes, show the full app layout with horizontal navigation
  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <HorizontalNav />
      <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50 min-h-0">
        <main className="flex-1 relative pb-3 sm:pb-4 md:pb-8 z-0 min-w-0">
          <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 md:py-6">
            <Router />
          </div>
        </main>
        <footer className="bg-white border-t border-slate-200 py-3 px-3 sm:py-4 sm:px-4 md:py-6 md:px-6 text-center flex-shrink-0">
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <img src={logLogo} alt="BoltDown Logo" className="h-7 sm:h-8 md:h-10 w-auto" />
            <div className="flex flex-col items-center gap-0.5 sm:gap-1 text-black text-[9px] sm:text-[10px] md:text-xs">
              <p>BoltDown UK © 2026</p>
              <p className="break-all">support@boltdown.co.uk</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthAwareLayout />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
