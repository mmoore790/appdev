import { useState, useEffect, type ReactNode } from "react";
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
import { ModeToggle } from "@/components/ui/mode-toggle";
import logoPath from "@/assets/logo-m.png";

interface SidebarProps {
  className?: string;
}

type UserRole = "admin" | "staff" | "mechanic" | (string & {});

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
  allowedRoles?: UserRole[];
  matchPaths?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
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

  const navSections: NavSection[] = [
    {
      title: "Overview",
      items: [
        { path: "/dashboard", matchPaths: ["/", "/dashboard"], label: "Dashboard", icon: <LayoutDashboard size={18} />, allowedRoles: ["admin"] },
        { path: "/tasks", label: "Task Board", icon: <CheckSquare size={18} /> },
        { path: "/workshop", label: "Workshop", icon: <Wrench size={18} /> },
      ],
    },
    {
      title: "Customer",
      items: [
        { path: "/customers", label: "Customers", icon: <Users size={18} /> },
        { path: "/callbacks", label: "Callbacks", icon: <PhoneCall size={18} /> },
        { path: "/parts-on-order", label: "Parts on Order", icon: <Package size={18} /> },
      ],
    },
    {
      title: "Insights & Billing",
      items: [
        { path: "/analytics", label: "Analytics", icon: <BarChart3 size={18} />, allowedRoles: ["admin"] },
        { path: "/payments", label: "Payments", icon: <CreditCard size={18} />, allowedRoles: ["admin"] },
      ],
    },
    {
      title: "Administration",
      items: [
        { path: "/settings", label: "Settings", icon: <Settings size={18} />, allowedRoles: ["admin"] },
        { path: "/account", label: "Account", icon: <User size={18} /> },
      ],
    },
  ];

  const userRole: UserRole = (user?.role as UserRole | undefined) ?? "staff";
  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.allowedRoles || item.allowedRoles.includes(userRole),
      ),
    }))
    .filter((section) => section.items.length > 0);

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

  const renderNavigation = (isMobile = false) => (
    <nav
      className={cn(
        "flex-1 space-y-6 pb-6",
        isMobile ? "px-2" : "px-4",
      )}
    >
      {filteredSections.map((section) => (
        <div key={section.title} className="space-y-2">
          <p
            className={cn(
              "text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-sidebar-foreground/50",
              isMobile ? "px-1" : "px-1.5",
            )}
          >
            {section.title}
          </p>
          <div className="space-y-1.5">
            {section.items.map((item) => {
              const candidatePaths = item.matchPaths ?? [item.path];
              const isActive = candidatePaths.some((path) => location === path || location.startsWith(`${path}/`));

              return (
                <div key={item.path} onClick={() => setMobileMenuOpen(false)}>
                  <Link href={item.path}>
                    <div
                      className={cn(
                        "group flex items-center gap-3 rounded-xl transition-colors",
                        isMobile ? "px-3 py-2 text-sm" : "px-4 py-2.5 text-sm",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-black/10 ring-1 ring-sidebar-primary/30"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground transition-colors group-hover:bg-sidebar-primary/20 group-hover:text-sidebar-primary",
                          isActive && "bg-sidebar-primary/20 text-sidebar-primary-foreground",
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="font-medium">{item.label}</span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const renderUserInfo = (isMobile = false) => (
    <div
      className={cn(
        "border-t border-sidebar-border/60 bg-sidebar-background/60 backdrop-blur-sm",
        isMobile ? "p-4" : "p-5",
      )}
    >
      {user && (
        <div
          className={cn(
            "mb-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/80 p-3 text-left shadow-sm",
            isMobile ? "space-y-1.5" : "space-y-2",
          )}
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-sidebar-foreground/60">
            Signed in as
          </p>
          <p
            className={cn(
              "truncate font-semibold text-sidebar-foreground",
              isMobile ? "text-sm" : "text-base",
            )}
          >
            {user?.fullName || user?.username || "User"}
          </p>
          <p className="text-xs capitalize text-sidebar-foreground/60">
            {user?.role || "User"}
          </p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Link href="/account">
          <div
            className={cn(
              "flex items-center justify-center rounded-2xl bg-sidebar-accent text-sidebar-foreground transition-colors hover:bg-sidebar-primary/15 hover:text-sidebar-primary",
              isMobile ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm",
            )}
            onClick={() => setMobileMenuOpen(false)}
            title="Go to Account"
          >
            {user?.fullName ? (
              <span className="font-semibold">
                {user.fullName
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((name) => name[0])
                  .join("")
                  .toUpperCase()}
              </span>
            ) : (
              <User size={isMobile ? 16 : 18} />
            )}
          </div>
        </Link>
        <Link
          href="/account"
          onClick={() => setMobileMenuOpen(false)}
          className="flex-1"
        >
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground transition-colors hover:text-sidebar-primary">
              My Account
            </span>
            <span className="text-[0.7rem] text-sidebar-foreground/60">
              Manage profile & preferences
            </span>
          </div>
        </Link>
        <ModeToggle className={isMobile ? "h-9 w-9" : "h-10 w-10"} />
        <button
          onClick={handleLogout}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

    // Desktop sidebar
    return (
      <>
        {/* Desktop Sidebar */}
        <div className={cn("hidden md:flex md:w-72 md:flex-col", className)}>
          <div className="flex flex-col flex-grow overflow-y-auto border-r border-sidebar-border/70 bg-sidebar pt-6 shadow-lg shadow-black/5">
            <div className="flex flex-shrink-0 flex-col items-center gap-2 px-6 pb-6">
              <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                <img
                  src={logoPath}
                  alt="Moore Horticulture Equipment Logo"
                  className="h-12 w-auto cursor-pointer drop-shadow-sm"
                />
              </Link>
              <p className="text-center text-xs font-medium uppercase tracking-[0.3em] text-sidebar-foreground/50">
                Service Command Centre
              </p>
            </div>
            {renderNavigation()}

            {/* Error Reporting Section */}
            <div className="px-4 pb-6">
              <a
                href="https://forms.gle/RUmyv2Ap7fbX1QH98"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/70 px-4 py-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sidebar-background text-sidebar-foreground transition-colors group-hover:bg-sidebar-primary/20 group-hover:text-sidebar-primary">
                  <Bug size={18} />
                </span>
                <span className="flex flex-col">
                  <span>Error Reporting</span>
                  <span className="text-xs font-normal text-sidebar-foreground/60">
                    Flag issues & improvement ideas
                  </span>
                </span>
              </a>
            </div>

            {renderUserInfo()}
          </div>
        </div>

        {/* Mobile Header with Logo and Menu Button */}
        <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between border-b border-border/70 bg-background/80 px-4 py-2 backdrop-blur-md md:hidden">
          <Link href="/" onClick={() => setMobileMenuOpen(false)}>
            <img
              src={logoPath}
              alt="Moore Horticulture Equipment Logo"
              className="h-8 w-auto cursor-pointer drop-shadow-sm"
            />
          </Link>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="rounded-full p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                aria-label="Menu"
              >
                <Menu size={22} />
              </button>
            </SheetTrigger>
            <SheetOverlay className="bg-black/50 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <SheetContent
              side="left"
              className="w-[220px] border-r border-sidebar-border/60 bg-sidebar p-0 sm:w-[250px] focus:outline-none"
            >
              <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
                <div className="flex items-center justify-between border-b border-sidebar-border/60 px-4 py-3">
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2"
                  >
                    <img
                      src={logoPath}
                      alt="Moore Horticulture Equipment Logo"
                      className="h-7 w-auto cursor-pointer drop-shadow-sm"
                    />
                  </Link>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-full p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    aria-label="Close menu"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-1.5">
                  {renderNavigation(true)}

                  {/* Error Reporting Section - Mobile */}
                  <div className="px-3 pb-4 pt-2">
                    <a
                      href="https://forms.gle/RUmyv2Ap7fbX1QH98"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/60 px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sidebar-background text-sidebar-foreground transition-colors group-hover:bg-sidebar-primary/20 group-hover:text-sidebar-primary">
                        <Bug size={18} />
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
