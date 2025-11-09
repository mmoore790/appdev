import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api"; // Update to the correct path of the API client
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CustomerForm } from "@/components/customer-form"; // Correct path
import { Users, Plus, Search } from "lucide-react";

// Define the Customer type based on your schema
type Customer = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
};

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch customers. The queryKey includes 'search' so it refetches when search changes.
  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers", search], // <-- Query key now includes search state
    queryFn: () => api.get(`/api/customers?search=${search}`), // <-- Use new api.get
  });

  const onFormComplete = () => {
    setIsFormOpen(false);
    queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    setSearch(""); // Clear search to show the new customer
  };

  return (
    <div className="container mx-auto py-8">
      <PageHeader
        title="Customers"
        description="View and manage all customers"
        icon={<Users className="h-6 w-6" />}
      />
      
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            {/* --- Search Input --- */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            {/* --- Add Customer Button --- */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-5 w-5 mr-2" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <CustomerForm onComplete={onFormComplete} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // --- Loading Skeletons ---
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : !customers || customers.length === 0 ? (
                // --- No Results ---
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    No customers found.
                  </TableCell>
                </TableRow>
              ) : (
                // --- Customer Data ---
                customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.email || "N/A"}</TableCell>
                    <TableCell>{customer.phone || "N/A"}</TableCell>
                    <TableCell>{customer.address || "N/A"}</TableCell>
                    <TableCell>
                      {/* We can add an edit button here later */}
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}