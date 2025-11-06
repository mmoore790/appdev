import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, PageHeaderAction } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceHistoryLookup } from "@/components/service-history-lookup";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatDate, formatCurrency } from "@/lib/utils";

export default function ServiceHistory() {
  const [view, setView] = useState("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("all");

  const { data: services, isLoading } = useQuery({
    queryKey: ["/api/services"],
  });

  const { data: equipmentTypes } = useQuery({
    queryKey: ["/api/equipment-types"],
  });

  const { data: jobs } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  // Filter and process services data
  const filteredServices = services?.filter(service => {
    // Match search query against service details and job id
    const matchesSearch = searchQuery.trim() === "" || 
      service.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.serviceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (jobs?.find(j => j.id === service.jobId)?.jobId || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by equipment type if selected
    if (equipmentFilter === "all") return matchesSearch;
    
    // Find the job for this service
    const job = jobs?.find(j => j.id === service.jobId);
    if (!job) return false;
    
    // Find the equipment for this job
    const equipment = job ? job.equipmentId : null;
    
    // Check if equipment type matches the filter
    return equipment && matchesSearch;
  }) || [];

  // Sort services by date, most recent first
  const sortedServices = [...filteredServices].sort((a, b) => 
    new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
  );

  // Get mechanic name from user id
  const getMechanicName = (userId: number | null | undefined) => {
    if (!userId) return "Unassigned";
    const user = users?.find(u => u.id === userId);
    return user ? user.fullName : "Unknown";
  };

  // Get job ID from job record
  const getJobId = (jobId: number) => {
    const job = jobs?.find(j => j.id === jobId);
    return job ? job.jobId : `Job #${jobId}`;
  };

  return (
    <>
      <PageHeader 
        title="Service History" 
        actions={
          <PageHeaderAction variant="outline" icon="file_download">
            Export History
          </PageHeaderAction>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <Tabs defaultValue="lookup" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lookup">Service Lookup</TabsTrigger>
            <TabsTrigger value="history">Service Records</TabsTrigger>
          </TabsList>
          
          <TabsContent value="lookup" className="mt-6">
            <ServiceHistoryLookup />
          </TabsContent>
          
          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                <CardTitle>Service Records</CardTitle>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Input
                    placeholder="Search services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-60"
                  />
                  <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Filter by equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Equipment</SelectItem>
                      {equipmentTypes?.map(type => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={view} onValueChange={setView}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="View" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Recent Services</SelectItem>
                      <SelectItem value="by-type">By Service Type</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Job ID</TableHead>
                        <TableHead>Service Type</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Performed By</TableHead>
                        <TableHead>Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            Loading service records...
                          </TableCell>
                        </TableRow>
                      ) : sortedServices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            No service records found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedServices.map((service) => (
                          <TableRow key={service.id}>
                            <TableCell>{formatDate(service.performedAt)}</TableCell>
                            <TableCell>{getJobId(service.jobId)}</TableCell>
                            <TableCell>{service.serviceType}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {service.details}
                            </TableCell>
                            <TableCell>{getMechanicName(service.performedBy)}</TableCell>
                            <TableCell>{formatCurrency(service.cost)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
