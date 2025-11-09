import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CustomerForm } from "@/components/customer-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Search, MoreVertical, Pencil, Trash2 } from "lucide-react";

type Customer = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
};

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerPendingDelete, setCustomerPendingDelete] = useState<Customer | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const searchTerm = search.trim();

  const { data: customers = [], isLoading, isError, error } = useQuery<Customer[]>({
    queryKey: ["/api/customers", searchTerm],
    queryFn: () =>
      api.get(`/api/customers${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ""}`),
  });

  const closeDialogs = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setSelectedCustomerId(null);
  };

  const handleFormComplete = () => {
    closeDialogs();
    queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
  };

  const handleCreateCancel = () => {
    setIsCreateDialogOpen(false);
  };

  const handleEditCancel = () => {
    setIsEditDialogOpen(false);
    setSelectedCustomerId(null);
  };

  const handleOpenEdit = (customerId: number) => {
    setSelectedCustomerId(customerId);
    setIsEditDialogOpen(true);
  };

  const deleteCustomerMutation = useMutation({
    mutationFn: async (customerId: number) => {
      await apiRequest("DELETE", `/api/customers/${customerId}`);
    },
    onSuccess: (_data, customerId) => {
      if (selectedCustomerId === customerId) {
        closeDialogs();
      }
      toast({
        title: "Customer deleted",
        description: "The customer has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to delete customer.";
      toast({
        title: "Failed to delete customer",
        description: message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setCustomerPendingDelete(null);
    },
  });

  const confirmDelete = () => {
    if (!customerPendingDelete) return;
    deleteCustomerMutation.mutate(customerPendingDelete.id);
  };

  const renderInfo = (value?: string | null, fallback: string = "Not provided") => {
    if (!value) {
      return <span className="text-muted-foreground italic">{fallback}</span>;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return <span className="text-muted-foreground italic">{fallback}</span>;
    }
    return trimmed;
  };

  const isSearching = searchTerm.length > 0;
  const errorMessage = error instanceof Error ? error.message : "Something went wrong.";
  const loadingRows = Array.from({ length: 5 });

  return (
    <div className="container mx-auto py-8">
      <PageHeader
        title="Customers"
        description="View and manage all customers"
        icon={<Users className="h-6 w-6" />}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                className="pl-10"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && search) {
                    setSearch("");
                  }
                }}
              />
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="mr-2 h-5 w-5" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <CustomerForm onComplete={handleFormComplete} onCancel={handleCreateCancel} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[60px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  loadingRows.map((_, index) => (
                    <TableRow key={`customer-skeleton-${index}`}>
                      <TableCell>
                        <Skeleton className="h-5 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-64" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-40" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-8 w-8 rounded-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-red-600">
                      Failed to load customers. {errorMessage}
                    </TableCell>
                  </TableRow>
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      {isSearching
                        ? "No customers match your search."
                        : "No customers found. Add your first customer to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{renderInfo(customer.email, "No email")}</TableCell>
                      <TableCell>{renderInfo(customer.phone, "No phone number")}</TableCell>
                      <TableCell className="max-w-sm" title={customer.address ?? undefined}>
                        <div className="line-clamp-2">
                          {renderInfo(customer.address, "No address")}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-sm" title={customer.notes ?? undefined}>
                        <div className="line-clamp-2">
                          {renderInfo(customer.notes, "No notes")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Customer actions for ${customer.name}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => handleOpenEdit(customer.id)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => setCustomerPendingDelete(customer)}
                              className="text-red-600 focus:bg-red-50 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsEditDialogOpen(false);
            setSelectedCustomerId(null);
          } else {
            setIsEditDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          {selectedCustomerId != null ? (
            <CustomerForm
              key={selectedCustomerId}
              customerId={selectedCustomerId}
              editMode
              onComplete={handleFormComplete}
              onCancel={handleEditCancel}
            />
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Select a customer to edit.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={customerPendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !deleteCustomerMutation.isPending) {
            setCustomerPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently remove{" "}
              <strong>{customerPendingDelete?.name}</strong> and their details from the system.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCustomerMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
              disabled={deleteCustomerMutation.isPending}
            >
              {deleteCustomerMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}