import React, { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Customer, Job, Service, User } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer } from "lucide-react";
import { useToast } from "../hooks/use-toast";

interface WorkDetailsSummaryProps {
  jobId: number;
  services: Service[];
}

export function WorkDetailsSummary({ jobId, services }: WorkDetailsSummaryProps) {
  const { toast } = useToast();
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch job data
  const { data: job } = useQuery<Job>({
    queryKey: [`/api/jobs/${jobId}`],
    enabled: !!jobId
  });

  // Fetch customers for customer name
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Fetch users for technician name
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Get customer name
  const getCustomerName = (customerId: number) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer ? customer.name : "Unknown Customer";
  };

  // Get technician name
  const getTechnicianName = (technicianId: number) => {
    const user = users.find((u) => u.id === technicianId);
    return user ? user.fullName : "Unknown Technician";
  };

  // Format service type
  const formatServiceType = (type: string) => {
    switch (type) {
      case "inspection":
        return "Equipment Inspection";
      case "repair":
        return "Repair";
      case "maintenance":
        return "Maintenance";
      case "testing":
        return "Testing";
      case "parts_replacement":
        return "Parts Replacement";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
    }
  };

  // Calculate total cost of parts
  const calculateTotalPartsCost = (parts: Array<Record<string, any>>) => {
    if (!parts || !Array.isArray(parts)) return 0;
    
    return parts.reduce((total, part) => {
      const cost = part.cost ? parseFloat(part.cost) : 0;
      const quantity = parseFloat(part.quantity) || 1;
      return total + (cost * quantity);
    }, 0);
  };

  // Handle print service
  const handlePrintService = (service: Service) => {
    setSelectedService(service);
    setIsPrintDialogOpen(true);
  };

  // Handle print action
  const handlePrint = () => {
    if (!printRef.current) return;
    
    const originalContents = document.body.innerHTML;
    const printContents = printRef.current.innerHTML;
    
    // Open a new window for printing
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({
        title: "Printing Error",
        description: "Could not open print window. Please check your browser settings.",
        variant: "destructive",
      });
      return;
    }
    
    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>Service Details - ${job?.jobId}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.5;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 10px;
            }
            .logo {
              max-width: 150px;
              margin-bottom: 10px;
            }
            h1 {
              font-size: 24px;
              margin: 0 0 5px 0;
            }
            h2 {
              font-size: 18px;
              margin: 0 0 20px 0;
              color: #555;
            }
            .section {
              margin-bottom: 20px;
            }
            .section-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 10px;
              border-bottom: 1px solid #eee;
              padding-bottom: 5px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
            }
            .info-item {
              margin-bottom: 10px;
            }
            .info-label {
              font-weight: bold;
              color: #555;
            }
            .details-box {
              border: 1px solid #ddd;
              padding: 15px;
              margin-bottom: 20px;
              border-radius: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
            }
            .totals {
              text-align: right;
              margin-top: 20px;
            }
            .footer {
              margin-top: 30px;
              font-size: 12px;
              color: #666;
              text-align: center;
              border-top: 1px solid #ddd;
              padding-top: 10px;
            }
            @media print {
              body {
                padding: 0;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          ${printContents}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Parse parts data
  const parseParts = (partsData: unknown): Array<Record<string, any>> => {
    if (!partsData) return [];
    
    try {
      // If it's already an array, return it
      if (Array.isArray(partsData)) return partsData as Array<Record<string, any>>;

      // If it's a string, try to parse it
      if (typeof partsData === "string") {
        const parsed = JSON.parse(partsData);
        return Array.isArray(parsed) ? parsed : [parsed];
      }

      // If it's an object but not an array, return it as a single-item array
      if (typeof partsData === "object") {
        return [partsData as Record<string, any>];
      }
    } catch (error) {
      console.error("Error parsing parts data:", error);
    }
    
    return [];
  };

  // Get the latest service record
  const latestService = services.length > 0 
    ? [...services].sort(
        (a, b) =>
          new Date((b.performedAt as string | undefined) ?? (b.createdAt as string | undefined) ?? "").getTime() -
          new Date((a.performedAt as string | undefined) ?? (a.createdAt as string | undefined) ?? "").getTime()
      )[0] 
    : null;

  return (
    <div className="space-y-4">
      {!latestService ? (
        <div className="text-center py-6 border border-dashed rounded-md">
          <p className="text-neutral-500">No work details available for this job.</p>
        </div>
      ) : (
        <>
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-medium">{formatServiceType(latestService.serviceType)}</h3>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {formatDate(latestService.performedAt || latestService.createdAt)}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-1"
                  onClick={() => handlePrintService(latestService)}
                >
                  <Printer size={16} /> Print
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Performed By</h4>
                  <p>{latestService.performedBy ? getTechnicianName(latestService.performedBy) : "Not assigned"}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Labor Hours</h4>
                  <p>{latestService.laborHours ? `${parseFloat(latestService.laborHours).toFixed(1)} hrs` : "Not specified"}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Cost</h4>
                  <p>{latestService.cost ? `£${parseFloat(latestService.cost).toFixed(2)}` : "Not specified"}</p>
                </div>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Work Details</h4>
                <p className="whitespace-pre-line">{latestService.details || "No details provided"}</p>
              </div>
              
              {latestService.notes && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Additional Notes</h4>
                  <p className="whitespace-pre-line">{latestService.notes}</p>
                </div>
              )}
              
              {/* Parts Used */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Parts Used</h4>
                {latestService.partsUsed && parseParts(latestService.partsUsed).length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part Name</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Cost</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parseParts(latestService.partsUsed).map((part: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{part.name}</TableCell>
                            <TableCell>{part.quantity}</TableCell>
                            <TableCell>
                              {part.cost ? `£${parseFloat(part.cost).toFixed(2)}` : '-'}
                            </TableCell>
                            <TableCell>
                              {part.cost && part.quantity
                                ? `£${(parseFloat(part.cost) * parseFloat(part.quantity)).toFixed(2)}`
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={3} className="text-right font-medium">
                            Total Parts Cost:
                          </TableCell>
                          <TableCell className="font-medium">
                            £{calculateTotalPartsCost(parseParts(latestService.partsUsed)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No parts recorded for this service.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
      
      {/* Print Dialog */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Print Service Details</DialogTitle>
          </DialogHeader>
          
          <div ref={printRef}>
            <div className="header">
              <img 
                src="/client/public/logo.png" 
                alt="Moore Horticulture Equipment" 
                className="logo mx-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <h1>Moore Horticulture Equipment</h1>
              <h2>Service Details</h2>
            </div>
            
            {selectedService && job && (
              <>
                <div className="section">
                  <div className="section-title">Job Information</div>
                  <div className="info-grid">
                    <div className="info-item">
                      <div className="info-label">Job ID:</div>
                      <div>{job.jobId}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Customer:</div>
                      <div>{getCustomerName(job.customerId)}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Equipment:</div>
                      <div>{job.equipmentDescription || "Custom Equipment"}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Date:</div>
                      <div>{formatDate(selectedService.performedAt || selectedService.createdAt)}</div>
                    </div>
                  </div>
                </div>
                
                <div className="section">
                  <div className="section-title">Service Information</div>
                  <div className="info-grid">
                    <div className="info-item">
                      <div className="info-label">Service Type:</div>
                      <div>{formatServiceType(selectedService.serviceType)}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Performed By:</div>
                      <div>
                        {selectedService.performedBy ? getTechnicianName(selectedService.performedBy) : "Not assigned"}
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Service Cost:</div>
                      <div>{selectedService.cost ? `£${parseFloat(selectedService.cost).toFixed(2)}` : "Not specified"}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Labour Hours:</div>
                      <div>{selectedService.laborHours || "Not specified"}</div>
                    </div>
                  </div>
                </div>
                
                <div className="section">
                  <div className="section-title">Work Details</div>
                  <div className="details-box">
                    {selectedService.details || "No details provided"}
                  </div>
                </div>
                
                {selectedService.notes && (
                  <div className="section">
                    <div className="section-title">Additional Notes</div>
                    <div className="details-box">
                      {selectedService.notes}
                    </div>
                  </div>
                )}
                
                <div className="section">
                  <div className="section-title">Parts Used</div>
                  {selectedService.partsUsed && parseParts(selectedService.partsUsed).length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Part Name</th>
                          <th>Quantity</th>
                          <th>Unit Cost</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseParts(selectedService.partsUsed).map((part: any, index: number) => (
                          <tr key={index}>
                            <td>{part.name}</td>
                            <td>{part.quantity}</td>
                            <td>{part.cost ? `£${parseFloat(part.cost).toFixed(2)}` : '-'}</td>
                            <td>
                              {part.cost && part.quantity
                                ? `£${(parseFloat(part.cost) * parseFloat(part.quantity)).toFixed(2)}`
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div>No parts recorded for this service.</div>
                  )}
                  
                  <div className="totals">
                    <div><strong>Parts Total:</strong> £{calculateTotalPartsCost(parseParts(selectedService.partsUsed)).toFixed(2)}</div>
                    <div><strong>Service Cost:</strong> {selectedService.cost ? `£${parseFloat(selectedService.cost).toFixed(2)}` : "Not specified"}</div>
                    <div><strong>Total Cost:</strong> £{(
                      calculateTotalPartsCost(parseParts(selectedService.partsUsed)) + 
                      (selectedService.cost ? parseFloat(selectedService.cost) : 0)
                    ).toFixed(2)}</div>
                  </div>
                </div>
                
                <div className="footer">
                  <p>Moore Horticulture Equipment - Thank you for your business</p>
                  <p>Printed on {formatDate(new Date().toISOString())}</p>
                </div>
              </>
            )}
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsPrintDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePrint}>
              Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}