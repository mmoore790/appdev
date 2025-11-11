import { ReactNode } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode | string;
  iconColor: string;
  footerText?: string;
  footerLink?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  iconColor,
  footerText,
  footerLink,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden border border-border/50 bg-card/70 backdrop-blur-sm", className)}>
      <CardContent className="p-0">
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner shadow-primary/10",
                iconColor,
              )}
            >
              {typeof icon === "string" ? (
                <span className="material-icons text-lg">{icon}</span>
              ) : (
                <span className="flex items-center justify-center text-lg">{icon}</span>
              )}
            </div>
            <div className="flex-1">
              <dl className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                  {title}
                </dt>
                <dd>
                  <div className="text-2xl font-semibold text-foreground">{value}</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </CardContent>
      {footerText && footerLink && (
        <CardFooter className="border-t border-border/60 bg-card/80 px-5 py-3">
          <Link
            href={footerLink}
            className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            {footerText}
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}
