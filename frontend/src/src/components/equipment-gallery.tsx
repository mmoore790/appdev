import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface EquipmentGalleryProps {
  equipment: any[];
  isLoading?: boolean;
  className?: string;
}

export function EquipmentGallery({ equipment, isLoading = false, className }: EquipmentGalleryProps) {
  return (
    <Card className={className}>
      <CardHeader className="px-4 py-5 sm:px-6 border-b border-neutral-200">
        <CardTitle className="text-lg leading-6 font-medium text-neutral-700">
          Equipment Gallery
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="w-full min-h-80 aspect-square rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : equipment.length === 0 ? (
          <div className="py-20 text-center text-neutral-500">
            No equipment found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {equipment.slice(0, 3).map((item) => (
              <div key={item.id} className="group relative">
                <div className="w-full min-h-80 bg-neutral-100 aspect-w-1 aspect-h-1 rounded-md overflow-hidden group-hover:opacity-75">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-center object-cover"
                  />
                </div>
                <div className="mt-4 flex justify-between">
                  <div>
                    <h3 className="text-sm text-neutral-700">
                      <Link href={`/equipment/${item.id}`}>
                        <a>
                          <span aria-hidden="true" className="absolute inset-0"></span>
                          {item.brand} {item.model} {item.name}
                        </a>
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      Most common repair: {item.commonRepairs}
                    </p>
                  </div>
                  <p className={cn(
                    "text-sm font-medium", 
                    item.stockQuantity > 0 
                      ? item.stockQuantity > 5 
                        ? "text-green-600" 
                        : "text-amber-600" 
                      : "text-red-600"
                  )}>
                    {item.stockQuantity > 0 ? `${item.stockQuantity} in stock` : "Out of stock"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-neutral-100 px-4 py-3 text-sm text-right">
        <Link href="/equipment">
          <a className="font-medium text-green-700 hover:text-green-800">
            View all equipment
          </a>
        </Link>
      </CardFooter>
    </Card>
  );
}
