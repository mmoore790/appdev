import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Wrench, 
  Users, 
  BarChart3, 
  Settings,
  User,
  LogOut,
  Menu,
  X,
  PhoneCall,
  Bug,
  Package,
  ChevronDown,
  Calendar,
  Shield,
  Bell,
  HelpCircle,
  Rocket
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { MessagesIcon } from "@/components/messages-icon";
import { HelpDialog } from "@/components/help-dialog";
import { useQuery } from "@tanstack/react-query";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetOverlay 
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import logoPath from "@/assets/logo-m.png";

interface HorizontalNavProps {
  className?: string;
}

type UserRole = "admin" | "staff" | "mechanic" | (string & {});

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
  allowedRoles?: UserRole[];
}

interface NavGroup {
  label: string;
  icon: ReactNode;
  items: NavItem[];
  allowedRoles?: UserRole[];
}

export function HorizontalNav({ className }: HorizontalNavProps) {
  const [location] = useLocation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const operationalRoles: UserRole[] = ["admin", "staff", "mechanic"];

  // Fetch business information
  const { data: businessData } = useQuery<{
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    website?: string | null;
    logoUrl?: string | null;
    jobTrackerEnabled?: boolean | null;
  }>({
    queryKey: ["/api/business/me"],
  });

  // Check if Getting Started should be shown (first 14 days and not dismissed)
  const shouldShowGettingStarted = (() => {
    if (!user?.createdAt) return false;
    if (user.gettingStartedDismissedAt) return false;
    
    const createdAt = new Date(user.createdAt);
    const daysSinceCreation = Math.floor(
      (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return daysSinceCreation < 14;
  })();
  
  // Handle keyboard shortcuts (Escape key to close mobile menu)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  // Primary navigation items (always visible)
  const primaryNavItems: NavItem[] = [
    { path: "/master", label: "Master", icon: <Shield size={16} />, allowedRoles: ["master"] },
    { path: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} />, allowedRoles: operationalRoles },
    { path: "/workshop", label: "Workshop", icon: <Wrench size={16} />, allowedRoles: operationalRoles },
    { path: "/tasks", label: "Tasks", icon: <CheckSquare size={16} />, allowedRoles: operationalRoles },
    { path: "/callbacks", label: "Callbacks", icon: <PhoneCall size={16} />, allowedRoles: operationalRoles },
    { path: "/customers", label: "Customers", icon: <Users size={16} />, allowedRoles: operationalRoles },
    { path: "/orders", label: "Orders", icon: <Package size={16} />, allowedRoles: operationalRoles },
    { path: "/calendar", label: "Calendar", icon: <Calendar size={16} />, allowedRoles: operationalRoles },
  ];

  // Add Getting Started to navigation if it should be shown (after Dashboard)
  if (shouldShowGettingStarted && user && operationalRoles.includes(user.role as UserRole)) {
    primaryNavItems.splice(1, 0, {
      path: "/getting-started",
      label: "Getting Started",
      icon: <Rocket size={16} />,
      allowedRoles: operationalRoles,
    });
  }

  // Admin group (analytics, settings)
  const adminGroup: NavGroup = {
    label: "Admin",
    icon: <Settings size={16} />,
    items: [
      { path: "/analytics", label: "Analytics", icon: <BarChart3 size={16} />, allowedRoles: ["admin"] },
      { path: "/settings", label: "Company Settings", icon: <Settings size={16} />, allowedRoles: ["admin"] },
    ],
    allowedRoles: ["admin"],
  };

  const userRole: UserRole = (user?.role as UserRole | undefined) ?? "staff";
  
  // Filter primary items
  const filteredPrimaryItems = primaryNavItems.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(userRole)
  );

  // Filter groups
  const allGroups = [adminGroup].filter(
    (group) => !group.allowedRoles || group.allowedRoles.includes(userRole)
  );

  const handleLogout = () => {
    fetch(resolveApiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include'
    }).then((response) => response.json())
      .then((data) => {
        toast({
          title: "Logout Success",
          description: "You have been logged out successfully.",
          duration: 3000,
        });
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

  return (
    <>
      {/* Desktop Horizontal Navigation */}
      <nav className={cn(
        "hidden md:flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200",
        "sticky top-0 z-50 text-slate-900",
        className
      )}>
        {/* Logo */}
        <Link
          href={userRole === "master" ? "/master" : "/dashboard"}
          className="flex items-center space-x-2 hover:opacity-80 transition-opacity flex-shrink-0"
        >
          <img 
            src={logoPath}
            alt="Moore Horticulture Equipment Logo" 
            className="h-7 w-auto drop-shadow-sm"
          />
        </Link>

        {/* Navigation Items - Compact Layout */}
        <div className="flex items-center space-x-0.5 flex-1 justify-center max-w-4xl mx-4">
          {/* Primary Navigation Items */}
          {filteredPrimaryItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <div
                className={cn(
                  "flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                  "hover:bg-emerald-100 hover:text-emerald-700",
                  location === item.path
                    ? "bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-800 hover:text-white"
                    : "text-slate-700"
                )}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            </Link>
          ))}

          {/* Grouped Navigation Items */}
          {allGroups.map((group) => {
            const groupItems = group.items.filter(
              (item) => !item.allowedRoles || item.allowedRoles.includes(userRole)
            );
            
            if (groupItems.length === 0) return null;

            const isAnyActive = groupItems.some((item) => location === item.path);

            return (
              <DropdownMenu key={group.label}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                      "hover:bg-emerald-100 hover:text-emerald-700",
                      isAnyActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "text-slate-700"
                    )}
                  >
                    <span className="flex-shrink-0">{group.icon}</span>
                    <span>{group.label}</span>
                    <ChevronDown size={12} className="ml-0.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48 bg-white border border-slate-200 shadow-lg">
                  <DropdownMenuLabel className="text-xs font-semibold text-slate-500 px-2 py-1.5">
                    {group.label}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  {groupItems.map((item) => (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link
                        href={item.path}
                        className={cn(
                          "flex items-center space-x-2 px-2 py-1.5 text-xs cursor-pointer",
                          location === item.path
                            ? "bg-emerald-50 text-emerald-700 font-medium hover:text-emerald-700"
                            : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                        )}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>

        {/* Right Side - User Menu & Actions */}
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          {/* Messages */}
          <MessagesIcon />
          
          {/* Notifications */}
          <NotificationsDropdown />

          {/* Account Dropdown - Compact */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center space-x-1.5 px-2 py-1.5 rounded-md hover:bg-emerald-100 transition-colors duration-200 focus:outline-none">
                <div className="h-7 w-7 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 flex items-center justify-center text-white font-semibold text-xs shadow-sm shadow-emerald-500/30">
                  {user?.fullName ? (
                    <span>
                      {user.fullName.split(' ').map(name => name[0]).join('')}
                    </span>
                  ) : (
                    <User size={14} />
                  )}
                </div>
                <div className="hidden xl:block text-left">
                  <p className="text-xs font-medium text-slate-900 leading-tight">
                    {user?.fullName?.split(' ')[0] || user?.username || 'User'}
                  </p>
                  <p className="text-[10px] text-slate-600 capitalize leading-tight">
                    {user?.role || 'User'}
                  </p>
                </div>
                <ChevronDown size={12} className="text-slate-600 hidden xl:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-white border border-slate-200 shadow-lg">
              <div className="px-2 py-1.5 border-b border-slate-200">
                <p className="text-xs font-medium text-slate-900">
                  {user?.fullName || user?.username || 'User'}
                </p>
                {businessData?.name ? (
                  <p className="text-[10px] text-slate-700 font-medium mt-0.5">
                    {businessData.name}
                  </p>
                ) : null}
                <p className="text-[10px] text-slate-600 capitalize">
                  {user?.role || 'User'}
                </p>
              </div>
              <DropdownMenuItem asChild className="text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 focus:bg-emerald-50 focus:text-emerald-700 text-xs py-1.5">
                <Link href="/account" className="cursor-pointer">
                  <User size={14} className="mr-2" />
                  My Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-200" />
              <DropdownMenuItem 
                onClick={() => setHelpDialogOpen(true)}
                className="text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 focus:bg-emerald-50 focus:text-emerald-700 text-xs py-1.5 cursor-pointer"
              >
                <HelpCircle size={14} className="mr-2" />
                Help
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-200" />
              <a 
                href="https://forms.gle/RUmyv2Ap7fbX1QH98" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center px-2 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer rounded-sm"
              >
                <Bug size={14} className="mr-2" />
                Report Issue
              </a>
              <DropdownMenuSeparator className="bg-slate-200" />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer focus:bg-rose-50 focus:text-rose-700 text-xs py-1.5"
              >
                <LogOut size={14} className="mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-50">
        <Link
          href={userRole === "master" ? "/master" : "/dashboard"}
          onClick={() => setMobileMenuOpen(false)}
        >
          <img 
            src={logoPath}
            alt="Moore Horticulture Equipment Logo" 
            className="h-7 w-auto drop-shadow-sm"
          />
        </Link>
        
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <button 
              className="p-2 rounded-md text-slate-700 hover:text-emerald-700 hover:bg-emerald-100 transition-colors duration-200"
              aria-label="Menu"
            >
              <Menu size={20} />
            </button>
          </SheetTrigger>
          <SheetOverlay 
            className="bg-black/50 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" 
          />
          <SheetContent 
            side="right" 
            className="p-0 border-l border-slate-200 w-[280px] sm:w-[300px] focus:outline-none bg-white"
          >
            <div className="flex flex-col h-full bg-white text-slate-900">
              {/* Mobile Header */}
              <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-emerald-50/50">
                <div>
                  <p className="text-xs font-medium text-slate-600">Logged in as</p>
                  <p className="text-sm font-semibold text-slate-900 leading-tight">
                    {user?.fullName || user?.username || 'User'}
                  </p>
                  {businessData?.name ? (
                    <p className="text-[10px] text-slate-700 font-medium mt-0.5">
                      {businessData.name}
                    </p>
                  ) : null}
                  <p className="text-[10px] text-slate-600 capitalize mt-0.5">
                    {user?.role || 'User'}
                  </p>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors duration-200"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mobile Navigation Items */}
              <div className="flex-1 overflow-y-auto py-3">
                <nav className="space-y-0.5 px-2">
                  {/* Getting Started - Mobile */}
                  {shouldShowGettingStarted && user && operationalRoles.includes(user.role as UserRole) && (
                    <Link href="/getting-started" onClick={() => setMobileMenuOpen(false)}>
                      <div
                        className={cn(
                          "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                          location === "/getting-started"
                            ? "bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-800 hover:text-white"
                            : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                        )}
                      >
                        <Rocket size={20} />
                        <span>Getting Started</span>
                      </div>
                    </Link>
                  )}
                  {/* Primary Items */}
                  {filteredPrimaryItems.map((item) => (
                    <Link key={item.path} href={item.path} onClick={() => setMobileMenuOpen(false)}>
                      <div
                        className={cn(
                          "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                          location === item.path
                            ? "bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-800 hover:text-white"
                            : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                        )}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  ))}

                  {/* Grouped Items with Headers */}
                  {allGroups.map((group) => {
                    const groupItems = group.items.filter(
                      (item) => !item.allowedRoles || item.allowedRoles.includes(userRole)
                    );
                    
                    if (groupItems.length === 0) return null;

                    return (
                      <div key={group.label} className="mt-3">
                        <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {group.label}
                        </div>
                        {groupItems.map((item) => (
                          <Link key={item.path} href={item.path} onClick={() => setMobileMenuOpen(false)}>
                            <div
                              className={cn(
                                "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                                location === item.path
                                  ? "bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-800 hover:text-white"
                                  : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                              )}
                            >
                              <span>{item.icon}</span>
                              <span>{item.label}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                </nav>
              </div>

              {/* Mobile Footer Actions */}
              <div className="border-t border-slate-200 p-3 space-y-1">
                <Link 
                  href="/account" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors duration-200"
                >
                  <User size={16} />
                  <span>My Account</span>
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setHelpDialogOpen(true);
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors duration-200"
                >
                  <HelpCircle size={16} />
                  <span>Help</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors duration-200"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Help Dialog */}
      <HelpDialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen} />
    </>
  );
}

