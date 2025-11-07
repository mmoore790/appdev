import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { formatDate, formatCurrency } from "../lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Skeleton } from "./ui/skeleton";
import { AlertTriangle, Search } from "lucide-react";

export function ServiceHistoryLookup() {
  const [searchType, setSearchType] = useState("equipment");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  // Fetch data for dropdowns
  const customersQuery = useQuery({
    queryKey: ["/api/customers"],
  });
  const equipmentTypesQuery = useQuery({
    queryKey: ["/api/equipment-types"],
  });
  const equipmentQuery = useQuery({
    queryKey: ["/api/equipment"],
  });
  const jobsQuery = useQuery({
    queryKey: ["/api/jobs"],
  });
  const usersQuery = useQuery({
    queryKey: ["/api/users"],
  });

  const customers = Array.isArray(customersQuery.data) ? customersQuery.data : [];
  const equipmentTypes = Array.isArray(equipmentTypesQuery.data) ? equipmentTypesQuery.data : [];
  const equipment = Array.isArray(equipmentQuery.data) ? equipmentQuery.data : [];
  const jobs = Array.isArray(jobsQuery.data) ? jobsQuery.data : [];
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];

  // Search for services based on selected search type and query
  const idleServicesKey = "service-history/idle";
  const serviceQueryKey =
    searchType === "equipment" && selectedEquipmentId
      ? `/api/services?equipmentId=${selectedEquipmentId}`
      : searchType === "customer" && selectedCustomerId
      ? `/api/jobs?customerId=${selectedCustomerId}`
      : searchType === "job" && selectedJobId
      ? `/api/services?jobId=${selectedJobId}`
      : idleServicesKey;

  const {
    data: rawServices = [],
    isLoading: isServicesLoading,
  } = useQuery({
    queryKey: [serviceQueryKey],
    enabled:
      isSearching &&
      serviceQueryKey !== idleServicesKey &&
      (
        (searchType === "equipment" && !!selectedEquipmentId) ||
        (searchType === "customer" && !!selectedCustomerId) ||
        (searchType === "job" && !!selectedJobId)
      ),
  });
  const services = Array.isArray(rawServices) ? rawServices : [];

  // Fetch services for the customer jobs
  const idleCustomerServicesKey = "service-history/customer-idle";
  const customerServicesQueryKey =
    searchType === "customer" && selectedCustomerId && services.length > 0
      ? `/api/services?jobId=${services[0].id}`
      : idleCustomerServicesKey;

  const {
    data: rawCustomerServices = [],
    isLoading: isCustomerServicesLoading,
  } = useQuery({
    queryKey: [customerServicesQueryKey],
    enabled:
      searchType === "customer" &&
      !!selectedCustomerId &&
      isSearching &&
      services.length > 0 &&
      customerServicesQueryKey !== idleCustomerServicesKey,
  });
  const customerServices = Array.isArray(rawCustomerServices) ? rawCustomerServices : [];

  // Function to handle search
  const handleSearch = () => {
    if (searchType === "equipment") {
      if (!selectedEquipmentId) return;
    } else if (searchType === "customer") {
      if (!selectedCustomerId) return;
    } else if (searchType === "job") {
      if (!selectedJobId) return;
    }
    
    setIsSearching(true);
  };

  // Function to reset search
  const handleReset = () => {
    setSearchQuery("");
    setSelectedEquipmentId(null);
    setSelectedCustomerId(null);
    setSelectedJobId(null);
    setIsSearching(false);
  };

  // Helper function to get mechanic name
  const getMechanicName = (userId: number | null | undefined) => {
    if (!userId) return "Unassigned";
    const user = users?.find(u => u.id === userId);
    return user ? user.fullName : "Unknown";
  };

  // Helper function to get job ID
  const getJobId = (jobId: number) => {
    const job = jobs?.find(j => j.id === jobId);
    return job ? job.jobId : `Job #${jobId}`;
  };

  // Helper function to get equipment details
  const getEquipmentDetails = (equipmentId: number) => {
    const equip = equipment?.find(e => e.id === equipmentId);
    if (!equip) return "Unknown Equipment";
    
    const type = equipmentTypes?.find(t => t.id === equip.typeId);
    if (!type) return `Equipment #${equipmentId}`;
    
    return `${type.name} (${type.brand} ${type.model}) - SN: ${equip.serialNumber}`;
  };

  // Helper function to get customer name
  const getCustomerName = (customerId: number) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer ? customer.name : `Customer #${customerId}`;
  };

  // Determine what content to show based on search type and state
  const renderSearchForm = () => {
    switch (searchType) {
      case "equipment":
        return (
          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <label htmlFor="equipment-select" className="text-sm font-medium text-neutral-700">
                Select Equipment
              </label>
              <Select 
                value={selectedEquipmentId?.toString() || ""} 
                onValueChange={(value) => setSelectedEquipmentId(parseInt(value))}
              >
                <SelectTrigger id="equipment-select" className="w-full">
                  <SelectValue placeholder="Select equipment" />
                </SelectTrigger>
                <SelectContent>
                  {equipment?.map(item => {
                    const type = equipmentTypes?.find(t => t.id === item.typeId);
                    return (
                      <SelectItem key={item.id} value={item.id.toString()}>
                        {type?.name} ({type?.brand} {type?.model}) - SN: {item.serialNumber}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleSearch} 
              className="w-full bg-green-700 hover:bg-green-800"
              disabled={!selectedEquipmentId}
            >
              <Search className="mr-2 h-4 w-4" />
              Search Equipment History
            </Button>
          </div>
        );
      
      case "customer":
        return (
          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <label htmlFor="customer-select" className="text-sm font-medium text-neutral-700">
                Select Customer
              </label>
              <Select 
                value={selectedCustomerId?.toString() || ""} 
                onValueChange={(value) => setSelectedCustomerId(parseInt(value))}
              >
                <SelectTrigger id="customer-select" className="w-full">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map(customer => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleSearch} 
              className="w-full bg-green-700 hover:bg-green-800"
              disabled={!selectedCustomerId}
            >
              <Search className="mr-2 h-4 w-4" />
              Search Customer History
            </Button>
          </div>
        );
      
      case "job":
        return (
          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <label htmlFor="job-select" className="text-sm font-medium text-neutral-700">
                Select Job
              </label>
              <Select 
                value={selectedJobId?.toString() || ""} 
                onValueChange={(value) => setSelectedJobId(parseInt(value))}
              >
                <SelectTrigger id="job-select" className="w-full">
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs?.map(job => (
                    <SelectItem key={job.id} value={job.id.toString()}>
                      {job.jobId} - {job.description.substring(0, 30)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleSearch} 
              className="w-full bg-green-700 hover:bg-green-800"
              disabled={!selectedJobId}
            >
              <Search className="mr-2 h-4 w-4" />
              Search Job History
            </Button>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Render search results
  const renderSearchResults = () => {
    if (!isSearching) return null;
    
    // Equipment search results
    if (searchType === "equipment" && selectedEquipmentId) {
      if (isServicesLoading) {
        return (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-8 w-1/3" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        );
      }
      
      if (!services || services.length === 0) {
        return (
          <Alert className="mt-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No service history found</AlertTitle>
            <AlertDescription>
              No service records were found for this equipment.
            </AlertDescription>
          </Alert>
        );
      }
      
      const serviceHistory = services;
      
      return (
        <div className="mt-6 space-y-4">
          <div className="bg-green-50 p-4 rounded-md">
            <h3 className="text-lg font-medium text-green-800">
              Equipment Information
            </h3>
            <p className="text-sm text-green-700">
              {getEquipmentDetails(selectedEquipmentId)}
            </p>
            <p className="text-sm text-green-700 mt-1">
              Owner: {getCustomerName(equipment?.find(e => e.id === selectedEquipmentId)?.customerId || 0)}
            </p>
          </div>
          
          <h3 className="text-lg font-medium">Service History</h3>
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
                {serviceHistory.map((service) => (
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
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleReset}>
              New Search
            </Button>
          </div>
        </div>
      );
    }
    
    // Customer search results
    if (searchType === "customer" && selectedCustomerId) {
      if (isServicesLoading) {
        return (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-8 w-1/3" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        );
      }
      
      if (!services || services.length === 0) {
        return (
          <Alert className="mt-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No jobs found</AlertTitle>
            <AlertDescription>
              No job records were found for this customer.
            </AlertDescription>
          </Alert>
        );
      }
      
      const customerJobs = services;
      
      return (
        <div className="mt-6 space-y-4">
          <div className="bg-green-50 p-4 rounded-md">
            <h3 className="text-lg font-medium text-green-800">
              Customer Information
            </h3>
            <p className="text-sm text-green-700">
              {getCustomerName(selectedCustomerId)}
            </p>
            <p className="text-sm text-green-700 mt-1">
              Equipment: {equipment?.filter(e => e.customerId === selectedCustomerId).length || 0} registered items
            </p>
          </div>
          
          <h3 className="text-lg font-medium">Job History</h3>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.jobId}</TableCell>
                    <TableCell>{formatDate(job.createdAt)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {getEquipmentDetails(job.equipmentId)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        job.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : job.status === 'in_progress'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {job.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleReset}>
              New Search
            </Button>
          </div>
        </div>
      );
    }
    
    // Job search results
    if (searchType === "job" && selectedJobId) {
      if (isServicesLoading) {
        return (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-8 w-1/3" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        );
      }
      
      if (!services || services.length === 0) {
        return (
          <Alert className="mt-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No service records found</AlertTitle>
            <AlertDescription>
              No service records were found for this job.
            </AlertDescription>
          </Alert>
        );
      }
      
      const jobServices = services;
      const job = jobs?.find(j => j.id === selectedJobId);
      
      return (
        <div className="mt-6 space-y-4">
          <div className="bg-green-50 p-4 rounded-md">
            <h3 className="text-lg font-medium text-green-800">
              Job Information
            </h3>
            <p className="text-sm text-green-700">
              {job?.jobId} - {job?.description}
            </p>
            <p className="text-sm text-green-700 mt-1">
              Customer: {getCustomerName(job?.customerId || 0)}
            </p>
            <p className="text-sm text-green-700 mt-1">
              Equipment: {getEquipmentDetails(job?.equipmentId || 0)}
            </p>
          </div>
          
          <h3 className="text-lg font-medium">Service Records</h3>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>{formatDate(service.performedAt)}</TableCell>
                    <TableCell>{service.serviceType}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {service.details}
                    </TableCell>
                    <TableCell>{getMechanicName(service.performedBy)}</TableCell>
                    <TableCell>{formatCurrency(service.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleReset}>
              New Search
            </Button>
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service History Lookup</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={searchType} onValueChange={setSearchType}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="equipment">By Equipment</TabsTrigger>
            <TabsTrigger value="customer">By Customer</TabsTrigger>
            <TabsTrigger value="job">By Job</TabsTrigger>
          </TabsList>
          <TabsContent value="equipment" className="mt-4">
            {renderSearchForm()}
          </TabsContent>
          <TabsContent value="customer" className="mt-4">
            {renderSearchForm()}
          </TabsContent>
          <TabsContent value="job" className="mt-4">
            {renderSearchForm()}
          </TabsContent>
        </Tabs>

        {renderSearchResults()}
      </CardContent>
    </Card>
  );
}
