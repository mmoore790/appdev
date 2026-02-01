import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format, differenceInDays } from "date-fns";
import {
  Package,
  Truck,
  User,
  History,
  FileText,
  CheckCircle,
  Edit,
} from "lucide-react";

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerAddress?: string;
  customerNotes?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status: string;
  supplierName?: string;
  supplierContact?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  expectedLeadTime?: number;
  trackingNumber?: string;
  notes?: string;
  internalNotes?: string;
  notifyOnOrderPlaced: boolean;
  notifyOnStatusChange: boolean;
  notifyOnArrival: boolean;
  notificationMethod: string;
  relatedJobId?: number;
}

interface OrderItem {
  id: number;
  itemName: string;
  itemSku?: string;
  itemType: string;
  itemCategory?: string;
  quantity: number;
  unitPrice?: number;
  priceExcludingVat?: number;
  priceIncludingVat?: number;
  totalPrice?: number;
  supplierName?: string;
  supplierSku?: string;
  notes?: string;
}

interface OrderDetailViewProps {
  order: Order;
  items: OrderItem[];
  onClose: () => void;
  onViewHistory: () => void;
  onMarkAsComplete?: () => void;
  onMarkAsOrdered?: () => void;
  onEdit?: () => void;
}

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; className: string }> = {
    not_ordered: { label: "Not Ordered", className: "bg-gray-100 text-gray-800" },
    ordered: { label: "Ordered", className: "bg-blue-100 text-blue-800" },
    arrived: { label: "Arrived", className: "bg-green-100 text-green-800" },
    completed: { label: "Completed", className: "bg-green-200 text-green-900" },
  };

  const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-800" };
  return <Badge className={config.className}>{config.label}</Badge>;
};

export function OrderDetailView({
  order,
  items,
  onClose,
  onViewHistory,
  onMarkAsComplete,
  onMarkAsOrdered,
  onEdit,
}: OrderDetailViewProps) {
  const daysSinceOrdered = order.status !== "not_ordered" && order.orderDate
    ? differenceInDays(new Date(), new Date(order.orderDate))
    : null;
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Order {order.orderNumber}</h2>
          <p className="text-neutral-600 mt-1">
            Created {format(new Date(order.orderDate), "MMM d, yyyy 'at' HH:mm")}
          </p>
        </div>
        <div className="flex gap-2">
          {getStatusBadge(order.status)}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Order
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onViewHistory}>
            <History className="h-4 w-4 mr-2" />
            View History
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm text-neutral-600">Name</div>
              <div className="font-medium">{order.customerName}</div>
            </div>
            <div>
              <div className="text-sm text-neutral-600">Phone</div>
              <div className="font-medium">{order.customerPhone || "—"}</div>
            </div>
            <div>
              <div className="text-sm text-neutral-600">Email</div>
              <div className="font-medium">{order.customerEmail || "—"}</div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Delivery Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Status / Days since ordered - for orders not yet arrived */}
            {order.status !== "arrived" && order.status !== "completed" && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                {order.status === "not_ordered" ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Not ordered yet — would you like to mark this order as ordered?
                    </p>
                    {onMarkAsOrdered && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 shrink-0"
                        onClick={onMarkAsOrdered}
                      >
                        Mark as Ordered
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Days since ordered: </span>
                    <span className="font-semibold">
                      {daysSinceOrdered === 0
                        ? "Today"
                        : daysSinceOrdered === 1
                        ? "1 day"
                        : `${daysSinceOrdered} days`}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-neutral-600">Supplier Name</div>
                <div className="font-medium">{order.supplierName || "—"}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600">Order Date</div>
                <div className="font-medium">
                  {format(new Date(order.orderDate), "MMM d, yyyy")}
                </div>
              </div>
              <div>
                <div className="text-sm text-neutral-600">Expected Delivery</div>
                <div className="font-medium">
                  {order.expectedDeliveryDate
                    ? format(new Date(order.expectedDeliveryDate), "MMM d, yyyy")
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-sm text-neutral-600">Actual Delivery</div>
                <div className="font-medium">
                  {order.actualDeliveryDate
                    ? format(new Date(order.actualDeliveryDate), "MMM d, yyyy")
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-sm text-neutral-600">Expected Lead Time (Days)</div>
                <div className="font-medium">{order.expectedLeadTime != null ? `${order.expectedLeadTime}` : "—"}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600">Order/Tracking Number</div>
                <div className="font-medium font-mono">{order.trackingNumber || "—"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{item.itemName}</h4>
                      {item.itemCategory && (
                        <Badge variant="secondary">{item.itemCategory}</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {item.itemSku && (
                        <div>
                          <div className="text-neutral-600">SKU</div>
                          <div className="font-mono">{item.itemSku}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-neutral-600">Quantity</div>
                        <div className="font-medium">{item.quantity}</div>
                      </div>
                      {(item.priceExcludingVat || item.priceIncludingVat) && (
                        <div>
                          <div className="text-neutral-600">Price</div>
                          <div className="font-medium">
                            {item.priceExcludingVat && `£${item.priceExcludingVat.toFixed(2)} (ex VAT)`}
                            {item.priceExcludingVat && item.priceIncludingVat && ` / `}
                            {item.priceIncludingVat && `£${item.priceIncludingVat.toFixed(2)} (inc VAT)`}
                            {!item.priceExcludingVat && item.priceIncludingVat && `£${item.priceIncludingVat.toFixed(2)} (inc VAT)`}
                          </div>
                        </div>
                      )}
                      {!item.priceExcludingVat && !item.priceIncludingVat && item.unitPrice && (
                        <div>
                          <div className="text-neutral-600">Unit Price</div>
                          <div className="font-medium">£{item.unitPrice.toFixed(2)}</div>
                        </div>
                      )}
                      {item.totalPrice && (
                        <div>
                          <div className="text-neutral-600">Total</div>
                          <div className="font-medium">£{item.totalPrice.toFixed(2)}</div>
                        </div>
                      )}
                    </div>
                    {item.notes && (
                      <div className="mt-2 text-sm text-neutral-600">{item.notes}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm text-neutral-600 mb-1">Order Notes</div>
            <div className="text-sm">{order.notes || "—"}</div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center">
        {order.status === 'arrived' && onMarkAsComplete && (
          <Button
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2"
            size="lg"
            onClick={onMarkAsComplete}
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Mark Order as Complete
          </Button>
        )}
        <div className="flex gap-2 ml-auto">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

