import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CustomerForm } from "@/components/customer-form";
import { AssetForm } from "@/components/asset-form";
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
import { Users, Plus, Search, MoreVertical, Trash2, Download, Mail, Phone, Package } from "lucide-react";
import { useLocation } from "wouter";

type Customer = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  matchReason?: string | null;
};

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEquipmentDialogOpen, setIsEquipmentDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerForEquipment, setCustomerForEquipment] = useState<number | null>(null);
  const [customerPendingDelete, setCustomerPendingDelete] = useState<Customer | null>(null);
  const [, setLocation] = useLocation();

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
    setIsEquipmentDialogOpen(false);
    setSelectedCustomerId(null);
    setCustomerForEquipment(null);
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

  const handleExportCSV = async () => {
    try {
      const searchTerm = search.trim();
      const url = `/api/customers/export/csv${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ""}`;
      const response = await fetch(url, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to export customers");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `customers-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Export successful",
        description: "Customer data has been exported to CSV.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export customers.",
        variant: "destructive",
      });
    }
  };

  const handleViewCustomer = (customerId: number) => {
    setLocation(`/customers/${customerId}/details`);
  };

  const handleAddEquipment = (customerId: number) => {
    setCustomerForEquipment(customerId);
    setIsEquipmentDialogOpen(true);
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
    <div className="container mx-auto py-2 sm:py-3 px-2 sm:px-3 max-w-[1920px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage all customers and equipment</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleExportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export to CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9">
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <CustomerForm onComplete={handleFormComplete} onCancel={handleCreateCancel} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, make/model, or serial number..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && search) {
                  setSearch("");
                }
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</TableHead>
                  <TableHead className="h-9 px-3 w-[50px] text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  loadingRows.map((_, index) => (
                    <TableRow key={`customer-skeleton-${index}`} className="border-b">
                      <TableCell className="h-10 px-3 py-2">
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="h-10 px-3 py-2">
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell className="h-10 px-3 py-2">
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="h-10 px-3 py-2">
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell className="h-10 px-3 py-2">
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell className="h-10 px-3 py-2 text-right">
                        <Skeleton className="ml-auto h-6 w-6 rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow className="border-b">
                    <TableCell colSpan={6} className="h-20 px-3 py-4 text-center text-sm text-red-600">
                      Failed to load customers. {errorMessage}
                    </TableCell>
                  </TableRow>
                ) : customers.length === 0 ? (
                  <TableRow className="border-b">
                    <TableCell colSpan={6} className="h-20 px-3 py-4 text-center text-sm text-muted-foreground">
                      {isSearching
                        ? "No customers match your search."
                        : "No customers found. Add your first customer to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow 
                      key={customer.id}
                      className="border-b cursor-pointer hover:bg-muted/30 transition-colors group"
                      onClick={() => handleViewCustomer(customer.id)}
                    >
                      <TableCell className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-foreground">{customer.name}</span>
                          {customer.matchReason && (
                            <span className="text-xs text-muted-foreground italic mt-0.5">{customer.matchReason}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="h-10 px-3 py-2">
                        <span className="text-sm text-muted-foreground">{renderInfo(customer.email, "—")}</span>
                      </TableCell>
                      <TableCell className="h-10 px-3 py-2">
                        <span className="text-sm text-muted-foreground">{renderInfo(customer.phone, "—")}</span>
                      </TableCell>
                      <TableCell className="h-10 px-3 py-2 max-w-[200px]" title={customer.address ?? undefined}>
                        <div className="text-sm text-muted-foreground line-clamp-1 truncate">
                          {renderInfo(customer.address, "—")}
                        </div>
                      </TableCell>
                      <TableCell className="h-10 px-3 py-2 max-w-[200px]" title={customer.notes ?? undefined}>
                        <div className="text-sm text-muted-foreground line-clamp-1 truncate">
                          {renderInfo(customer.notes, "—")}
                        </div>
                      </TableCell>
                      <TableCell className="h-10 px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label={`Add equipment for ${customer.name}`}
                            onClick={() => handleAddEquipment(customer.id)}
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                            aria-label={`Delete ${customer.name}`}
                            onClick={() => setCustomerPendingDelete(customer)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-2">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <Card key={`customer-skeleton-mobile-${index}`} className="p-3">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-2/3" />
                </Card>
              ))
            ) : isError ? (
              <Card className="p-4 text-center text-sm text-red-600">
                Failed to load customers. {errorMessage}
              </Card>
            ) : customers.length === 0 ? (
              <Card className="p-4 text-center text-sm text-muted-foreground">
                {isSearching
                  ? "No customers match your search."
                  : "No customers found. Add your first customer to get started."}
              </Card>
            ) : (
              customers.map((customer) => (
                <Card 
                  key={customer.id} 
                  className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleViewCustomer(customer.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex flex-col">
                      <h3 className="font-semibold text-sm text-foreground">{customer.name}</h3>
                      {customer.matchReason && (
                        <span className="text-xs text-muted-foreground italic mt-0.5">{customer.matchReason}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Add equipment for ${customer.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddEquipment(customer.id);
                        }}
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                        aria-label={`Delete ${customer.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomerPendingDelete(customer);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{renderInfo(customer.email, "No email")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{renderInfo(customer.phone, "No phone")}</span>
                    </div>
                  </div>
                </Card>
              ))
            )}
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

      <Dialog open={isEquipmentDialogOpen} onOpenChange={setIsEquipmentDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          {customerForEquipment != null && (
            <AssetForm
              customerId={customerForEquipment}
              onComplete={() => {
                setIsEquipmentDialogOpen(false);
                setCustomerForEquipment(null);
                queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
                queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
              }}
              onCancel={() => {
                setIsEquipmentDialogOpen(false);
                setCustomerForEquipment(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}