import React, { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import Workshop from "@/pages/workshop";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Account from "@/pages/account";
import Payments from "@/pages/payments";
import Customers from "@/pages/customers";
import PaymentSuccess from "@/pages/payment-success";
import PaymentCancel from "@/pages/payment-cancel";
import Callbacks from "@/pages/callbacks";
import JobTracker from "@/pages/job-tracker";
import PartsOnOrder from "@/pages/parts-on-order";
import { useAuth } from "./hooks/useAuth";

// Protected route component
function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType<any>, [key: string]: any }) {
  const { isAuthenticated, isLoading, error } = useAuth();
  const [, navigate] = useLocation();
  
  useEffect(() => {
    // If we're not loading and the user is not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      console.log("Not authenticated, redirecting to login page");
      navigate("/login");
    }
    
    // If there was an auth error (like 401), also redirect
    if (error) {
      console.error("Auth error:", error);
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, navigate, error]);
  
  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-r from-green-50 to-blue-50">
        <Spinner size="lg" text="Loading your dashboard..." />
      </div>
    );
  }
  
  // Only render the component if the user is authenticated
  return isAuthenticated ? <Component {...rest} /> : null;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/job-tracker" component={JobTracker} />
      <Route path="/track" component={JobTracker} /> {/* Alternative URL for job tracking */}
      
      {/* Protected routes */}
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/tasks">
        {() => <ProtectedRoute component={Tasks} />}
      </Route>
      <Route path="/workshop">
        {() => <ProtectedRoute component={Workshop} />}
      </Route>
      <Route path="/analytics">
        {() => <ProtectedRoute component={Analytics} />}
      </Route>
      <Route path="/customers">
        {() => <ProtectedRoute component={Customers} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/account">
        {() => <ProtectedRoute component={Account} />}
      </Route>

      <Route path="/callbacks">
        {() => <ProtectedRoute component={Callbacks} />}
      </Route>
      <Route path="/payments">
        {() => <ProtectedRoute component={Payments} />}
      </Route>
      <Route path="/payments/success" component={PaymentSuccess} />
      <Route path="/payments/cancel" component={PaymentCancel} />
      <Route path="/parts-on-order">
        {() => <ProtectedRoute component={PartsOnOrder} />}
      </Route>
      
      {/* Not found route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthAwareLayout() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const publicRoutes = ['/login', '/register'];
  const customerPortalRoutes = ['/job-tracker', '/payments/success', '/payments/cancel']; // Customer-facing pages
  
  const isPublicRoute = publicRoutes.includes(location);
  const isCustomerPortalRoute = customerPortalRoutes.includes(location);
  
  // For login, registration, job tracker, and payment pages, don't show the sidebar/header
  if (!isAuthenticated || isPublicRoute || isCustomerPortalRoute) {
    return (
      <div className="bg-neutral-100 min-h-screen">
        <Router />
      </div>
    );
  }
  
  // For protected routes, show the full app layout with sidebar
  return (
    <div className="flex flex-col md:flex-row h-screen bg-neutral-100">
      <Sidebar />
      <div className="flex-1 focus:outline-none mt-12 md:mt-0 overflow-y-auto flex flex-col">
        <main className="flex-1 relative pb-8 z-0">
          <Router />
        </main>
        <footer className="bg-white border-t border-neutral-200 py-3 px-6 text-center text-xs text-neutral-500 flex-shrink-0">
          Designed and developed in house by Matthew Moore
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
