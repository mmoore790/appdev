import { forwardRef } from "react";
import { formatDate } from "@/lib/utils";
import logoPath from "@assets/logo-m.png";

interface JobReceiptProps {
  job: any;
  customerName: string;
  customerEmail?: string;
  equipmentName: string;
  assigneeName: string;
  companyInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
  };
}

export const JobReceipt = forwardRef<HTMLDivElement, JobReceiptProps>(
  (
    {
      job,
      customerName,
      customerEmail,
      equipmentName,
      assigneeName,
      companyInfo = {
        name: "Moore Horticulture Equipment",
        address: "9 Drumalig Road, BT27 6UD",
        phone: "02897510804",
        email: "info@mooresmowers.co.uk",
        website: "www.mooresmowers.co.uk",
      },
    },
    ref
  ) => {
    // Format status for display
    const formatStatus = (status: string) => {
      switch (status) {
        case "waiting_assessment":
          return "Waiting Assessment";
        case "in_progress":
          return "In Progress";
        case "parts_ordered":
          return "Parts Ordered";
        case "completed":
          return "Completed";
        default:
          return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
      }
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
          `}
        </style>

        {/* Header - Logo and Title */}
        <div className="flex justify-between items-center border-b border-gray-200 pb-6">
          <div className="flex items-center">
            <img src={logoPath} alt="Moore Horticulture Equipment Logo" className="h-16 w-auto mr-4" />
            <div>
              <h1 className="text-2xl font-bold text-green-800">{companyInfo.name}</h1>
              <p className="text-sm text-gray-600">{companyInfo.address}</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-semibold text-gray-800">Workshop Job Receipt</h2>
            <p className="text-sm text-gray-600">{formatDate(job.createdAt)}</p>
            <p className="text-sm font-medium text-green-700 mt-1">Job ID: {job.jobId}</p>
          </div>
        </div>

        {/* Customer & Equipment Info */}
        <div className="grid grid-cols-2 gap-6 mt-6 border-b border-gray-200 pb-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Customer Information</h3>
            <div className="mt-2">
              <h4 className="text-base font-bold text-gray-800">{customerName}</h4>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Brand & Model of Machine</h3>
            <div className="mt-2">
              <h4 className="text-base font-medium text-gray-800">{equipmentName}</h4>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="mt-6 border-b border-gray-200 pb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase">Job Details</h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-base font-medium text-gray-800">{formatStatus(job.status)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Assigned To</p>
              <p className="text-base font-medium text-gray-800">{assigneeName}</p>
            </div>
            {job.estimatedHours && (
              <div>
                <p className="text-sm text-gray-500">Estimated Hours</p>
                <p className="text-base font-medium text-gray-800">{job.estimatedHours}</p>
              </div>
            )}
          </div>
          
          <div className="mt-4">
            <p className="text-sm text-gray-500">Description</p>
            <p className="text-base text-gray-800 whitespace-pre-line">{job.description}</p>
          </div>
          
          {job.taskDetails && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Task Details</p>
              <p className="text-base text-gray-800 whitespace-pre-line">{job.taskDetails}</p>
            </div>
          )}
        </div>

        {/* Terms & Signature */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Terms & Conditions</h3>
          <ul className="text-xs text-gray-600 list-disc list-inside">
            <li>All equipment is subject to inspection upon receipt</li>
            <li>Repairs will be completed as efficiently as possible</li>
            <li>Parts may need to be ordered, which could affect completion timelines</li>
            <li>You will be notified of any unexpected issues or costs</li>
            <li>Payment is due upon completion of service</li>
          </ul>

          <div className="mt-8 text-right">
            <p className="text-xs text-gray-500">Receipt Date: {formatDate(job.createdAt)}</p>
          </div>
        </div>

        {/* Online Tracking Information */}
        <div className="mt-5 p-4 bg-green-50 rounded-md border border-green-100">
          <h3 className="text-sm font-semibold text-green-800 mb-2">Track Your Repair Online</h3>
          <p className="text-xs text-gray-700 mb-3">
            Visit our online tracker to check the status of your repair anytime:
          </p>
          <div className="bg-white p-3 rounded border border-gray-200 text-center">
            <p className="text-xs mb-1">Visit this link:</p>
            <p className="text-sm font-medium text-green-700 break-all">
              {`${window.location.origin}/job-tracker?jobId=${job.jobId}&email=${encodeURIComponent(customerEmail || '')}`}
            </p>
            <p className="text-xs mt-2 text-gray-500">
              You'll need your email address and the job ID ({job.jobId}) shown above
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p className="font-medium">{companyInfo.name}</p>
          <p>{companyInfo.address} | Phone: {companyInfo.phone}</p>
          <p>Email: {companyInfo.email} | Website: {companyInfo.website}</p>
        </div>
      </div>
    );
  }
);

JobReceipt.displayName = "JobReceipt";