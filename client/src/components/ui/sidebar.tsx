import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Wrench, 
  Users, 
  BarChart3, 
  ClipboardList, 
  Settings,
  User,
  LogOut,
  Menu,
  X,
  Mail,
  PhoneCall,
  Bug,
  CreditCard,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetOverlay 
} from "@/components/ui/sheet";
import logoPath from "@/assets/logo-m.png";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Handle keyboard shortcuts (Escape key to close mobile menu)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    
    // Clean up event listener on unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);
  
  // We'll let the Sheet component handle scroll locking instead of manually managing it
  // This should fix scrolling issues on mobile

  const navItems = [
    { path: "/", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
    { path: "/tasks", label: "Task Board", icon: <CheckSquare size={20} /> },
    { path: "/workshop", label: "Workshop", icon: <Wrench size={20} /> },
    { path: "/parts-on-order", label: "Parts on Order", icon: <Package size={20} /> },
    { path: "/analytics", label: "Analytics", icon: <BarChart3 size={20} /> },
    { path: "/callbacks", label: "Callbacks", icon: <PhoneCall size={20} /> },
    { path: "/payments", label: "Payments", icon: <CreditCard size={20} /> },
    { path: "/settings", label: "Settings", icon: <Settings size={20} /> },
    { path: "/account", label: "Account", icon: <User size={20} /> },
  ];

  const handleLogout = () => {
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    }).then((response) => response.json())
      .then((data) => {
        toast({
          title: "Logout Success",
          description: "You have been logged out successfully.",
          duration: 3000,
        });
        // Short delay to allow toast to be seen
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      })
      .catch((error) => {
        console.error('Logout error:', error);
        toast({
          title: "Logout Failed",
          description: "There was a problem logging you out. Please try again.",
          variant: "destructive",
        });
      });
  };

  const renderNavItems = (isMobile = false) => (
    <nav className={cn(
      "flex-1 pb-4 space-y-1",
      isMobile ? "px-1" : "px-2"
    )}>
      {navItems.map((item) => (
        <div key={item.path} onClick={() => setMobileMenuOpen(false)}>
          <Link href={item.path}>
            <div
              className={cn(
                "flex items-center rounded-md cursor-pointer transition-colors duration-200",
                isMobile 
                  ? "px-2.5 py-1.5 text-sm" 
                  : "px-3 py-2 text-sm font-medium",
                location === item.path
                  ? "bg-green-700 text-white"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-green-700"
              )}
            >
              <span className={cn(
                "flex-shrink-0",
                isMobile ? "mr-2" : "mr-3"
              )}>
                {item.icon}
              </span>
              {item.label}
            </div>
          </Link>
        </div>
      ))}
    </nav>
  );

  const renderUserInfo = (isMobile = false) => (
    <div className={cn(
      "border-t border-neutral-200",
      isMobile ? "p-3" : "p-4"
    )}>
      {user && (
        <div className={cn(
          "mb-2 bg-green-50 rounded-md p-2 text-center",
          isMobile ? "px-2 py-1.5" : "px-3 py-2"
        )}>
          <p className={cn(
            "font-medium text-green-800",
            isMobile ? "text-xs" : "text-sm"
          )}>
            Logged in as
          </p>
          <p className={cn(
            "font-semibold text-green-700 truncate",
            isMobile ? "text-sm" : "text-base"
          )}>
            {user?.fullName || user?.username || 'User'}
          </p>
        </div>
      )}
      <div className="flex items-center">
        <Link href="/account">
          <div className={cn(
            "rounded-full bg-green-100 flex items-center justify-center text-green-700 cursor-pointer hover:bg-green-200 transition-colors duration-200",
            isMobile ? "h-7 w-7" : "h-8 w-8"
          )} onClick={() => setMobileMenuOpen(false)} title="Go to Account">
            {user?.fullName ? (
              <span className={cn(
                "font-semibold",
                isMobile ? "text-xs" : "text-sm"
              )}>
                {user.fullName.split(' ').map(name => name[0]).join('')}
              </span>
            ) : (
              <User size={isMobile ? 16 : 18} />
            )}
          </div>
        </Link>
        <Link href="/account" onClick={() => setMobileMenuOpen(false)} className={cn("flex-1", isMobile ? "ml-2" : "ml-3")}>
          <p className={cn(
            "font-medium text-neutral-500 truncate hover:text-green-700 transition-colors duration-200",
            isMobile ? "text-xs" : "text-sm"
          )}>
            My Account
          </p>
          <p className={cn(
            "text-neutral-400 capitalize",
            isMobile ? "text-[0.65rem]" : "text-xs"
          )}>
            {user?.role || 'User'}
          </p>
        </Link>
        <button
          onClick={handleLogout}
          className="text-neutral-400 hover:text-red-500 cursor-pointer transition-colors duration-200"
          title="Logout"
        >
          <LogOut size={isMobile ? 15 : 16} />
        </button>
      </div>
    </div>
  );

  // Desktop sidebar
  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn("hidden md:flex md:w-64 md:flex-col", className)}>
        <div className="flex flex-col flex-grow pt-5 bg-white border-r border-neutral-200 overflow-y-auto">
          <div className="flex items-center justify-center flex-shrink-0 px-4 mb-5">
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>
              <img 
                src={logoPath}
                alt="Moore Horticulture Equipment Logo" 
                className="h-14 w-auto cursor-pointer"
              />
            </Link>
          </div>
          {renderNavItems()}
          
          {/* Error Reporting Section */}
          <div className="px-2 pb-4">
            <a 
              href="https://forms.gle/RUmyv2Ap7fbX1QH98" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100 hover:text-green-700 rounded-md cursor-pointer transition-colors duration-200"
            >
              <span className="flex-shrink-0 mr-3">
                <Bug size={20} />
              </span>
              Error Reporting
            </a>
          </div>
          
          {renderUserInfo()}
        </div>
      </div>

      {/* Mobile Header with Logo and Menu Button */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-white border-b border-neutral-200 fixed top-0 left-0 right-0 z-20">
        <Link href="/" onClick={() => setMobileMenuOpen(false)}>
          <img 
            src={logoPath}
            alt="Moore Horticulture Equipment Logo" 
            className="h-8 w-auto cursor-pointer"
          />
        </Link>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <button 
              className="p-1.5 rounded-md text-neutral-500 hover:text-green-700 hover:bg-neutral-100 transition-colors duration-200"
              aria-label="Menu"
            >
              <Menu size={22} />
            </button>
          </SheetTrigger>
          <SheetOverlay 
            className="bg-black/50 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" 
          />
          <SheetContent 
            side="left" 
            className="p-0 border-r border-neutral-200 w-[200px] sm:w-[240px] focus:outline-none"
          >
            <div className="flex flex-col h-full bg-white">
              <div className="flex items-center justify-between p-2 border-b border-neutral-200">
                <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                  <img 
                    src={logoPath}
                    alt="Moore Horticulture Equipment Logo" 
                    className="h-6 w-auto cursor-pointer"
                  />
                </Link>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors duration-200"
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-1.5">
                {renderNavItems(true)}
                
                {/* Error Reporting Section - Mobile */}
                <div className="px-1 pb-3">
                  <a 
                    href="https://forms.gle/RUmyv2Ap7fbX1QH98" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center px-2.5 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-green-700 rounded-md cursor-pointer transition-colors duration-200"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="flex-shrink-0 mr-2">
                      <Bug size={20} />
                    </span>
                    Error Reporting
                  </a>
                </div>
              </div>
              {renderUserInfo(true)}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
