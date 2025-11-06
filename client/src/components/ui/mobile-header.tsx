import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Wrench, 
  Users, 
  BarChart3, 
  ClipboardList, 
  Settings,
  User,
  Menu
} from "lucide-react";

export function MobileHeader() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { path: "/", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
    { path: "/tasks", label: "Tasks", icon: <CheckSquare size={20} /> },
    { path: "/workshop", label: "Workshop", icon: <Wrench size={20} /> },
    { path: "/customers", label: "Customers", icon: <Users size={20} /> },
    { path: "/analytics", label: "Analytics", icon: <BarChart3 size={20} /> },
    { path: "/service-history", label: "Service History", icon: <ClipboardList size={20} /> },
    { path: "/settings", label: "Settings", icon: <Settings size={20} /> },
  ];

  return (
    <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-neutral-200">
      <div className="flex items-center">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button className="p-1 mr-2 text-green-700 focus:outline-none">
              <Menu size={24} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center flex-shrink-0 px-4 py-5 border-b border-neutral-200">
                <svg 
                  className="h-8 w-auto mr-2 text-green-700" 
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12,3c0,0-6.186,5.34-8.235,7.276c-0.203,0.19-0.203,0.514,0,0.706C5.814,12.66,12,18,12,18s6.186-5.34,8.235-7.276 c0.203-0.191,0.203-0.514,0-0.706C18.186,8.34,12,3,12,3z M19.728,10.5c-1.515,1.451-5.296,4.966-7.728,7.224 c-2.432-2.258-6.213-5.773-7.727-7.224C6.087,9.282,8.597,7.066,12,4.276C15.404,7.066,17.914,9.282,19.728,10.5z"/>
                  <path d="M12,7c-1.657,0-3,1.343-3,3s1.343,3,3,3s3-1.343,3-3S13.657,7,12,7z M12,12c-1.105,0-2-0.895-2-2s0.895-2,2-2 s2,0.895,2,2S13.105,12,12,12z"/>
                </svg>
                <h1 className="text-lg font-semibold text-green-700">MOORE HORTICULTURE</h1>
              </div>
              <nav className="flex-1 px-2 py-4 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                      location === item.path
                        ? "bg-green-700 text-white"
                        : "text-neutral-500 hover:bg-neutral-100 hover:text-green-700"
                    )}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="p-4 border-t border-neutral-200">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                    <User size={18} />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-neutral-500">John Moore</p>
                    <p className="text-xs text-neutral-400">Admin</p>
                  </div>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-semibold text-green-700">MOORE HORTICULTURE</h1>
      </div>
      <button className="p-1 text-green-700 focus:outline-none">
        <User size={24} />
      </button>
    </div>
  );
}
