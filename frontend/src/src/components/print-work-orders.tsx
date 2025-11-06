import { useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { formatDate, getStatusColor } from "@/lib/utils";
import logoPath from "@/assets/logo-m.png";

interface PrintWorkOrdersProps {
  trigger?: React.ReactNode;
}

export function PrintWorkOrders({ trigger }: PrintWorkOrdersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const componentRef = useRef<HTMLDivElement>(null);

  // Fetch all jobs
  const { data: jobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
  });

  // Fetch customers for customer names
  const { data: customers = [] } = useQuery({
    queryKey: ["/api/customers"],
  });

  // Fetch users for assignee names
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  // Filter non-completed jobs
  const activeJobs = jobs.filter((job: any) => job.status !== 'completed');

  // Helper functions
  const getCustomerName = (customerId: number | null) => {
    if (!customerId) return "Walk-in Customer";
    const customer = customers.find((c: any) => c.id === customerId);
    return customer ? customer.name : "Unknown Customer";
  };

  const getAssigneeName = (assigneeId: number | null) => {
    if (!assigneeId) return "Unassigned";
    const user = users.find((u: any) => u.id === assigneeId);
    return user ? user.fullName || user.username : "Unknown User";
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handlePrint = useReactToPrint({
    documentTitle: `Work Orders - ${formatDate(new Date().toISOString())}`,
    onBeforePrint: async () => {
      console.log("Before print initiated");
      localStorage.setItem('printInitiated', 'true');
      return Promise.resolve();
    },
    onAfterPrint: () => {
      console.log("Print completed or cancelled");
      localStorage.removeItem('printInitiated');
      setIsOpen(false);
    },
    onPrintError: (error) => {
      console.error("Print failed:", error);
      localStorage.removeItem('printInitiated');
      alert("Printing failed. Please try again or try sharing the page.");
    },
    pageStyle: `
      @page { 
        size: A4; 
        margin: 15mm; 
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
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
      }
    `,
    contentRef: componentRef,
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1">
            <Printer size={16} />
            Print Work Orders
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[4xl] max-h-[90vh] overflow-y-auto" aria-describedby="work-orders-description">
        <DialogHeader>
          <DialogTitle>Outstanding Work Orders</DialogTitle>
          <DialogDescription id="work-orders-description">
            {activeJobs.length} active jobs that need to be completed. Click Print to continue.
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[80vh] overflow-y-auto my-6 border border-gray-200 rounded-md">
          <div ref={componentRef} className="p-6 bg-white print:w-full print:shadow-none w-full max-w-4xl mx-auto">
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

            {/* Header */}
            <div className="text-center mb-8 pb-4 border-b-2 border-gray-300">
              <img src={logoPath} alt="Moore Horticulture Equipment" className="h-16 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">MOORE HORTICULTURE EQUIPMENT</h1>
              <h2 className="text-xl font-semibold text-gray-600 mb-2">Outstanding Work Orders</h2>
              <p className="text-sm text-gray-500">Generated on {formatDate(new Date().toISOString())}</p>
              <p className="text-sm text-gray-500">{activeJobs.length} Active Jobs</p>
            </div>

            {/* Jobs List */}
            {activeJobs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-gray-600">No outstanding work orders!</p>
                <p className="text-sm text-gray-500 mt-2">All jobs are completed.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {activeJobs.map((job: any, index: number) => {
                  const statusColors = getStatusColor(job.status);
                  return (
                    <div key={job.id} className="print:break-inside-avoid border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">{job.jobId}</h3>
                          <p className="text-sm text-gray-600">Created: {formatDate(job.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors.bgColor} ${statusColors.textColor}`}>
                            {formatStatus(job.status)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Customer:</p>
                          <p className="text-sm text-gray-900">{getCustomerName(job.customerId)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Assigned To:</p>
                          <p className="text-sm text-gray-900">{getAssigneeName(job.assignedTo)}</p>
                        </div>
                      </div>

                      {job.equipmentDescription && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700">Equipment:</p>
                          <p className="text-sm text-gray-900">{job.equipmentDescription}</p>
                        </div>
                      )}

                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700">Description:</p>
                        <p className="text-sm text-gray-900">{job.description}</p>
                      </div>

                      {job.taskDetails && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700">Task Details:</p>
                          <p className="text-sm text-gray-900">{job.taskDetails}</p>
                        </div>
                      )}

                      {job.estimatedHours && (
                        <div className="flex justify-between items-center text-xs text-gray-600 mt-3 pt-3 border-t border-gray-200">
                          <span>Estimated Hours: {job.estimatedHours}</span>
                          <span>Job #{index + 1} of {activeJobs.length}</span>
                        </div>
                      )}

                      {/* Work completion checkbox for print */}
                      <div className="mt-4 pt-3 border-t border-gray-200 print:block hidden">
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center space-x-2">
                            <input type="checkbox" className="w-4 h-4" />
                            <span className="text-sm">Work Completed</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input type="checkbox" className="w-4 h-4" />
                            <span className="text-sm">Customer Notified</span>
                          </label>
                        </div>
                        <div className="mt-2">
                          <label className="block text-xs text-gray-600">
                            Completion Notes:
                            <div className="mt-1 border-b border-gray-400 h-8"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
              <p>Moore Horticulture Equipment - Workshop Management System</p>
              <p>This document contains {activeJobs.length} outstanding work orders as of {formatDate(new Date().toISOString())}</p>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button className="gap-1" onClick={() => {
            if (!componentRef.current) {
              console.error("No component reference for printing");
              alert("Unable to print - please try again");
              return;
            }

            try {
              handlePrint();
            } catch (error) {
              console.error("Print error:", error);
              localStorage.removeItem('printInitiated');
              alert("Unable to open print dialog. Please try again or use Ctrl+P (Cmd+P on Mac) to print.");
            }
          }}>
            <Printer size={16} />
            Print Work Orders
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}