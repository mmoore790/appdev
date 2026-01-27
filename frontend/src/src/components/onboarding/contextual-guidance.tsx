import { useState, useEffect, useRef } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { X, HelpCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ContextualGuidanceProps {
  id: string;
  title: string;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
  page?: string;
}

const GUIDANCE_DISMISSED_KEY = "contextual_guidance_dismissed";

export function ContextualGuidance({
  id,
  title,
  content,
  position = "bottom",
  children,
  page,
}: ContextualGuidanceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const queryClient = useQueryClient();
  const hasShownRef = useRef(false);

  useEffect(() => {
    // Check if this guidance has been dismissed
    const dismissed = localStorage.getItem(GUIDANCE_DISMISSED_KEY);
    const dismissedIds = dismissed ? JSON.parse(dismissed) : [];
    
    if (dismissedIds.includes(id)) {
      setIsDismissed(true);
      return;
    }

    // Check if we're on the right page
    if (page && !window.location.pathname.includes(page)) {
      return;
    }

    // Show guidance after a short delay on first visit
    if (!hasShownRef.current) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        hasShownRef.current = true;
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [id, page]);

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsOpen(false);
    
    // Save dismissal to localStorage
    const dismissed = localStorage.getItem(GUIDANCE_DISMISSED_KEY);
    const dismissedIds = dismissed ? JSON.parse(dismissed) : [];
    if (!dismissedIds.includes(id)) {
      dismissedIds.push(id);
      localStorage.setItem(GUIDANCE_DISMISSED_KEY, JSON.stringify(dismissedIds));
    }
  };

  if (isDismissed) {
    return <>{children}</>;
  }

  return (
    <Popover open={isOpen && !isDismissed} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          {children}
          {!isDismissed && (
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full animate-pulse" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side={position}
        className="w-80 p-4"
        onInteractOutside={(e) => {
          // Don't close when clicking the trigger
          if ((e.target as HTMLElement).closest('[data-guidance-trigger]')) {
            e.preventDefault();
          }
        }}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <h4 className="font-semibold text-sm">{title}</h4>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={handleDismiss}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{content}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Pre-configured guidance components for common pages
export function WorkshopGuidance({ children }: { children: React.ReactNode }) {
  return (
    <ContextualGuidance
      id="workshop_overview"
      title="Your Workshop Board"
      content="This is your workshop at a glance. Jobs move through status columns as work progresses. Drag jobs between columns or click to view details."
      page="workshop"
    >
      {children}
    </ContextualGuidance>
  );
}

export function JobGuidance({ children }: { children: React.ReactNode }) {
  return (
    <ContextualGuidance
      id="job_details"
      title="Job Sheet"
      content="This is your digital job sheet. Add labour, parts, and notes. Customers can view this online and you can print it."
      page="workshop/jobs"
    >
      {children}
    </ContextualGuidance>
  );
}

export function OrdersGuidance({ children }: { children: React.ReactNode }) {
  return (
    <ContextualGuidance
      id="orders_linking"
      title="Linking Orders to Jobs"
      content="Orders can be linked to jobs to track parts and materials. This helps you see what's needed for each job."
      page="orders"
    >
      {children}
    </ContextualGuidance>
  );
}

