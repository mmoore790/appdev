import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

interface AnalyticsSummaryProps {
  data: any;
  isLoading?: boolean;
}

export function AnalyticsSummary({ data, isLoading = false }: AnalyticsSummaryProps) {
  return (
    <Card>
      <CardHeader className="px-4 py-5 sm:px-6 border-b border-neutral-200">
        <CardTitle className="text-lg leading-6 font-medium text-neutral-700">
          Analytics Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Chart Placeholder - This would be replaced with an actual chart in a full implementation */}
          <div className="bg-neutral-100 p-4 rounded h-56 flex items-center justify-center">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded" />
            ) : (
              <p className="text-center text-neutral-600">Sales by Equipment Type</p>
            )}
          </div>
          
          {/* Metrics */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="text-neutral-600">Average Repair Time</span>
                <span className="text-neutral-700 font-medium">
                  {isLoading ? "Loading..." : `${data?.avgRepairTime || "0"} days`}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: isLoading ? "0%" : `${data?.avgRepairTime ? Math.min(100, (parseFloat(data.avgRepairTime) / 5) * 100) : 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="text-neutral-600">Customer Satisfaction</span>
                <span className="text-neutral-700 font-medium">
                  {isLoading ? "Loading..." : `${data?.customerSatisfaction || "0"}%`}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div 
                  className="bg-green-700 h-2 rounded-full" 
                  style={{ width: isLoading ? "0%" : `${data?.customerSatisfaction || 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="text-neutral-600">Parts Availability</span>
                <span className="text-neutral-700 font-medium">
                  {isLoading ? "Loading..." : `${data?.partsAvailability || "0"}%`}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div 
                  className="bg-amber-500 h-2 rounded-full" 
                  style={{ width: isLoading ? "0%" : `${data?.partsAvailability || 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="text-neutral-600">Monthly Growth</span>
                <span className="text-neutral-700 font-medium">
                  {isLoading ? "Loading..." : `${data?.monthlyGrowth || "0"}%`}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: isLoading ? "0%" : `${data?.monthlyGrowth || 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-neutral-100 px-4 py-3 text-sm text-right">
        <Link href="/analytics">
          <a className="font-medium text-green-700 hover:text-green-800">
            View detailed reports
          </a>
        </Link>
      </CardFooter>
    </Card>
  );
}
