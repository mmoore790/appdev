import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatDate } from "@/lib/utils";
import logoPath from "@/assets/logo-m.png";

interface PrintWorkCompletionProps {
  jobId: number;
  jobData?: any;
}

export function PrintWorkCompletion({ jobId, jobData }: PrintWorkCompletionProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  // Get work completed entries
  const { data: workEntries = [] } = useQuery({
    queryKey: [`/api/work-completed/${jobId}`],
    enabled: !!jobId,
  });

  // Get job details
  const { data: job } = useQuery({
    queryKey: [`/api/jobs/${jobId}`],
    enabled: !!jobId && !jobData,
  });

  const jobDetails = jobData || job;
  const workEntriesArray = Array.isArray(workEntries) ? workEntries : [];

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Work-Completion-${jobDetails?.jobId || jobId}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 20mm;
      }
      @media print {
        body { 
          font-family: Arial, sans-serif;
          color: black !important;
          background: white !important;
        }
        * {
          color: black !important;
          background: white !important;
        }
      }
    `,
  });

  const calculateTotalHours = () => {
    return workEntriesArray.reduce((total: number, entry: any) => total + (parseFloat(entry.laborHours) || 0), 0);
  };

  const calculateTotalCost = () => {
    return workEntriesArray.reduce((total: number, entry: any) => total + (parseFloat(entry.partsCost) || 0), 0);
  };

  if (!workEntriesArray.length) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handlePrint}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        <Printer size={16} />
        Print Work Completion
      </Button>

      {/* Hidden printable content */}
      <div style={{ display: "none" }}>
        <div ref={componentRef} className="print-content">
          <div style={{ 
            fontFamily: "Arial, sans-serif", 
            maxWidth: "210mm", 
            margin: "0 auto", 
            padding: "20mm",
            backgroundColor: "white",
            color: "black"
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: "30px", borderBottom: "2px solid #333", paddingBottom: "20px" }}>
              <img 
                src={logoPath} 
                alt="Moore Horticulture Equipment Logo" 
                style={{ width: "80px", height: "80px", marginRight: "20px" }}
              />
              <div style={{ flex: 1, textAlign: "center" }}>
                <h1 style={{ margin: "0", fontSize: "28px", fontWeight: "bold", color: "#2d5a27" }}>
                  MOORE HORTICULTURE EQUIPMENT
                </h1>
                <div style={{ fontSize: "14px", marginTop: "10px", lineHeight: "1.4" }}>
                  <div>9 Drumalig Road, BT27 6UD</div>
                  <div>Tel: 02897510804 | Email: info@mooresmowers.co.uk</div>
                  <div>www.mooresmowers.co.uk</div>
                </div>
              </div>
            </div>

            {/* Summary of Work Completed Title */}
            <div style={{ textAlign: "center", marginBottom: "30px" }}>
              <h2 style={{ 
                margin: "0", 
                fontSize: "24px", 
                fontWeight: "bold", 
                color: "#333",
                backgroundColor: "#f5f5f5",
                padding: "15px",
                border: "2px solid #ddd"
              }}>
                SUMMARY OF WORK COMPLETED
              </h2>
            </div>

            {/* Job Information */}
            <div style={{ marginBottom: "30px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "15px", color: "#2d5a27" }}>
                Job Information
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "8px", fontWeight: "bold", backgroundColor: "#f9f9f9", border: "1px solid #ddd", width: "30%" }}>
                      Job ID:
                    </td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                      {jobDetails?.jobId}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "8px", fontWeight: "bold", backgroundColor: "#f9f9f9", border: "1px solid #ddd" }}>
                      Customer:
                    </td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                      {jobDetails?.customerName}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "8px", fontWeight: "bold", backgroundColor: "#f9f9f9", border: "1px solid #ddd" }}>
                      Equipment:
                    </td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                      {jobDetails?.equipmentDescription || "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "8px", fontWeight: "bold", backgroundColor: "#f9f9f9", border: "1px solid #ddd" }}>
                      Completion Date:
                    </td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                      {formatDate(new Date().toISOString())}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Work Completed Details */}
            <div style={{ marginBottom: "30px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "15px", color: "#2d5a27" }}>
                Work Completed
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#2d5a27", color: "white" }}>
                    <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left" }}>
                      Work Description
                    </th>
                    <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center", width: "80px" }}>
                      Hours
                    </th>
                    <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center", width: "100px" }}>
                      Parts Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workEntriesArray.map((entry: any, index: number) => (
                    <tr key={entry.id || index} style={{ backgroundColor: index % 2 === 0 ? "#f9f9f9" : "white" }}>
                      <td style={{ padding: "12px", border: "1px solid #ddd", verticalAlign: "top" }}>
                        <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                          {entry.workDescription}
                        </div>
                        {entry.partsUsed && (
                          <div style={{ fontSize: "12px", color: "#666", fontStyle: "italic" }}>
                            Parts: {entry.partsUsed}
                          </div>
                        )}
                        {entry.notes && (
                          <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                            Notes: {entry.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>
                        {parseFloat(entry.laborHours || 0).toFixed(1)}h
                      </td>
                      <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>
                        {entry.partsCost ? `£${parseFloat(entry.partsCost).toFixed(2)}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div style={{ marginBottom: "30px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "15px", color: "#2d5a27" }}>
                Work Summary
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "12px", fontWeight: "bold", backgroundColor: "#f9f9f9", border: "1px solid #ddd", width: "70%" }}>
                      Total Labor Hours:
                    </td>
                    <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "right", fontWeight: "bold" }}>
                      {calculateTotalHours().toFixed(1)} hours
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "12px", fontWeight: "bold", backgroundColor: "#f9f9f9", border: "1px solid #ddd" }}>
                      Total Parts Cost:
                    </td>
                    <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "right", fontWeight: "bold" }}>
                      £{calculateTotalCost().toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Certification */}
            <div style={{ marginTop: "40px", textAlign: "center", border: "2px solid #2d5a27", padding: "20px", backgroundColor: "#f8f9f8" }}>
              <p style={{ margin: "0", fontSize: "16px", fontWeight: "bold", color: "#2d5a27" }}>
                This certificate confirms that all listed work has been completed to our professional standards.
              </p>
              <div style={{ marginTop: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", maxWidth: "500px", margin: "30px auto 0" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ borderBottom: "1px solid #333", width: "200px", marginBottom: "5px" }}></div>
                  <div style={{ fontSize: "12px", color: "#666" }}>Technician Signature</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                    {formatDate(new Date().toISOString())}
                  </div>
                  <div style={{ fontSize: "12px", color: "#666" }}>Date</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: "30px", textAlign: "center", fontSize: "12px", color: "#666", borderTop: "1px solid #ddd", paddingTop: "15px" }}>
              <p style={{ margin: "0" }}>
                Thank you for choosing Moore Horticulture Equipment for your equipment servicing needs.
              </p>
              <p style={{ margin: "5px 0 0 0" }}>
                For any queries regarding this work, please contact us at 02897510804 or info@mooresmowers.co.uk
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}