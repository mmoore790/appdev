import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, PageHeaderAction } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { CustomerForm } from "@/components/customer-form";
import { formatPhoneNumber } from "@/lib/utils";

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: customers, isLoading } = useQuery({
    queryKey: [searchQuery ? `/api/customers?search=${searchQuery}` : "/api/customers"],
  });

  const filteredCustomers = customers || [];
  const totalPages = Math.ceil(filteredCustomers.length / pageSize);
  const paginatedCustomers = filteredCustomers.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return (
    <>
      <PageHeader 
        title="Customer Management" 
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-700 hover:bg-green-800">
                <span className="material-icons mr-2 text-sm">add</span>
                New Customer
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="sm:max-w-[600px]"
              onEscapeKeyDown={() => setIsDialogOpen(false)} 
              onPointerDownOutside={() => setIsDialogOpen(false)}
            >
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
                <DialogDescription>
                  Enter the customer details to add them to your database
                </DialogDescription>
              </DialogHeader>
              <CustomerForm onComplete={() => setIsDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
            <CardTitle>Customers</CardTitle>
            <div className="relative w-full sm:w-64">
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-neutral-400 text-sm">
                search
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="py-20 text-center text-neutral-500">
                          Loading customers...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="py-20 text-center text-neutral-500">
                          No customers found.
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.email || "—"}</TableCell>
                        <TableCell>{formatPhoneNumber(customer.phone) || "—"}</TableCell>
                        <TableCell className="truncate max-w-xs">
                          {customer.address || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                className="h-8 px-2 text-green-700"
                              >
                                View
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <CustomerForm 
                                customerId={customer.id} 
                                editMode 
                              />
                            </DialogContent>
                          </Dialog>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                className="h-8 px-2 text-green-700"
                              >
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <CustomerForm 
                                customerId={customer.id} 
                                editMode 
                              />
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex justify-end">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(p => Math.max(1, p - 1))} 
                        className={page === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    <PaginationItem className="text-sm text-neutral-600">
                      Page {page} of {totalPages}
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
