import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string | ReactNode;
  description?: string | ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("bg-white shadow", className)}>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              {icon && (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-green-100 text-green-700">
                  {icon}
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold leading-7 text-neutral-700 sm:text-3xl sm:leading-9">
                  {title}
                </h2>
                {description && (
                  <p className="mt-2 text-sm text-neutral-500 sm:text-base">{description}</p>
                )}
              </div>
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-end gap-3 md:mt-0 md:ml-4">
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
        {icon
          ? typeof icon === "string"
            ? <span className="material-icons mr-2 text-sm">{icon}</span>
            : <span className="mr-2">{icon}</span>
          : null}
        <span>{children}</span>
    </Button>
  );
}
