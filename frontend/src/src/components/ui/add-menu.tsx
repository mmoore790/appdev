import { useState } from "react";
import { useLocation } from "wouter";
import { 
  Plus, 
  ChevronDown, 
  ClipboardList, 
  UserPlus,
  Wrench,
  MessageCircle,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";

interface AddMenuProps {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function AddMenu({ className, variant = "default", size = "md" }: AddMenuProps) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
  // Determine button size classes
  const sizeClasses = {
    sm: "text-xs py-1 px-2",
    md: "text-sm py-2 px-3",
    lg: "text-base py-2.5 px-4"
  };
  
  // Items for the dropdown menu
  const menuItems = [
    {
      label: "New Task",
      icon: <ClipboardList size={16} />,
      onClick: () => navigate("/tasks"), // Go to tasks page where the + button exists
      permission: "all" // Everyone can create tasks
    },
    {
      label: "New Customer",
      icon: <UserPlus size={16} />,
      onClick: () => navigate("/customers"), // Go to customers page where the + button exists
      permission: "all" // Everyone can create customers
    },
    {
      label: "New Job",
      icon: <Wrench size={16} />,
      onClick: () => navigate("/workshop"), // Go to workshop page where the + button exists
      permission: "all" // Everyone can create jobs
    },
    {
      label: "New Message",
      icon: <MessageCircle size={16} />,
      onClick: () => navigate("/messages"), // Go to messages page
      permission: "all" // Everyone can send messages
    },
    {
      label: "New Equipment Type",
      icon: <Settings size={16} />,
      onClick: () => navigate("/settings"), // Go to settings page
      permission: "admin" // Only admins can add equipment types
    }
  ];
  
  // Filter menu items based on user role
  const filteredItems = menuItems.filter(item => {
    if (item.permission === "all") return true;
    if (item.permission === "admin" && user?.role === "admin") return true;
    return false;
  });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          className={`${sizeClasses[size]} ${className}`}
        >
          <Plus size={size === "sm" ? 14 : 16} className="mr-1" />
          <ChevronDown size={size === "sm" ? 12 : 14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {filteredItems.map((item, index) => (
          <DropdownMenuItem
            key={index}
            onClick={() => {
              item.onClick();
              setOpen(false);
            }}
            className="flex items-center py-2 cursor-pointer"
          >
            <span className="mr-2">{item.icon}</span>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}