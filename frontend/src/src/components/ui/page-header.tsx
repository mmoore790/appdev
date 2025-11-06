import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string | ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("bg-white shadow", className)}>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-neutral-700 sm:text-3xl sm:truncate">
              {title}
            </h2>
          </div>
          {actions && (
            <div className="mt-4 flex md:mt-0 md:ml-4">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface PageHeaderActionProps {
  icon?: ReactNode | string;
  children: ReactNode;
  variant?: "default" | "outline";
  onClick?: () => void;
  className?: string;
}

export function PageHeaderAction({ 
  icon, 
  children, 
  variant = "default",
  onClick,
  className
}: PageHeaderActionProps) {
  return (
    <Button 
      variant={variant === "outline" ? "outline" : "default"} 
      onClick={onClick}
      className={cn(
        "ml-3",
        variant === "outline" 
          ? "text-neutral-700 border-neutral-200 hover:bg-neutral-100" 
          : "bg-green-700 hover:bg-green-800",
        className
      )}
    >
      {icon && typeof icon === 'string' ? 
        <span className="material-icons mr-2 text-sm">{icon}</span> : 
        <span className="mr-2">{icon}</span>
      }
      {children}
    </Button>
  );
}
