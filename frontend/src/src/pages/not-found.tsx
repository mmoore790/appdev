import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { PageHeader } from "@/components/ui/page-header";

export default function NotFound() {
  return (
    <>
      <PageHeader title="Page Not Found" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <Card className="w-full mx-auto max-w-md">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2 items-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
            </div>

            <p className="mt-4 text-sm text-gray-600">
              The page you are looking for does not exist or has been moved.
            </p>
            
            <div className="mt-6">
              <Link href="/">
                <a className="text-green-700 hover:text-green-800 font-medium">
                  Return to Dashboard
                </a>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
