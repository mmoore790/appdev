import { useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { JobReceipt } from "./job-receipt";

type Business = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  logoUrl?: string | null;
};

interface PrintJobDialogProps {
  job: any;
  customerName: string;
  customerEmail?: string;
  equipmentName: string;
  assigneeName: string;
  trigger?: React.ReactNode;
}

export function PrintJobDialog({ 
  job, 
  customerName, 
  customerEmail,
  equipmentName, 
  assigneeName,
  trigger
}: PrintJobDialogProps) {
  const componentRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch company info from settings
  const { data: companyInfo } = useQuery<Business>({
    queryKey: ["/api/business/me"],
  });

  const handlePrint = useReactToPrint({
    documentTitle: `Workshop Job Receipt - ${job.jobId}`,
    onBeforePrint: async () => {
      console.log("Before print initiated");
      // Set a flag in localStorage to track if print was initiated
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
    // Enhanced pageStyle for A4 format and mobile compatibility
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
            Print Receipt
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[4xl] max-h-[90vh] overflow-y-auto" aria-describedby="job-receipt-description">
        <DialogHeader>
          <DialogTitle>Workshop Job Receipt</DialogTitle>
          <DialogDescription id="job-receipt-description">
            The receipt will be printed as shown below. Click the Print button to continue.
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[80vh] overflow-y-auto my-6 border border-gray-200 rounded-md">
          <JobReceipt
            ref={componentRef}
            job={job}
            customerName={customerName}
            customerEmail={customerEmail}
            equipmentName={equipmentName}
            assigneeName={assigneeName}
            companyInfo={companyInfo}
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button className="gap-1" onClick={() => {
            // Check if there's a reference
            if (!componentRef.current) {
              console.error("No component reference for printing");
              alert("Unable to print - please try again");
              return;
            }
            
            // Check if we're on a mobile device
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // Attempt to print with timeout for mobile devices
            try {
              // On mobile, show instructions first for a better experience
              if (isMobile) {
                alert("After clicking OK, the print dialog will appear. On some mobile devices, you may need to tap the share icon and then select 'Print'.");
                
                // Give the user time to read and dismiss the alert
                setTimeout(() => {
                  handlePrint();
                  
                  // Check if print dialog might have failed (only on mobile)
                  setTimeout(() => {
                    // If the print was initiated but onAfterPrint wasn't triggered after 2 seconds
                    if (localStorage.getItem('printInitiated') === 'true') {
                      localStorage.removeItem('printInitiated');
                      alert("If the print dialog didn't appear, please try using your browser's share button and select 'Print'");
                    }
                  }, 2000);
                }, 500);
              } else {
                // Desktop experience stays the same
                handlePrint();
              }
            } catch (error) {
              console.error("Error initiating print:", error);
              localStorage.removeItem('printInitiated');
              
              // Fallback method for mobile browsers
              if (isMobile) {
                alert("Please use your browser's share feature (usually an arrow icon) and select 'Print'");
              } else {
                alert("Unable to open print dialog. Please try again or use Ctrl+P (Cmd+P on Mac) to print.");
              }
            }
          }}>
            <Printer size={16} />
            Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}