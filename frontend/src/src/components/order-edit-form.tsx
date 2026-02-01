import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";

const orderEditSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().email("Valid email required").optional()
  ),
  customerPhone: z.string().min(1, "Phone number is required"),
  orderDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  actualDeliveryDate: z.string().optional(),
  supplierName: z.string().optional(),
  expectedLeadTime: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().optional()
  ),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
  notificationMethod: z.enum(["email", "sms", "both"]).optional(),
  notifyOnOrderPlaced: z.boolean().optional(),
  notifyOnArrival: z.boolean().optional(),
});

type OrderEditFormData = z.infer<typeof orderEditSchema>;

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
  supplierName?: string;
  expectedLeadTime?: number;
  trackingNumber?: string;
  notes?: string;
  notificationMethod?: string;
  notifyOnOrderPlaced?: boolean;
  notifyOnArrival?: boolean;
}

interface OrderItem {
  id: number;
  orderId: number;
  itemName: string;
  itemSku?: string | null;
  itemType: string;
  quantity: number;
  unitPrice?: number | null;
  priceExcludingVat?: number | null;
  priceIncludingVat?: number | null;
  totalPrice?: number | null;
  supplierName?: string | null;
  supplierSku?: string | null;
  notes?: string | null;
  isOrdered?: boolean;
}

interface OrderItemType {
  id: number;
  orderId: number;
  itemName: string;
  itemSku?: string | null;
  itemType: string;
  quantity: number;
  unitPrice?: number | null;
  priceExcludingVat?: number | null;
  priceIncludingVat?: number | null;
  totalPrice?: number | null;
  supplierName?: string | null;
  supplierSku?: string | null;
  notes?: string | null;
  isOrdered?: boolean;
}

interface OrderEditFormProps {
  order: Order;
  items: OrderItemType[];
  onSuccess?: () => void;
  onCancel?: () => void;
  onUpdate: (data: Partial<OrderEditFormData>) => Promise<void>;
  onAddItem: (data: { itemName: string; itemType: string; quantity: number; itemSku?: string; priceExcludingVat?: number; priceIncludingVat?: number; supplierName?: string; supplierSku?: string; notes?: string; isOrdered?: boolean }) => Promise<void>;
  onUpdateItem: (itemId: number, data: Partial<OrderItemType>) => Promise<void>;
  onDeleteItem: (itemId: number) => Promise<void>;
  isItemsLoading?: boolean;
}

const ITEM_TYPES = ["part", "machine", "accessory", "service", "consumable", "other"] as const;

function OrderItemEditor({
  item,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  canDelete = true,
  disabled,
}: {
  item: OrderItemType;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (data: Partial<OrderItemType>) => Promise<void>;
  onDelete: () => void;
  canDelete?: boolean;
  disabled?: boolean;
}) {
  const [formData, setFormData] = useState({
    itemName: item.itemName,
    itemType: item.itemType,
    quantity: item.quantity,
    itemSku: item.itemSku || "",
    priceExcludingVat: item.priceExcludingVat ?? undefined,
    priceIncludingVat: item.priceIncludingVat ?? undefined,
    notes: item.notes || "",
    isOrdered: item.isOrdered ?? true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setFormData({
        itemName: item.itemName,
        itemType: item.itemType,
        quantity: item.quantity,
        itemSku: item.itemSku || "",
        priceExcludingVat: item.priceExcludingVat ?? undefined,
        priceIncludingVat: item.priceIncludingVat ?? undefined,
        notes: item.notes || "",
        isOrdered: item.isOrdered ?? true,
      });
    }
  }, [isEditing, item.id, item.itemName, item.itemType, item.quantity, item.itemSku, item.priceExcludingVat, item.priceIncludingVat, item.notes, item.isOrdered]);

  if (isEditing) {
    return (
      <Card className="p-4 border-primary/50">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Item name *"
              value={formData.itemName}
              onChange={(e) => setFormData((p) => ({ ...p, itemName: e.target.value }))}
            />
            <Select value={formData.itemType} onValueChange={(v) => setFormData((p) => ({ ...p, itemType: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="SKU / Part number"
              value={formData.itemSku}
              onChange={(e) => setFormData((p) => ({ ...p, itemSku: e.target.value }))}
            />
            <Input
              type="number"
              min={1}
              placeholder="Quantity"
              value={formData.quantity}
              onChange={(e) => setFormData((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="0.01"
              placeholder="Price ex VAT (£)"
              value={formData.priceExcludingVat ?? ""}
              onChange={(e) => setFormData((p) => ({ ...p, priceExcludingVat: e.target.value ? parseFloat(e.target.value) : undefined }))}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Price inc VAT (£)"
              value={formData.priceIncludingVat ?? ""}
              onChange={(e) => setFormData((p) => ({ ...p, priceIncludingVat: e.target.value ? parseFloat(e.target.value) : undefined }))}
            />
          </div>
          <Input
            placeholder="Notes"
            value={formData.notes}
            onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`ordered-${item.id}`}
                checked={formData.isOrdered}
                onCheckedChange={(c) => setFormData((p) => ({ ...p, isOrdered: !!c }))}
              />
              <label htmlFor={`ordered-${item.id}`} className="text-sm">Ordered?</label>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                size="sm"
                disabled={!formData.itemName.trim() || saving || disabled}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onSave({
                      itemName: formData.itemName.trim(),
                      itemType: formData.itemType,
                      quantity: formData.quantity,
                      itemSku: formData.itemSku.trim() || undefined,
                      priceExcludingVat: formData.priceExcludingVat,
                      priceIncludingVat: formData.priceIncludingVat,
                      notes: formData.notes.trim() || undefined,
                      isOrdered: formData.isOrdered,
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onCancelEdit} disabled={saving || disabled}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex items-start justify-between p-3 rounded-lg border bg-muted/30">
      <div>
        <div className="font-medium">{item.itemName}</div>
        <div className="text-sm text-muted-foreground">
          {item.itemType} · Qty: {item.quantity}
          {item.priceIncludingVat != null && ` · £${Number(item.priceIncludingVat).toFixed(2)}`}
          {item.priceExcludingVat != null && item.priceIncludingVat == null && ` · £${Number(item.priceExcludingVat).toFixed(2)} ex VAT`}
        </div>
      </div>
      <div className="flex gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit} disabled={disabled}>
          Edit
        </Button>
        {canDelete && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete} disabled={disabled}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function OrderEditForm({ order, items, onSuccess, onCancel, onUpdate, onAddItem, onUpdateItem, onDeleteItem, isItemsLoading }: OrderEditFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newItem, setNewItem] = useState<{ itemName: string; itemType: string; quantity: number; itemSku?: string; priceExcludingVat?: number; priceIncludingVat?: number; notes?: string; isOrdered?: boolean } | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  const form = useForm<OrderEditFormData>({
    resolver: zodResolver(orderEditSchema),
    defaultValues: {
      customerName: order.customerName,
      customerEmail: order.customerEmail || "",
      customerPhone: order.customerPhone,
      orderDate: order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : "",
      expectedDeliveryDate: order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toISOString().split('T')[0] : "",
      actualDeliveryDate: order.actualDeliveryDate ? new Date(order.actualDeliveryDate).toISOString().split('T')[0] : "",
      supplierName: order.supplierName || "",
      expectedLeadTime: order.expectedLeadTime,
      trackingNumber: order.trackingNumber || "",
      notes: order.notes || "",
      notificationMethod: (order.notificationMethod as "email" | "sms" | "both") || "email",
      notifyOnOrderPlaced: order.notifyOnOrderPlaced,
      notifyOnArrival: order.notifyOnArrival,
    },
  });

  const onSubmit = async (data: OrderEditFormData) => {
    setIsSubmitting(true);
    try {
      // Clean up empty strings and convert to undefined
      const cleanedData: any = {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail && data.customerEmail.trim() !== "" ? data.customerEmail.trim() : undefined,
        supplierName: data.supplierName && data.supplierName.trim() !== "" ? data.supplierName.trim() : undefined,
        trackingNumber: data.trackingNumber && data.trackingNumber.trim() !== "" ? data.trackingNumber.trim() : undefined,
        notes: data.notes && data.notes.trim() !== "" ? data.notes.trim() : undefined,
        expectedLeadTime: data.expectedLeadTime !== undefined && data.expectedLeadTime !== null ? data.expectedLeadTime : undefined,
        notificationMethod: data.notificationMethod || "email",
        notifyOnOrderPlaced: data.notifyOnOrderPlaced,
        notifyOnArrival: data.notifyOnArrival,
      };

      // Handle dates
      if (data.orderDate && data.orderDate.trim() !== "") {
        cleanedData.orderDate = new Date(data.orderDate + 'T00:00:00').toISOString();
      }
      if (data.expectedDeliveryDate && data.expectedDeliveryDate.trim() !== "") {
        cleanedData.expectedDeliveryDate = new Date(data.expectedDeliveryDate + 'T00:00:00').toISOString();
      }
      if (data.actualDeliveryDate && data.actualDeliveryDate.trim() !== "") {
        cleanedData.actualDeliveryDate = new Date(data.actualDeliveryDate + 'T00:00:00').toISOString();
      }

      await onUpdate(cleanedData);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Delivery Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivery Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="supplierName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Optional" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="orderDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expectedDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Delivery</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="actualDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Delivery</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="expectedLeadTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Lead Time (Days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value === "" || e.target.value === null ? undefined : parseInt(e.target.value) || undefined)}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trackingNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order/Tracking Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Order notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Items ({items.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item) => (
                <OrderItemEditor
                  key={item.id}
                  item={item}
                  isEditing={editingItemId === item.id}
                  onEdit={() => setEditingItemId(item.id)}
                  onCancelEdit={() => setEditingItemId(null)}
                  onSave={async (data) => {
                    await onUpdateItem(item.id, data);
                    setEditingItemId(null);
                  }}
                  onDelete={() => onDeleteItem(item.id)}
                  canDelete={items.length > 1}
                  disabled={isItemsLoading}
                />
              ))}
              {newItem ? (
                <Card className="p-4 border-dashed">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Item name *"
                        value={newItem.itemName}
                        onChange={(e) => setNewItem((p) => p ? { ...p, itemName: e.target.value } : null)}
                      />
                      <Select
                        value={newItem.itemType}
                        onValueChange={(v) => setNewItem((p) => p ? { ...p, itemType: v } : null)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ITEM_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="SKU / Part number"
                        value={newItem.itemSku || ""}
                        onChange={(e) => setNewItem((p) => p ? { ...p, itemSku: e.target.value || undefined } : null)}
                      />
                      <Input
                        type="number"
                        min={1}
                        placeholder="Quantity"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem((p) => p ? { ...p, quantity: parseInt(e.target.value) || 1 } : null)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price ex VAT (£)"
                        value={newItem.priceExcludingVat ?? ""}
                        onChange={(e) => setNewItem((p) => p ? { ...p, priceExcludingVat: e.target.value ? parseFloat(e.target.value) : undefined } : null)}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price inc VAT (£)"
                        value={newItem.priceIncludingVat ?? ""}
                        onChange={(e) => setNewItem((p) => p ? { ...p, priceIncludingVat: e.target.value ? parseFloat(e.target.value) : undefined } : null)}
                      />
                    </div>
                    <Input
                      placeholder="Notes"
                      value={newItem.notes || ""}
                      onChange={(e) => setNewItem((p) => p ? { ...p, notes: e.target.value || undefined } : null)}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!newItem.itemName.trim() || isItemsLoading}
                        onClick={async () => {
                          if (!newItem?.itemName.trim()) return;
                          await onAddItem({
                            itemName: newItem.itemName.trim(),
                            itemType: newItem.itemType,
                            quantity: newItem.quantity,
                            itemSku: newItem.itemSku?.trim() || undefined,
                            priceExcludingVat: newItem.priceExcludingVat,
                            priceIncludingVat: newItem.priceIncludingVat,
                            notes: newItem.notes?.trim() || undefined,
                            isOrdered: newItem.isOrdered ?? true,
                          });
                          setNewItem(null);
                        }}
                      >
                        Add Item
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setNewItem(null)} disabled={isItemsLoading}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setNewItem({ itemName: "", itemType: "part", quantity: 1, isOrdered: true })}
                  disabled={isItemsLoading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Order"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

