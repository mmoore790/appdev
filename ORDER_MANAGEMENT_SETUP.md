# Universal Order Management System - Setup Guide

## ✅ Implementation Complete

The Universal Order Management module has been fully implemented and is ready for use. This system can handle ordering any type of item (parts, machines, accessories, services, consumables, etc.).

## 📋 What's Been Implemented

### Backend
- ✅ Database schema (3 tables: orders, order_items, order_status_history)
- ✅ Migration file: `0008_add_universal_order_management.sql`
- ✅ Storage layer with full CRUD operations
- ✅ Repository layer (Order, OrderItem, OrderStatusHistory)
- ✅ Service layer with notification logic
- ✅ Notification service abstraction (email/SMS)
- ✅ RESTful API controller with all endpoints
- ✅ Routes integrated into Express app

### Frontend
- ✅ Orders management page (`/orders`)
- ✅ Order form component (create/edit orders)
- ✅ Order detail view component
- ✅ Customer order tracking page (`/order-tracker`)
- ✅ Routes and navigation integrated

## 🚀 Running the Migration

To apply the database migration, run:

```bash
cd backend
npx tsx run-migration-0008.ts
```

Or if you prefer to run it manually via SQL:

```bash
psql $DATABASE_URL -f migrations/0008_add_universal_order_management.sql
```

The migration will create:
- `orders` table - Main order table
- `order_items` table - Individual items within orders
- `order_status_history` table - Complete audit trail of status changes
- All necessary indexes and foreign key constraints

## 📍 API Endpoints

All endpoints are available under `/api/orders`:

- `GET /api/orders` - List all orders
- `GET /api/orders/:id` - Get single order
- `GET /api/orders/status/:status` - Filter by status
- `GET /api/orders/customer/:customerId` - Get orders for customer
- `GET /api/orders/job/:jobId` - Get orders for job
- `GET /api/orders/search?q=query` - Search orders
- `POST /api/orders` - Create new order
- `PUT /api/orders/:id` - Update order
- `POST /api/orders/:id/status` - Update order status
- `GET /api/orders/:id/items` - Get order items
- `POST /api/orders/:id/items` - Add item to order
- `PUT /api/orders/:id/items/:itemId` - Update order item
- `DELETE /api/orders/:id/items/:itemId` - Delete order item
- `GET /api/orders/:id/history` - Get status history
- `POST /api/orders/:id/notify` - Send customer notification
- `DELETE /api/orders/:id` - Delete order

## 🎯 Order Status Workflow

1. **draft** - Order is being prepared
2. **ordered** - Order has been placed with supplier
3. **supplier_confirmed** - Supplier has confirmed the order
4. **shipment_in_transit** - Order is on its way
5. **arrived** - Order has arrived and is ready for pickup
6. **completed** - Order has been completed
7. **cancelled** - Order has been cancelled

## 🔔 Notification Features

- **Customer Notifications**: Email/SMS notifications for:
  - Order confirmation (when order is placed)
  - Status updates (when status changes)
  - Arrival notification (when order arrives)

- **Staff Notifications**: Internal notifications for:
  - New order created
  - Order arrived

Notification preferences can be set per order (email, SMS, or both).

## 🎨 Frontend Pages

### Admin/Staff Pages
- **`/orders`** - Main order management dashboard
  - View all orders
  - Search and filter orders
  - Create new orders
  - Update order status
  - View order details and history
  - Send customer notifications

### Customer Pages
- **`/order-tracker`** - Public order tracking page
  - Customers can track their orders by order number and email
  - View order status and details
  - See order items and summary

## 📦 Order Items

Each order can contain multiple items with:
- Item name and SKU
- Item type (part, machine, accessory, service, consumable, other)
- Category (optional)
- Quantity
- Unit price and total price
- Supplier information (optional)
- Notes

## 🔧 Extensibility

The system is designed to be easily extended with:
- Deposit/payment tracking (fields already in schema)
- Invoice generation
- Shipping provider integrations
- Supplier API integrations
- Advanced reporting and analytics

## 🧪 Testing

After running the migration:

1. Navigate to `/orders` in the application
2. Create a test order with multiple items
3. Test status updates
4. Test customer notifications
5. Test the order tracker at `/order-tracker`

## 📝 Notes

- The system uses the existing multi-tenancy structure (businessId)
- All costs are stored in pence/cents for precision
- Order numbers are auto-generated in format: `ORD-YYYYMMDD-XXXX`
- Status history is automatically tracked for all changes
- The system integrates with existing job tracking (can link orders to jobs)

## 🎉 Ready to Use!

Once the migration is run, the Universal Order Management system is fully operational and ready for production use.

