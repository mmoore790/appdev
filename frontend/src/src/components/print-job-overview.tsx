import { forwardRef } from "react";
import { formatDate } from "@/lib/utils";
import logoPath from "@/assets/logo-m.png";

type Business = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  logoUrl?: string | null;
};

interface PrintJobOverviewProps {
  job: any;
  orders?: any[];
  services?: any[];
  jobUpdates?: any[];
  companyInfo?: Business | null;
}

export const PrintJobOverview = forwardRef<HTMLDivElement, PrintJobOverviewProps>(
  ({ job, orders = [], services = [], companyInfo }, ref) => {
    // Use company settings if available, otherwise use fallback values
    const companyName = companyInfo?.name || "Company Name";
    const companyAddress = companyInfo?.address || "";
    const companyPhone = companyInfo?.phone || "";
    const companyEmail = companyInfo?.email || "";
    const companyWebsite = companyInfo?.website || "";
    const companyLogoUrl = companyInfo?.logoUrl || logoPath;

    // Format status for display
    const formatStatus = (status: string) => {
      switch (status) {
        case "waiting_assessment":
          return "Waiting Assessment";
        case "in_progress":
          return "In Progress";
        case "on_hold":
          return "On Hold";
        case "ready_for_pickup":
          return "Ready for Pickup";
        case "completed":
          return "Completed";
        default:
          return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
      }
    };

    const formatOrderStatus = (status: string) => {
      switch (status) {
        case "not_ordered":
          return "Not Ordered";
        case "ordered":
          return "Ordered";
        case "arrived":
          return "Arrived";
        case "completed":
          return "Completed";
        default:
          return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
      }
    };

    // Get equipment description
    const getEquipmentDescription = () => {
      const parts: string[] = [];
      if (job.machineType) parts.push(job.machineType);
      if (job.equipmentMake) parts.push(job.equipmentMake);
      if (job.equipmentModel) parts.push(job.equipmentModel);
      if (job.equipmentSerial) parts.push(`Serial: ${job.equipmentSerial}`);
      if (job.equipmentDescription) parts.push(job.equipmentDescription);
      return parts.length > 0 ? parts.join(" - ") : "Not specified";
    };

    return (
      <div ref={ref} className="p-6 bg-white print:w-full print:shadow-none w-full max-w-4xl mx-auto shadow-md">
        {/* Print-only styling */}
        <style type="text/css" media="print">
          {`
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-size: 12pt;
              line-height: 1.4;
            }
            .print\\:text-sm {
              font-size: 10pt !important;
            }
            .print\\:text-xs {
              font-size: 9pt !important;
            }
            .print\\:break-inside-avoid {
              break-inside: avoid !important;
            }
          `}
        </style>

        {/* Header - Logo and Title */}
        <div className="flex justify-between items-center border-b border-gray-200 pb-6 print:break-inside-avoid">
          <div className="flex items-center">
            <img
              src={companyLogoUrl}
              alt={`${companyName} Logo`}
              className="h-16 w-auto mr-4"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src !== logoPath) {
                  target.src = logoPath;
                }
              }}
            />
            <div>
              <h1 className="text-2xl font-bold text-green-800">{companyName}</h1>
              {companyAddress && <p className="text-sm text-gray-600">{companyAddress}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-semibold text-gray-800">Job Overview</h2>
            <p className="text-sm text-gray-600">{formatDate(new Date().toISOString())}</p>
            <p className="text-sm font-medium text-green-700 mt-1">Job ID: {job.jobId}</p>
          </div>
        </div>

        {/* Job Status & Basic Info */}
        <div className="mt-6 border-b border-gray-200 pb-6 print:break-inside-avoid">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-base font-semibold text-gray-800">{formatStatus(job.status)}</p>
            </div>
            {job.createdAt && (
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-base font-medium text-gray-800">{formatDate(job.createdAt)}</p>
              </div>
            )}
            {job.estimatedHours && (
              <div>
                <p className="text-sm text-gray-500">Estimated Hours</p>
                <p className="text-base font-medium text-gray-800">{job.estimatedHours} hours</p>
              </div>
            )}
            {job.customerNotified !== undefined && (
              <div>
                <p className="text-sm text-gray-500">Customer Notified</p>
                <p className="text-base font-medium text-gray-800">{job.customerNotified ? "Yes" : "No"}</p>
              </div>
            )}
          </div>
        </div>

        {/* Customer Details */}
        <div className="mt-6 border-b border-gray-200 pb-6 print:break-inside-avoid">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Customer Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="text-base font-medium text-gray-800">{job.customerName || "Not recorded"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="text-base font-medium text-gray-800">{job.customerPhone || "Not recorded"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-base font-medium text-gray-800">{job.customerEmail || "Not recorded"}</p>
            </div>
            {job.customerAddress && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Address</p>
                <p className="text-base font-medium text-gray-800 whitespace-pre-line">{job.customerAddress}</p>
              </div>
            )}
          </div>
        </div>

        {/* Equipment Information */}
        <div className="mt-6 border-b border-gray-200 pb-6 print:break-inside-avoid">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Equipment Information</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Equipment</p>
              <p className="text-base font-medium text-gray-800">{getEquipmentDescription()}</p>
            </div>
            {job.roboticMowerPinCode && (
              <div>
                <p className="text-sm text-gray-500">Robotic Mower PIN Code</p>
                <p className="text-base font-medium text-gray-800">{job.roboticMowerPinCode}</p>
              </div>
            )}
          </div>
        </div>

        {/* Job Description */}
        {job.description && (
          <div className="mt-6 border-b border-gray-200 pb-6 print:break-inside-avoid">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Job Description</h3>
            <p className="text-base text-gray-800 whitespace-pre-line">{job.description}</p>
          </div>
        )}

        {/* Task Details */}
        {job.taskDetails && (
          <div className="mt-6 border-b border-gray-200 pb-6 print:break-inside-avoid">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Internal Notes</h3>
            <p className="text-base text-gray-800 whitespace-pre-line">{job.taskDetails}</p>
          </div>
        )}

        {/* Orders */}
        {orders && orders.length > 0 && (
          <div className="mt-6 border-b border-gray-200 pb-6 print:break-inside-avoid">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Orders ({orders.length})</h3>
            <div className="space-y-4">
              {orders.map((order, index) => (
                <div key={order.id || index} className="border border-gray-200 rounded p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Order {order.orderNumber}</p>
                      {order.supplierName && (
                        <p className="text-xs text-gray-600 mt-1">Supplier: {order.supplierName}</p>
                      )}
                    </div>
                    <span className="text-xs font-medium px-2 py-1 bg-gray-200 rounded">
                      {formatOrderStatus(order.status)}
                    </span>
                  </div>
                  {order.estimatedTotalCost != null && (
                    <p className="text-sm text-gray-600 mt-2">
                      Estimated Cost: £{order.estimatedTotalCost.toFixed(2)}
                    </p>
                  )}
                  {order.expectedDeliveryDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Expected Delivery: {formatDate(order.expectedDeliveryDate)}
                    </p>
                  )}
                  {order.notes && (
                    <p className="text-xs text-gray-600 mt-2 italic">{order.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Services/Work Completed */}
        {services && services.length > 0 && (
          <div className="mt-6 border-b border-gray-200 pb-6 print:break-inside-avoid">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Services ({services.length})</h3>
            <div className="space-y-3">
              {services.map((service, index) => (
                <div key={service.id || index} className="border-l-4 border-green-500 pl-4">
                  <p className="text-sm font-medium text-gray-800">{service.serviceName || service.name || "Service"}</p>
                  {service.description && (
                    <p className="text-xs text-gray-600 mt-1">{service.description}</p>
                  )}
                  {service.price && (
                    <p className="text-xs text-gray-600 mt-1">Price: £{service.price.toFixed(2)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-500 print:break-inside-avoid">
          <p className="font-medium">{companyName}</p>
          {(companyAddress || companyPhone) && (
            <p>
              {companyAddress && companyAddress}
              {companyAddress && companyPhone && " | "}
              {companyPhone && `Phone: ${companyPhone}`}
            </p>
          )}
          {(companyEmail || companyWebsite) && (
            <p>
              {companyEmail && `Email: ${companyEmail}`}
              {companyEmail && companyWebsite && " | "}
              {companyWebsite && `Website: ${companyWebsite}`}
            </p>
          )}
        </div>
      </div>
    );
  }
);

PrintJobOverview.displayName = "PrintJobOverview";
