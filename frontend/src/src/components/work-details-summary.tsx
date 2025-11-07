import React, { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WorkDetailsSummaryProps {
  jobId: number;
  services?: RawService[];
}

interface RawService {
  performedAt?: string | null;
  createdAt?: string | null;
  serviceType?: string | null;
  performedBy?: number | null;
  laborHours?: string | number | null;
  cost?: string | number | null;
  details?: string | null;
  notes?: string | null;
  partsUsed?: unknown;
  [key: string]: unknown;
}

interface ParsedPart {
  name?: string;
  quantity?: string | number | null;
  cost?: string | number | null;
  [key: string]: unknown;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  inspection: "Equipment Inspection",
  repair: "Repair",
  maintenance: "Maintenance",
  testing: "Testing",
  parts_replacement: "Parts Replacement",
};

const logoUrl = new URL("@/assets/logo-m.png", import.meta.url).href;

function formatServiceType(type?: string | null) {
  if (!type) return "Service";
  const normalized = type.toLowerCase();
  if (SERVICE_TYPE_LABELS[normalized]) {
    return SERVICE_TYPE_LABELS[normalized];
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).replace(/_/g, " ");
}

function parseParts(partsData: unknown): ParsedPart[] {
  if (!partsData) return [];

  try {
    if (Array.isArray(partsData)) {
      return partsData as ParsedPart[];
    }

    if (typeof partsData === "string") {
      const trimmed = partsData.trim();
      if (!trimmed) return [];
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    }

    if (typeof partsData === "object") {
      return [partsData as ParsedPart];
    }
  } catch (error) {
    console.error("Error parsing parts data:", error);
  }

  return [];
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

function calculateTotalPartsCost(parts: ParsedPart[]) {
  return parts.reduce((total, part) => {
    const cost = toNumber(part.cost);
    const quantity = toNumber(part.quantity ?? 1);
    return total + cost * quantity;
  }, 0);
}

export function WorkDetailsSummary({ jobId, services }: WorkDetailsSummaryProps) {
  const { toast } = useToast();
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<RawService | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: jobData } = useQuery({
    queryKey: [`/api/jobs/${jobId}`],
    enabled: !!jobId,
  });

  const { data: customersData } = useQuery({
    queryKey: ["/api/customers"],
  });

  const { data: usersData } = useQuery({
    queryKey: ["/api/users"],
  });

  const job = (jobData as any) || null;
  const jobDetails = job as any;
  const customers = Array.isArray(customersData) ? customersData : [];
  const users = Array.isArray(usersData) ? usersData : [];

  const safeServices = useMemo<RawService[]>(() => {
    if (!Array.isArray(services)) {
      return [];
    }
    return services.filter(Boolean) as RawService[];
  }, [services]);

  const latestService = useMemo<RawService | null>(() => {
    if (safeServices.length === 0) {
      return null;
    }

    return (
      [...safeServices]
        .sort(
          (a, b) =>
            new Date(b.performedAt || b.createdAt || "").getTime() -
            new Date(a.performedAt || a.createdAt || "").getTime()
        )[0] ?? null
    );
  }, [safeServices]);

  const latestServiceParts = useMemo(() => {
    if (!latestService) return [];
    return parseParts(latestService.partsUsed);
  }, [latestService]);

  const selectedServiceParts = useMemo(() => {
    if (!selectedService) return [];
    return parseParts(selectedService.partsUsed);
  }, [selectedService]);

  const getCustomerName = (customerId: number) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer ? customer.name : "Unknown Customer";
  };

  const getTechnicianName = (technicianId: number) => {
    const user = users.find((u) => u.id === technicianId);
    return user ? user.fullName : "Unknown Technician";
  };

  const handlePrintService = (service: RawService) => {
    setSelectedService(service);
    setIsPrintDialogOpen(true);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContents = printRef.current.innerHTML;

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
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Service Details - ${jobDetails?.jobId}</title>
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

  return (
    <div className="space-y-4">
      {!latestService ? (
        <div className="text-center py-6 border border-dashed rounded-md">
          <p className="text-neutral-500">No work details available for this job.</p>
        </div>
      ) : (
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
                <p>
                  {hasValue(latestService.laborHours)
                    ? `${toNumber(latestService.laborHours).toFixed(1)} hrs`
                    : "Not specified"}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Cost</h4>
                <p>
                  {hasValue(latestService.cost)
                    ? `£${toNumber(latestService.cost).toFixed(2)}`
                    : "Not specified"}
                </p>
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

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Parts Used</h4>
              {latestServiceParts.length > 0 ? (
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
                      {latestServiceParts.map((part, index) => (
                        <TableRow key={index}>
                          <TableCell>{part.name ?? "Unnamed part"}</TableCell>
                          <TableCell>{hasValue(part.quantity) ? part.quantity : "-"}</TableCell>
                          <TableCell>
                            {hasValue(part.cost) ? `£${toNumber(part.cost).toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell>
                            {hasValue(part.cost) && hasValue(part.quantity)
                              ? `£${(toNumber(part.cost) * toNumber(part.quantity)).toFixed(2)}`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-medium">
                          Total Parts Cost:
                        </TableCell>
                        <TableCell className="font-medium">
                          £{calculateTotalPartsCost(latestServiceParts).toFixed(2)}
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
      )}

      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Print Service Details</DialogTitle>
          </DialogHeader>

          <div ref={printRef}>
            <div className="header">
              <img
                src={logoUrl}
                alt="Moore Horticulture Equipment"
                className="logo mx-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
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
                      <div>{jobDetails.jobId}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Customer:</div>
                      <div>{getCustomerName(jobDetails.customerId)}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Equipment:</div>
                      <div>{jobDetails.equipmentDescription || "Custom Equipment"}</div>
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
                        {selectedService.performedBy
                          ? getTechnicianName(selectedService.performedBy)
                          : "Not assigned"}
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Service Cost:</div>
                      <div>
                        {hasValue(selectedService.cost)
                          ? `£${toNumber(selectedService.cost).toFixed(2)}`
                          : "Not specified"}
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Labour Hours:</div>
                      <div>
                        {hasValue(selectedService.laborHours)
                          ? `${toNumber(selectedService.laborHours).toFixed(1)} hrs`
                          : "Not specified"}
                      </div>
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
                    <div className="details-box">{selectedService.notes}</div>
                  </div>
                )}

                <div className="section">
                  <div className="section-title">Parts Used</div>
                  {selectedServiceParts.length > 0 ? (
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
                        {selectedServiceParts.map((part, index) => (
                          <tr key={index}>
                            <td>{part.name ?? "Unnamed part"}</td>
                            <td>{hasValue(part.quantity) ? part.quantity : "-"}</td>
                            <td>{hasValue(part.cost) ? `£${toNumber(part.cost).toFixed(2)}` : "-"}</td>
                            <td>
                              {hasValue(part.cost) && hasValue(part.quantity)
                                ? `£${(toNumber(part.cost) * toNumber(part.quantity)).toFixed(2)}`
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div>No parts recorded for this service.</div>
                  )}

                  <div className="totals">
                    <div>
                      <strong>Parts Total:</strong> £{calculateTotalPartsCost(selectedServiceParts).toFixed(2)}
                    </div>
                    <div>
                      <strong>Service Cost:</strong>{" "}
                      {hasValue(selectedService.cost)
                        ? `£${toNumber(selectedService.cost).toFixed(2)}`
                        : "Not specified"}
                    </div>
                    <div>
                      <strong>Total Cost:</strong> £
                      {(
                        calculateTotalPartsCost(selectedServiceParts) +
                        (hasValue(selectedService.cost) ? toNumber(selectedService.cost) : 0)
                      ).toFixed(2)}
                    </div>
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
            <Button onClick={handlePrint}>Print</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}