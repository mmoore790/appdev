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
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-0">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center">
            <div className={cn("flex-shrink-0 rounded-md p-3", iconColor)}>
              {typeof icon === 'string' ? 
                <span className="material-icons text-white">{icon}</span> : 
                <span className="text-white">{icon}</span>
              }
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-neutral-400 truncate">
                  {title}
                </dt>
                <dd>
                  <div className="text-lg font-medium text-neutral-700">
                    {value}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </CardContent>
      {footerText && footerLink && (
        <CardFooter className="bg-neutral-100 px-4 py-3">
          <div className="text-sm">
            <Link href={footerLink} className="font-medium text-green-700 hover:text-green-800">
              {footerText}
            </Link>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
