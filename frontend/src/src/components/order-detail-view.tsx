import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import {
  Phone,
  Mail,
  MapPin,
  Package,
  Calendar,
  DollarSign,
  Truck,
  User,
  History,
  Bell,
  Send,
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
  estimatedTotalCost?: number;
  actualTotalCost?: number;
  depositAmount?: number;
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
  onNotifyCustomer: (type: 'order_placed' | 'arrived') => void;
  onMarkAsComplete?: () => void;
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
  onNotifyCustomer,
  onMarkAsComplete,
  onEdit,
}: OrderDetailViewProps) {
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
            {order.customerPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-neutral-400" />
                <span>{order.customerPhone}</span>
              </div>
            )}
            {order.customerEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-neutral-400" />
                <span>{order.customerEmail}</span>
              </div>
            )}
            {order.customerAddress && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-neutral-400 mt-1" />
                <span className="text-sm">{order.customerAddress}</span>
              </div>
            )}
            {order.customerNotes && (
              <div>
                <div className="text-sm text-neutral-600 mb-1">Notes</div>
                <div className="text-sm">{order.customerNotes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-neutral-600">Order Date</div>
                <div className="font-medium">
                  {format(new Date(order.orderDate), "MMM d, yyyy")}
                </div>
              </div>
              {order.expectedDeliveryDate && (
                <div>
                  <div className="text-sm text-neutral-600">Expected Delivery</div>
                  <div className="font-medium">
                    {format(new Date(order.expectedDeliveryDate), "MMM d, yyyy")}
                  </div>
                </div>
              )}
            </div>
            {order.actualDeliveryDate && (
              <div>
                <div className="text-sm text-neutral-600">Actual Delivery</div>
                <div className="font-medium">
                  {format(new Date(order.actualDeliveryDate), "MMM d, yyyy")}
                </div>
              </div>
            )}
            {order.trackingNumber && (
              <div>
                <div className="text-sm text-neutral-600">Tracking Number</div>
                <div className="font-medium font-mono">{order.trackingNumber}</div>
              </div>
            )}
            {(order.estimatedTotalCost || order.actualTotalCost) && (
              <div>
                <div className="text-sm text-neutral-600">Total Cost</div>
                <div className="font-medium">
                  {order.actualTotalCost
                    ? `£${order.actualTotalCost.toFixed(2)}`
                    : order.estimatedTotalCost
                    ? `£${order.estimatedTotalCost.toFixed(2)} (estimated)`
                    : "-"}
                </div>
              </div>
            )}
            {order.depositAmount && (
              <div>
                <div className="text-sm text-neutral-600">Deposit</div>
                <div className="font-medium">£{order.depositAmount.toFixed(2)}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supplier Information */}
      {(order.supplierName || order.supplierContact || order.supplierEmail || order.supplierPhone) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Supplier Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.supplierName && (
              <div>
                <div className="text-sm text-neutral-600">Supplier Name</div>
                <div className="font-medium">{order.supplierName}</div>
              </div>
            )}
            {order.supplierContact && (
              <div>
                <div className="text-sm text-neutral-600">Contact Person</div>
                <div className="font-medium">{order.supplierContact}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {order.supplierEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-neutral-400" />
                  <span className="text-sm">{order.supplierEmail}</span>
                </div>
              )}
              {order.supplierPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-neutral-400" />
                  <span className="text-sm">{order.supplierPhone}</span>
                </div>
              )}
            </div>
            {order.expectedLeadTime && (
              <div>
                <div className="text-sm text-neutral-600">Expected Lead Time</div>
                <div className="font-medium">{order.expectedLeadTime} days</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                      <Badge variant="outline">{item.itemType}</Badge>
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
                    {item.supplierName && (
                      <div className="mt-2 text-sm">
                        <span className="text-neutral-600">Supplier: </span>
                        <span className="font-medium">{item.supplierName}</span>
                      </div>
                    )}
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
      {(order.notes || order.internalNotes) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.notes && (
              <div>
                <div className="text-sm font-semibold text-neutral-600 mb-1">Order Notes</div>
                <div className="text-sm">{order.notes}</div>
              </div>
            )}
            {order.internalNotes && (
              <div>
                <div className="text-sm font-semibold text-neutral-600 mb-1">Internal Notes (Staff Only)</div>
                <div className="text-sm">{order.internalNotes}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notification Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Customer Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNotifyCustomer('order_placed')}
              disabled={!order.customerEmail && !order.customerPhone}
            >
              <Send className="h-4 w-4 mr-2" />
              Send Order Confirmation
            </Button>
            {order.status === 'arrived' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNotifyCustomer('arrived')}
                disabled={!order.customerEmail && !order.customerPhone}
              >
                <Bell className="h-4 w-4 mr-2" />
                Notify Order Ready
              </Button>
            )}
          </div>
          <div className="mt-4 text-sm text-neutral-600">
            <div>Notification Method: {order.notificationMethod}</div>
            <div className="mt-2 space-y-1">
              <div>✓ Notify on order placed: {order.notifyOnOrderPlaced ? "Yes" : "No"}</div>
              <div>✓ Notify on arrival: {order.notifyOnArrival ? "Yes" : "No"}</div>
            </div>
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

