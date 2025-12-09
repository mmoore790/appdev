import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface PrintJobSheetProps {
  jobId: number;
  jobData?: any;
}

interface Business {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  hourlyLabourFee?: number | null;
}

interface User {
  id: number;
  fullName: string;
}

interface JobNote {
  workSummary?: string | null;
  internalNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// UK VAT rate (20%)
const VAT_RATE = 0.20;

const calculateIncludingVat = (excludingVat: number): number => {
  return excludingVat * (1 + VAT_RATE);
};

export function PrintJobSheet({ jobId, jobData }: PrintJobSheetProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  // Get job details
  const { data: job } = useQuery({
    queryKey: [`/api/jobs/${jobId}`],
    enabled: !!jobId && !jobData,
  });

  // Get labour entries
  const { data: labourEntries = [] } = useQuery({
    queryKey: [`/api/job-sheet/${jobId}/labour`],
    enabled: !!jobId,
  });

  // Get parts used
  const { data: partsUsed = [] } = useQuery({
    queryKey: [`/api/job-sheet/${jobId}/parts`],
    enabled: !!jobId,
  });

  // Get job notes
  const { data: jobNote } = useQuery<JobNote>({
    queryKey: [`/api/job-sheet/${jobId}/notes`],
    enabled: !!jobId,
  });

  // Get users for technician names
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Get business data for company details and hourly labour fee
  const { data: business } = useQuery<Business>({
    queryKey: ["/api/business/me"],
  });

  const jobDetails = jobData || job;
  const labourEntriesArray = Array.isArray(labourEntries) ? labourEntries : [];
  const partsUsedArray = Array.isArray(partsUsed) ? partsUsed : [];

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Job-Sheet-${jobDetails?.jobId || jobId}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 15mm;
      }
      @media print {
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: black !important;
          background: white !important;
        }
        * {
          color: black !important;
        }
        .no-print {
          display: none !important;
        }
      }
    `,
  });

  const getUserName = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    return user ? user.fullName : "Unknown";
  };

  const totalLabourTime = labourEntriesArray.reduce((total: number, entry: any) => total + (entry.timeSpent || 0), 0) / 60; // Convert to hours
  
  // Calculate labour costs (use stored values if available, otherwise calculate)
  const hourlyRate = business?.hourlyLabourFee ? business.hourlyLabourFee / 100 : null;
  
  const totalLabourExcludingVat = labourEntriesArray.reduce((total: number, entry: any) => {
    const costExcludingVat = entry.costExcludingVat ? entry.costExcludingVat / 100 : 
                             (entry.cost ? entry.cost / 100 : 
                              (hourlyRate && entry.timeSpent ? (entry.timeSpent / 60) * hourlyRate : 0));
    return total + costExcludingVat;
  }, 0);

  const totalLabourIncludingVat = labourEntriesArray.reduce((total: number, entry: any) => {
    const costIncludingVat = entry.costIncludingVat ? entry.costIncludingVat / 100 :
                             (entry.costExcludingVat ? calculateIncludingVat(entry.costExcludingVat / 100) :
                              (entry.cost ? calculateIncludingVat(entry.cost / 100) :
                               (hourlyRate && entry.timeSpent ? calculateIncludingVat((entry.timeSpent / 60) * hourlyRate) : 0)));
    return total + costIncludingVat;
  }, 0);

  // Calculate parts costs
  const totalPartsExcludingVat = partsUsedArray.reduce((total: number, part: any) => {
    const costExcludingVat = part.costExcludingVat ? part.costExcludingVat / 100 : 
                             (part.cost ? part.cost / 100 : 0);
    return total + costExcludingVat;
  }, 0);

  const totalPartsIncludingVat = partsUsedArray.reduce((total: number, part: any) => {
    const costIncludingVat = part.costIncludingVat ? part.costIncludingVat / 100 :
                             (part.costExcludingVat ? calculateIncludingVat(part.costExcludingVat / 100) :
                              (part.cost ? calculateIncludingVat(part.cost / 100) : 0));
    return total + costIncludingVat;
  }, 0);

  // Calculate grand totals
  const grandTotalExcludingVat = totalLabourExcludingVat + totalPartsExcludingVat;
  const grandTotalIncludingVat = totalLabourIncludingVat + totalPartsIncludingVat;

  if (!jobDetails) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handlePrint}
        variant="outline"
        size="sm"
        className="flex items-center gap-2 no-print"
      >
        <Printer size={16} />
        Print Job Sheet
      </Button>

      {/* Hidden printable content */}
      <div style={{ display: "none" }}>
        <div ref={componentRef} className="print-content">
          <div style={{ 
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", 
            maxWidth: "210mm", 
            margin: "0 auto", 
            padding: "15mm",
            backgroundColor: "white",
            color: "#1a1a1a"
          }}>
            {/* Header with Logo and Company Details */}
            <div style={{ 
              marginBottom: "25px", 
              borderBottom: "2px solid #000",
              paddingBottom: "20px"
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "20px", marginBottom: "15px" }}>
                {business?.logoUrl && (
                  <img 
                    src={business.logoUrl} 
                    alt={business.name || "Company Logo"} 
                    style={{ 
                      maxHeight: "70px", 
                      maxWidth: "150px", 
                      objectFit: "contain"
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <h1 style={{ 
                    margin: "0 0 8px 0", 
                    fontSize: "32px", 
                    fontWeight: "700", 
                    color: "#000",
                    letterSpacing: "-0.5px"
                  }}>
                    {business?.name || "Company Name"}
                  </h1>
                  <div style={{ fontSize: "11px", color: "#000", lineHeight: "1.6" }}>
                    {business?.address && <div>{business.address}</div>}
                    <div style={{ display: "flex", gap: "12px", marginTop: "4px", flexWrap: "wrap" }}>
                      {business?.phone && <span>Tel: {business.phone}</span>}
                      {business?.email && <span>Email: {business.email}</span>}
                      {business?.website && <span>Web: {business.website}</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ 
                textAlign: "center", 
                padding: "12px", 
                backgroundColor: "#fff", 
                borderRadius: "6px",
                border: "1px solid #000"
              }}>
                <h2 style={{ 
                  margin: "0", 
                  fontSize: "24px", 
                  fontWeight: "600", 
                  color: "#000",
                  letterSpacing: "1px"
                }}>
                  JOB SHEET
                </h2>
                <div style={{ fontSize: "12px", color: "#000", marginTop: "4px" }}>
                  Work Completed Report
                </div>
              </div>
            </div>

            {/* Compact Job Information */}
            <div style={{ 
              marginBottom: "25px",
              backgroundColor: "#fff",
              padding: "12px 16px",
              borderRadius: "6px",
              border: "1px solid #000"
            }}>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(3, 1fr)", 
                gap: "12px",
                fontSize: "11px",
                lineHeight: "1.5"
              }}>
                <div>
                  <span style={{ fontWeight: "600", color: "#000" }}>Job Number:</span>
                  <span style={{ marginLeft: "6px", color: "#000" }}>{jobDetails.jobId}</span>
                </div>
                <div>
                  <span style={{ fontWeight: "600", color: "#000" }}>Date:</span>
                  <span style={{ marginLeft: "6px", color: "#000" }}>{formatDate(jobDetails.createdAt)}</span>
                </div>
                <div>
                  <span style={{ fontWeight: "600", color: "#000" }}>Status:</span>
                  <span style={{ marginLeft: "6px", color: "#000" }}>
                    {jobDetails.status ? jobDetails.status.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : "N/A"}
                  </span>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ fontWeight: "600", color: "#000" }}>Customer:</span>
                  <span style={{ marginLeft: "6px", color: "#000" }}>{jobDetails.customerName || "N/A"}</span>
                </div>
                <div>
                  <span style={{ fontWeight: "600", color: "#000" }}>Assigned To:</span>
                  <span style={{ marginLeft: "6px", color: "#000" }}>
                    {jobDetails.assignedToName || getUserName(jobDetails.assignedTo) || "N/A"}
                  </span>
                </div>
                <div style={{ gridColumn: "span 3" }}>
                  <span style={{ fontWeight: "600", color: "#000" }}>Equipment:</span>
                  <span style={{ marginLeft: "6px", color: "#000" }}>
                    {jobDetails.equipmentDescription || jobDetails.description || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Labour Entries */}
            {labourEntriesArray.length > 0 && (
              <div style={{ marginBottom: "25px" }}>
                <h3 style={{ 
                  fontSize: "16px", 
                  fontWeight: "600", 
                  marginBottom: "12px", 
                  color: "#000",
                  borderBottom: "2px solid #000",
                  paddingBottom: "6px"
                }}>
                  Labour Entries
                </h3>
                <table style={{ 
                  width: "100%", 
                  borderCollapse: "collapse", 
                  fontSize: "11px",
                  border: "1px solid #000"
                }}>
                  <thead>
                    <tr style={{ backgroundColor: "#fff", borderBottom: "2px solid #000" }}>
                      <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", color: "#000" }}>Technician</th>
                      <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", color: "#000" }}>Description</th>
                      <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: "600", color: "#000" }}>Time</th>
                      <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: "600", color: "#000" }}>Cost (Ex VAT)</th>
                      <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: "600", color: "#000" }}>Cost (Inc VAT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labourEntriesArray.map((entry: any, index: number) => {
                      const costExcludingVat = entry.costExcludingVat ? entry.costExcludingVat / 100 : 
                                               (entry.cost ? entry.cost / 100 : 
                                                (hourlyRate && entry.timeSpent ? (entry.timeSpent / 60) * hourlyRate : 0));
                      const costIncludingVat = entry.costIncludingVat ? entry.costIncludingVat / 100 :
                                               (costExcludingVat > 0 ? calculateIncludingVat(costExcludingVat) : 0);
                      
                      return (
                        <tr key={entry.id || index} style={{ borderBottom: "1px solid #000" }}>
                          <td style={{ padding: "10px 8px", color: "#000" }}>{getUserName(entry.technicianId)}</td>
                          <td style={{ padding: "10px 8px", color: "#000" }}>{entry.description}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>{(entry.timeSpent / 60).toFixed(2)}h</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>
                            {costExcludingVat > 0 ? `£${costExcludingVat.toFixed(2)}` : "-"}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>
                            {costIncludingVat > 0 ? `£${costIncludingVat.toFixed(2)}` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ backgroundColor: "#fff", fontWeight: "600", borderTop: "2px solid #000" }}>
                      <td colSpan={2} style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>Total Labour:</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>{totalLabourTime.toFixed(2)}h</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>
                        {totalLabourExcludingVat > 0 ? `£${totalLabourExcludingVat.toFixed(2)}` : "-"}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>
                        {totalLabourIncludingVat > 0 ? `£${totalLabourIncludingVat.toFixed(2)}` : "-"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Parts Used */}
            {partsUsedArray.length > 0 && (
              <div style={{ marginBottom: "25px" }}>
                <h3 style={{ 
                  fontSize: "16px", 
                  fontWeight: "600", 
                  marginBottom: "12px", 
                  color: "#000",
                  borderBottom: "2px solid #000",
                  paddingBottom: "6px"
                }}>
                  Items/Parts Used
                </h3>
                <table style={{ 
                  width: "100%", 
                  borderCollapse: "collapse", 
                  fontSize: "11px",
                  border: "1px solid #000"
                }}>
                  <thead>
                    <tr style={{ backgroundColor: "#fff", borderBottom: "2px solid #000" }}>
                      <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", color: "#000" }}>Part Name</th>
                      <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", color: "#000" }}>SKU</th>
                      <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: "600", color: "#000" }}>Qty</th>
                      <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: "600", color: "#000" }}>Cost (Ex VAT)</th>
                      <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: "600", color: "#000" }}>Cost (Inc VAT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partsUsedArray.map((part: any, index: number) => {
                      const costExcludingVat = part.costExcludingVat ? part.costExcludingVat / 100 : 
                                               (part.cost ? part.cost / 100 : 0);
                      const costIncludingVat = part.costIncludingVat ? part.costIncludingVat / 100 :
                                               (costExcludingVat > 0 ? calculateIncludingVat(costExcludingVat) : 0);
                      
                      return (
                        <tr key={part.id || index} style={{ borderBottom: "1px solid #000" }}>
                          <td style={{ padding: "10px 8px", color: "#000" }}>{part.partName}</td>
                          <td style={{ padding: "10px 8px", color: "#000" }}>{part.sku || "-"}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>{part.quantity}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>
                            {costExcludingVat > 0 ? `£${costExcludingVat.toFixed(2)}` : "-"}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>
                            {costIncludingVat > 0 ? `£${costIncludingVat.toFixed(2)}` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ backgroundColor: "#fff", fontWeight: "600", borderTop: "2px solid #000" }}>
                      <td colSpan={3} style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>Total Parts:</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>
                        {totalPartsExcludingVat > 0 ? `£${totalPartsExcludingVat.toFixed(2)}` : "-"}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "#000" }}>
                        {totalPartsIncludingVat > 0 ? `£${totalPartsIncludingVat.toFixed(2)}` : "-"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Work Summary */}
            {jobNote?.workSummary && (
              <div style={{ marginBottom: "25px" }}>
                <h3 style={{ 
                  fontSize: "16px", 
                  fontWeight: "600", 
                  marginBottom: "12px", 
                  color: "#000",
                  borderBottom: "2px solid #000",
                  paddingBottom: "6px"
                }}>
                  Work Summary
                </h3>
                <div style={{ 
                  padding: "14px", 
                  backgroundColor: "#fff", 
                  borderRadius: "6px", 
                  border: "1px solid #000",
                  fontSize: "11px", 
                  lineHeight: "1.7",
                  color: "#000"
                }}>
                  {jobNote.workSummary.split('\n').map((line: string, index: number) => (
                    <div key={index} style={{ marginBottom: line ? "6px" : "0" }}>{line || "\u00A0"}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Total Price Section */}
            {(grandTotalExcludingVat > 0 || grandTotalIncludingVat > 0) && (
              <div style={{ 
                marginTop: "20px",
                marginBottom: "20px",
                textAlign: "right",
                fontSize: "12px"
              }}>
                <div style={{ marginBottom: "4px" }}>
                  <span style={{ fontWeight: "600", color: "#000" }}>Total (Ex VAT): </span>
                  <span style={{ color: "#000" }}>£{grandTotalExcludingVat.toFixed(2)}</span>
                </div>
                <div>
                  <span style={{ fontWeight: "600", color: "#000" }}>Total (Inc VAT): </span>
                  <span style={{ color: "#000" }}>£{grandTotalIncludingVat.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ 
              marginTop: "30px", 
              paddingTop: "15px", 
              borderTop: "1px solid #000", 
              fontSize: "9px", 
              color: "#000", 
              textAlign: "center",
              lineHeight: "1.5"
            }}>
              <div>This is a computer-generated document.</div>
              <div style={{ marginTop: "4px" }}>Generated on {formatDate(new Date().toISOString())}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
