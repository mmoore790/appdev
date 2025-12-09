import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Button } from "./ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { useToast } from "../hooks/use-toast";
import { formatDate } from "../lib/utils";
import { Plus, Clock, Package, FileText, Image as ImageIcon, Trash2, Edit2, Upload, Printer, X, Check } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { PrintJobSheet } from "./print-job-sheet";
import { Separator } from "./ui/separator";

// Schemas
const labourEntrySchema = z.object({
  technicianId: z.string().min(1, "Technician is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  timeSpent: z.string().min(1, "Time spent is required"),
});

const partUsedSchema = z.object({
  partName: z.string().min(1, "Part name is required"),
  sku: z.string().optional(),
  quantity: z.string().min(1, "Quantity is required"),
  costExcludingVat: z.string().optional(),
  costIncludingVat: z.string().optional(),
  notes: z.string().optional(),
});

interface JobSheetProps {
  jobId: number;
  readOnly?: boolean;
  onWorkAdded?: () => void;
}

interface Job {
  id: number;
  jobId: string;
  customerId?: number | null;
  equipmentId?: number | null;
  assignedTo?: number | null;
  status: string;
  description: string;
  equipmentDescription?: string | null;
  customerName?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

interface User {
  id: number;
  fullName: string;
}

interface Business {
  id: number;
  name: string;
  hourlyLabourFee?: number | null;
}

interface LabourEntry {
  id: number;
  technicianId: number;
  description: string;
  timeSpent: number;
  costExcludingVat?: number | null;
  costIncludingVat?: number | null;
  cost?: number | null;
  createdAt?: string;
}

interface PartUsed {
  id: number;
  partName: string;
  sku?: string | null;
  quantity: number;
  costExcludingVat?: number | null;
  costIncludingVat?: number | null;
  cost?: number | null;
  notes?: string | null;
}

interface JobNote {
  id?: number;
  workSummary?: string | null;
  internalNotes?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
}

export function JobSheet({ jobId, readOnly = false, onWorkAdded }: JobSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for forms
  const [isAddingLabour, setIsAddingLabour] = useState(false);
  const [isAddingPart, setIsAddingPart] = useState(false);
  const [editingLabourId, setEditingLabourId] = useState<number | null>(null);
  const [editingPartId, setEditingPartId] = useState<number | null>(null);
  const [deletingLabourId, setDeletingLabourId] = useState<number | null>(null);
  const [deletingPartId, setDeletingPartId] = useState<number | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Get job data
  const { data: job } = useQuery<Job>({
    queryKey: [`/api/jobs/${jobId}`],
    enabled: !!jobId,
  });

  // Get users for technician dropdown
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Get business data for hourly labour fee
  const { data: business } = useQuery<Business>({
    queryKey: ["/api/business/me"],
  });

  // Get labour entries
  const { data: labourEntriesData = [], isLoading: labourLoading } = useQuery<LabourEntry[]>({
    queryKey: [`/api/job-sheet/${jobId}/labour`],
    enabled: !!jobId,
  });

  // Get parts used
  const { data: partsUsedData = [], isLoading: partsLoading } = useQuery<PartUsed[]>({
    queryKey: [`/api/job-sheet/${jobId}/parts`],
    enabled: !!jobId,
  });

  // Ensure arrays are always arrays
  const labourEntries = useMemo(
    () => (Array.isArray(labourEntriesData) ? labourEntriesData : []),
    [labourEntriesData],
  );

  const partsUsed = useMemo(
    () => (Array.isArray(partsUsedData) ? partsUsedData : []),
    [partsUsedData],
  );

  // Get job notes
  const { data: jobNote } = useQuery<JobNote>({
    queryKey: [`/api/job-sheet/${jobId}/notes`],
    enabled: !!jobId,
  });

  // Get attachments
  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery<Array<{
    id: number;
    fileName: string;
    fileUrl: string;
    fileType?: string;
  }>>({
    queryKey: [`/api/job-sheet/${jobId}/attachments`],
    enabled: !!jobId,
  });

  // Forms
  const labourForm = useForm<z.infer<typeof labourEntrySchema>>({
    resolver: zodResolver(labourEntrySchema),
    defaultValues: {
      technicianId: "",
      description: "",
      timeSpent: "",
    },
  });

  const partForm = useForm<z.infer<typeof partUsedSchema>>({
    resolver: zodResolver(partUsedSchema),
    defaultValues: {
      partName: "",
      sku: "",
      quantity: "1",
      costExcludingVat: "",
      costIncludingVat: "",
      notes: "",
    },
  });

  // UK VAT rate (20%)
  const VAT_RATE = 0.20;

  // Helper function to calculate including VAT from excluding VAT
  const calculateIncludingVat = (excludingVat: number): number => {
    return excludingVat * (1 + VAT_RATE);
  };

  // Helper function to calculate excluding VAT from including VAT
  const calculateExcludingVat = (includingVat: number): number => {
    return includingVat / (1 + VAT_RATE);
  };

  const notesForm = useForm({
    defaultValues: {
      workSummary: "",
      internalNotes: "",
    },
  });

  // Update notes form when jobNote changes
  useEffect(() => {
    if (jobNote) {
      notesForm.reset({
        workSummary: jobNote.workSummary || "",
        internalNotes: jobNote.internalNotes || "",
      });
    }
  }, [jobNote, notesForm]);

  // Mutations
  const createLabourMutation = useMutation({
    mutationFn: async (data: z.infer<typeof labourEntrySchema>) => {
      const hours = parseFloat(data.timeSpent);
      const hourlyRate = business?.hourlyLabourFee ? business.hourlyLabourFee / 100 : null; // Convert from pence to pounds
      const costExcludingVat = hourlyRate && hours > 0 ? hours * hourlyRate : null;
      const costIncludingVat = costExcludingVat ? calculateIncludingVat(costExcludingVat) : null;
      
      return apiRequest("POST", `/api/job-sheet/${jobId}/labour`, {
        ...data,
        technicianId: parseInt(data.technicianId),
        timeSpent: hours * 60, // Convert to minutes
        cost: costExcludingVat || null, // Legacy field (backend will convert to pence)
        costExcludingVat: costExcludingVat || null, // Backend will convert to pence
        costIncludingVat: costIncludingVat || null, // Backend will convert to pence
      });
    },
    onSuccess: () => {
      toast({ title: "Labour entry added", description: "Labour entry has been successfully recorded." });
      labourForm.reset();
      setIsAddingLabour(false);
      queryClient.invalidateQueries({ queryKey: [`/api/job-sheet/${jobId}/labour`] });
      if (onWorkAdded) onWorkAdded();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add labour entry", variant: "destructive" });
    },
  });

  const updateLabourMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof labourEntrySchema> }) => {
      const hours = parseFloat(data.timeSpent);
      const hourlyRate = business?.hourlyLabourFee ? business.hourlyLabourFee / 100 : null; // Convert from pence to pounds
      const costExcludingVat = hourlyRate && hours > 0 ? hours * hourlyRate : null;
      const costIncludingVat = costExcludingVat ? calculateIncludingVat(costExcludingVat) : null;
      
      return apiRequest("PUT", `/api/job-sheet/labour/${id}`, {
        ...data,
        technicianId: parseInt(data.technicianId),
        timeSpent: hours * 60, // Convert to minutes
        cost: costExcludingVat || null, // Legacy field (backend will convert to pence)
        costExcludingVat: costExcludingVat || null, // Backend will convert to pence
        costIncludingVat: costIncludingVat || null, // Backend will convert to pence
      });
    },
    onSuccess: () => {
      toast({ title: "Labour entry updated", description: "Labour entry has been successfully updated." });
      setEditingLabourId(null);
      labourForm.reset();
      queryClient.invalidateQueries({ queryKey: [`/api/job-sheet/${jobId}/labour`] });
      if (onWorkAdded) onWorkAdded();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update labour entry", variant: "destructive" });
    },
  });

  const deleteLabourMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/job-sheet/labour/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Labour entry deleted", description: "Labour entry has been successfully deleted." });
      setDeletingLabourId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/job-sheet/${jobId}/labour`] });
      if (onWorkAdded) onWorkAdded();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete labour entry", variant: "destructive" });
    },
  });

  const createPartMutation = useMutation({
    mutationFn: async (data: z.infer<typeof partUsedSchema>) => {
      // Calculate VAT fields - user can enter either excluding or including VAT
      let costExcludingVat: number | null = null;
      let costIncludingVat: number | null = null;
      
      if (data.costExcludingVat && data.costExcludingVat !== "") {
        const excluding = parseFloat(data.costExcludingVat);
        if (!isNaN(excluding) && excluding >= 0) {
          costExcludingVat = excluding;
          costIncludingVat = calculateIncludingVat(excluding);
        }
      } else if (data.costIncludingVat && data.costIncludingVat !== "") {
        const including = parseFloat(data.costIncludingVat);
        if (!isNaN(including) && including >= 0) {
          costIncludingVat = including;
          costExcludingVat = calculateExcludingVat(including);
        }
      }
      
      return apiRequest("POST", `/api/job-sheet/${jobId}/parts`, {
        ...data,
        quantity: parseInt(data.quantity),
        cost: costExcludingVat || null, // Legacy field (backend will convert to pence)
        costExcludingVat: costExcludingVat || null, // Backend will convert to pence
        costIncludingVat: costIncludingVat || null, // Backend will convert to pence
      });
    },
    onSuccess: () => {
      toast({ title: "Part added", description: "Part has been successfully recorded." });
      partForm.reset();
      setIsAddingPart(false);
      queryClient.invalidateQueries({ queryKey: [`/api/job-sheet/${jobId}/parts`] });
      if (onWorkAdded) onWorkAdded();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add part", variant: "destructive" });
    },
  });

  const updatePartMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof partUsedSchema> }) => {
      // Calculate VAT fields - user can enter either excluding or including VAT
      let costExcludingVat: number | null = null;
      let costIncludingVat: number | null = null;
      
      if (data.costExcludingVat && data.costExcludingVat !== "") {
        const excluding = parseFloat(data.costExcludingVat);
        if (!isNaN(excluding) && excluding >= 0) {
          costExcludingVat = excluding;
          costIncludingVat = calculateIncludingVat(excluding);
        }
      } else if (data.costIncludingVat && data.costIncludingVat !== "") {
        const including = parseFloat(data.costIncludingVat);
        if (!isNaN(including) && including >= 0) {
          costIncludingVat = including;
          costExcludingVat = calculateExcludingVat(including);
        }
      }
      
      return apiRequest("PUT", `/api/job-sheet/parts/${id}`, {
        ...data,
        quantity: parseInt(data.quantity),
        cost: costExcludingVat || null, // Legacy field (backend will convert to pence)
        costExcludingVat: costExcludingVat || null, // Backend will convert to pence
        costIncludingVat: costIncludingVat || null, // Backend will convert to pence
      });
    },
    onSuccess: () => {
      toast({ title: "Part updated", description: "Part has been successfully updated." });
      setEditingPartId(null);
      partForm.reset();
      queryClient.invalidateQueries({ queryKey: [`/api/job-sheet/${jobId}/parts`] });
      if (onWorkAdded) onWorkAdded();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update part", variant: "destructive" });
    },
  });

  const deletePartMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/job-sheet/parts/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Part deleted", description: "Part has been successfully deleted." });
      setDeletingPartId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/job-sheet/${jobId}/parts`] });
      if (onWorkAdded) onWorkAdded();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete part", variant: "destructive" });
    },
  });

  const saveNotesMutation = useMutation({
    mutationFn: async (data: { workSummary?: string; internalNotes?: string }) => {
      return apiRequest("POST", `/api/job-sheet/${jobId}/notes`, data);
    },
    onSuccess: () => {
      toast({ title: "Notes saved", description: "Job notes have been successfully saved." });
      queryClient.invalidateQueries({ queryKey: [`/api/job-sheet/${jobId}/notes`] });
      if (onWorkAdded) onWorkAdded();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save notes", variant: "destructive" });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/job-sheet/attachments/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Attachment deleted", description: "Attachment has been successfully deleted." });
      queryClient.invalidateQueries({ queryKey: [`/api/job-sheet/${jobId}/attachments`] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete attachment", variant: "destructive" });
    },
  });

  // Handlers
  const handleAddLabour = () => {
    setIsAddingLabour(true);
    setEditingLabourId(null);
    labourForm.reset();
  };

  const handleEditLabour = (entry: any) => {
    setEditingLabourId(entry.id);
    setIsAddingLabour(false);
    labourForm.reset({
      technicianId: entry.technicianId?.toString() || "",
      description: entry.description || "",
      timeSpent: (entry.timeSpent / 60).toString(),
    });
  };

  const handleCancelLabour = () => {
    setIsAddingLabour(false);
    setEditingLabourId(null);
    labourForm.reset();
  };

  const onSubmitLabour = (data: z.infer<typeof labourEntrySchema>) => {
    if (!business?.hourlyLabourFee) {
      toast({
        title: "Hourly Rate Not Set",
        description: "Please set an hourly labour rate in company settings before adding labour entries.",
        variant: "destructive",
      });
      return;
    }
    
    if (editingLabourId) {
      updateLabourMutation.mutate({ id: editingLabourId, data });
    } else {
      createLabourMutation.mutate(data);
    }
  };

  const handleAddPart = () => {
    setIsAddingPart(true);
    setEditingPartId(null);
    partForm.reset();
  };

  const handleEditPart = (part: any) => {
    setEditingPartId(part.id);
    setIsAddingPart(false);
    // Use costExcludingVat if available, otherwise fall back to cost, otherwise calculate from costIncludingVat
    const excludingVat = part.costExcludingVat ? (part.costExcludingVat / 100).toString() : 
                         (part.cost ? (part.cost / 100).toString() : "");
    const includingVat = part.costIncludingVat ? (part.costIncludingVat / 100).toString() : 
                         (excludingVat ? calculateIncludingVat(parseFloat(excludingVat)).toFixed(2) : "");
    
    partForm.reset({
      partName: part.partName || "",
      sku: part.sku || "",
      quantity: part.quantity?.toString() || "1",
      costExcludingVat: excludingVat,
      costIncludingVat: includingVat,
      notes: part.notes || "",
    });
  };

  const handleCancelPart = () => {
    setIsAddingPart(false);
    setEditingPartId(null);
    partForm.reset();
  };

  const onSubmitPart = (data: z.infer<typeof partUsedSchema>) => {
    if (editingPartId) {
      updatePartMutation.mutate({ id: editingPartId, data });
    } else {
      createPartMutation.mutate(data);
    }
  };

  const handleSaveNotes = () => {
    const data = notesForm.getValues();
    saveNotesMutation.mutate({
      workSummary: data.workSummary || undefined,
      internalNotes: data.internalNotes || undefined,
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const fileUrl = URL.createObjectURL(file);
      const userResponse = await apiRequest<{ id: number }>("GET", "/api/user");
      const uploadedBy = userResponse?.id || 1;

      await apiRequest("POST", `/api/job-sheet/${jobId}/attachments`, {
        fileName: file.name,
        fileUrl: fileUrl,
        fileType: file.type,
        fileSize: file.size,
        uploadedBy: uploadedBy,
      });

      toast({ title: "File uploaded", description: "File has been successfully uploaded." });
      queryClient.invalidateQueries({ queryKey: [`/api/job-sheet/${jobId}/attachments`] });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Failed to upload file", variant: "destructive" });
    } finally {
      setUploadingFile(false);
      event.target.value = "";
    }
  };

  // Calculations
  const totalLabourTime = labourEntries.reduce((total: number, entry: LabourEntry) => total + (entry.timeSpent || 0), 0) / 60;
  const totalPartsUsed = partsUsed.length;
  const lastUpdateTime = jobNote?.updatedAt || jobNote?.createdAt || job?.updatedAt;
  
  // Calculate labour charge: total hours * hourly rate (excluding VAT)
  const hourlyRate = business?.hourlyLabourFee ? business.hourlyLabourFee / 100 : null; // Convert from pence to pounds
  const labourChargeExcludingVat = hourlyRate && totalLabourTime > 0 ? totalLabourTime * hourlyRate : null;
  const labourChargeIncludingVat = labourChargeExcludingVat ? calculateIncludingVat(labourChargeExcludingVat) : null;

  // Calculate total costs from labour entries (use stored values if available, otherwise calculate)
  const totalLabourExcludingVat = labourEntries.reduce((total: number, entry: LabourEntry) => {
    const costExcludingVat = entry.costExcludingVat ? entry.costExcludingVat / 100 : 
                             (entry.cost ? entry.cost / 100 : 
                              (hourlyRate && entry.timeSpent ? (entry.timeSpent / 60) * hourlyRate : 0));
    return total + costExcludingVat;
  }, 0);

  const totalLabourIncludingVat = labourEntries.reduce((total: number, entry: LabourEntry) => {
    const costIncludingVat = entry.costIncludingVat ? entry.costIncludingVat / 100 :
                             (entry.costExcludingVat ? calculateIncludingVat(entry.costExcludingVat / 100) :
                              (entry.cost ? calculateIncludingVat(entry.cost / 100) :
                               (hourlyRate && entry.timeSpent ? calculateIncludingVat((entry.timeSpent / 60) * hourlyRate) : 0)));
    return total + costIncludingVat;
  }, 0);

  // Calculate total costs from parts used
  const totalPartsExcludingVat = partsUsed.reduce((total: number, part: PartUsed) => {
    const costExcludingVat = part.costExcludingVat ? part.costExcludingVat / 100 : 
                             (part.cost ? part.cost / 100 : 0);
    return total + costExcludingVat;
  }, 0);

  const totalPartsIncludingVat = partsUsed.reduce((total: number, part: PartUsed) => {
    const costIncludingVat = part.costIncludingVat ? part.costIncludingVat / 100 :
                             (part.costExcludingVat ? calculateIncludingVat(part.costExcludingVat / 100) :
                              (part.cost ? calculateIncludingVat(part.cost / 100) : 0));
    return total + costIncludingVat;
  }, 0);

  // Calculate grand totals
  const grandTotalExcludingVat = totalLabourExcludingVat + totalPartsExcludingVat;
  const grandTotalIncludingVat = totalLabourIncludingVat + totalPartsIncludingVat;

  const getUserName = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    return user ? user.fullName : "Unknown";
  };

  const getAssignedTechnicianName = () => {
    if (!job?.assignedTo) return "Unassigned";
    return getUserName(job.assignedTo);
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header with Print Button */}
      <div className="flex justify-between items-start px-6 pt-6 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Job Sheet</h2>
          <p className="text-sm text-gray-500">Work Completed Report</p>
          {lastUpdateTime && (
            <p className="text-xs text-gray-400 mt-1">Last updated: {formatDate(lastUpdateTime)}</p>
          )}
        </div>
        <PrintJobSheet jobId={jobId} />
      </div>

      {/* Document Header */}
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500 font-medium">Job ID:</span>
            <span className="ml-2 text-gray-900">{job?.jobId || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Customer:</span>
            <span className="ml-2 text-gray-900">{job?.customerName || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Equipment:</span>
            <span className="ml-2 text-gray-900">{job?.equipmentDescription || job?.description || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Created:</span>
            <span className="ml-2 text-gray-900">{job?.createdAt ? formatDate(job.createdAt) : "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Assigned To:</span>
            <span className="ml-2 text-gray-900">{getAssignedTechnicianName()}</span>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Status:</span>
            <span className="ml-2 text-gray-900">{job?.status ? formatStatus(job.status) : "—"}</span>
          </div>
        </div>
      </div>

      {/* Summary Ribbon */}
      <div className="px-6 py-3 bg-blue-50/50 border-b border-gray-200">
        <div className="flex items-center gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-gray-600">Total Labour:</span>
            <span className="font-semibold text-gray-900">{totalLabourTime.toFixed(2)}h</span>
          </div>
          {labourChargeExcludingVat !== null && labourChargeIncludingVat !== null && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Labour Charge (Ex VAT):</span>
                <span className="font-semibold text-gray-900">£{labourChargeExcludingVat.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Labour Charge (Inc VAT):</span>
                <span className="font-semibold text-gray-900">£{labourChargeIncludingVat.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-gray-600">Items/Parts Used:</span>
            <span className="font-semibold text-gray-900">{totalPartsUsed}</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-gray-600">Attachments:</span>
            <span className="font-semibold text-gray-900">{attachments.length}</span>
          </div>
        </div>
      </div>

      {/* Document Body */}
      <div className="px-6 py-6 space-y-6">
        {/* Labour Section */}
        <div className="bg-blue-50/30 rounded-lg border border-blue-200/50 overflow-hidden">
          <div className="bg-blue-600 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-white" />
              <h3 className="text-lg font-semibold text-white">Labour Performed</h3>
            </div>
            {!readOnly && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddLabour}
                className="h-8 text-xs bg-white/20 hover:bg-white/30 text-white border-white/30"
                disabled={isAddingLabour || editingLabourId !== null}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Labour Entry
              </Button>
            )}
          </div>
          <div className="px-5 py-4">

          {(isAddingLabour || editingLabourId !== null) && !readOnly && (
            <div className="mb-4 p-5 bg-blue-50/50 border-2 border-blue-200 rounded-lg shadow-sm">
              {!business?.hourlyLabourFee && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-600 font-semibold">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800">Hourly Labour Rate Not Set</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Please set an hourly labour rate in company settings to automatically calculate labour costs.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {business?.hourlyLabourFee && (
                <div className="mb-4 p-2 bg-blue-100/50 border border-blue-200 rounded-md">
                  <p className="text-xs text-blue-700">
                    <span className="font-medium">Hourly Rate (Ex VAT):</span> £{(business.hourlyLabourFee / 100).toFixed(2)}/hour
                    {labourForm.watch("timeSpent") && parseFloat(labourForm.watch("timeSpent")) > 0 && (
                      <>
                        <span className="ml-2">
                          • <span className="font-medium">Cost (Ex VAT):</span> £{((parseFloat(labourForm.watch("timeSpent")) || 0) * (business.hourlyLabourFee / 100)).toFixed(2)}
                        </span>
                        <span className="ml-2">
                          • <span className="font-medium">Cost (Inc VAT):</span> £{calculateIncludingVat((parseFloat(labourForm.watch("timeSpent")) || 0) * (business.hourlyLabourFee / 100)).toFixed(2)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              )}
              <Form {...labourForm}>
                <form onSubmit={labourForm.handleSubmit(onSubmitLabour)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={labourForm.control}
                      name="technicianId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Technician*</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="Select technician" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Array.isArray(users) &&
                                users.map((user) => (
                                  <SelectItem key={user.id} value={user.id.toString()}>
                                    {user.fullName}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={labourForm.control}
                      name="timeSpent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Time (hours)*</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.25" min="0" placeholder="e.g. 2.5" className="h-10" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={labourForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">Description of Work*</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe the work performed..." rows={3} className="resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2 justify-end pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleCancelLabour}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      size="sm" 
                      disabled={createLabourMutation.isPending || updateLabourMutation.isPending || !business?.hourlyLabourFee}
                    >
                      {editingLabourId ? "Update Entry" : "Add Entry"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {labourLoading ? (
            <div className="text-sm text-gray-500 py-4 text-center">Loading labour entries...</div>
          ) : labourEntries.length === 0 ? (
            <div className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/30">
              — No labour recorded —
            </div>
          ) : (
            <div className="space-y-0 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
              {labourEntries.map((entry, index: number) => (
                <div key={entry.id} className="px-4 py-4 hover:bg-gray-50/50 transition-colors">
                  {editingLabourId === entry.id ? (
                    <div className="p-4 bg-blue-50/50 border-2 border-blue-200 rounded-lg">
                      {!business?.hourlyLabourFee && (
                        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-xs text-yellow-700">
                            <span className="font-medium">⚠️ Warning:</span> Hourly labour rate not set. Cost will not be calculated.
                          </p>
                        </div>
                      )}
                      {business?.hourlyLabourFee && (
                        <div className="mb-3 p-2 bg-blue-100/50 border border-blue-200 rounded-md">
                          <p className="text-xs text-blue-700">
                            <span className="font-medium">Hourly Rate (Ex VAT):</span> £{(business.hourlyLabourFee / 100).toFixed(2)}/hour
                            {labourForm.watch("timeSpent") && parseFloat(labourForm.watch("timeSpent")) > 0 && (
                              <>
                                <span className="ml-2">
                                  • <span className="font-medium">Cost (Ex VAT):</span> £{((parseFloat(labourForm.watch("timeSpent")) || 0) * (business.hourlyLabourFee / 100)).toFixed(2)}
                                </span>
                                <span className="ml-2">
                                  • <span className="font-medium">Cost (Inc VAT):</span> £{calculateIncludingVat((parseFloat(labourForm.watch("timeSpent")) || 0) * (business.hourlyLabourFee / 100)).toFixed(2)}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      )}
                      <Form {...labourForm}>
                        <form onSubmit={labourForm.handleSubmit(onSubmitLabour)} className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <FormField
                              control={labourForm.control}
                              name="technicianId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium">Technician*</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-9">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {Array.isArray(users) &&
                                        users.map((user) => (
                                          <SelectItem key={user.id} value={user.id.toString()}>
                                            {user.fullName}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={labourForm.control}
                              name="timeSpent"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium">Time (hours)*</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.25" min="0" className="h-9" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={labourForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Description*</FormLabel>
                                <FormControl>
                                  <Textarea rows={2} className="resize-none" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex gap-2 justify-end pt-2">
                            <Button type="button" variant="outline" size="sm" onClick={handleCancelLabour}>Cancel</Button>
                            <Button 
                              type="submit" 
                              size="sm"
                              disabled={!business?.hourlyLabourFee}
                            >
                              Update
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </div>
                  ) : (
                    <div className="group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Description - Most prominent */}
                          <p className="text-sm font-medium text-gray-900 mb-2 leading-relaxed">{entry.description}</p>
                          
                          {/* Metadata row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-500">Technician:</span>
                              <span className="text-gray-900">{getUserName(entry.technicianId)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span className="font-medium text-gray-500">Time:</span>
                              <span className="text-gray-900 font-semibold">{(entry.timeSpent / 60).toFixed(2)}h</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-500">Date:</span>
                              <span className="text-gray-900">{formatDate(entry.createdAt)}</span>
                            </div>
                            {(() => {
                              const hours = entry.timeSpent / 60;
                              const hourlyRate = business?.hourlyLabourFee ? business.hourlyLabourFee / 100 : null;
                              // Use stored values if available, otherwise calculate
                              const costExcludingVat = entry.costExcludingVat ? entry.costExcludingVat / 100 : 
                                                       (hourlyRate && hours > 0 ? hours * hourlyRate : null);
                              const costIncludingVat = entry.costIncludingVat ? entry.costIncludingVat / 100 :
                                                       (costExcludingVat ? calculateIncludingVat(costExcludingVat) : null);
                              
                              if (costExcludingVat && costIncludingVat) {
                                return (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-medium text-gray-500">Cost (Ex VAT):</span>
                                      <span className="text-gray-900 font-semibold">£{costExcludingVat.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-medium text-gray-500">Cost (Inc VAT):</span>
                                      <span className="text-gray-900 font-semibold">£{costIncludingVat.toFixed(2)}</span>
                                    </div>
                                  </>
                                );
                              } else if (hours > 0) {
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-yellow-600 text-xs italic">(No hourly rate set)</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                        {!readOnly && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditLabour(entry)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeletingLabourId(entry.id)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Parts Used Section */}
        <div className="bg-green-50/30 rounded-lg border border-green-200/50 overflow-hidden">
          <div className="bg-green-600 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-white" />
              <h3 className="text-lg font-semibold text-white">Items/Parts Used</h3>
            </div>
            {!readOnly && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddPart}
                className="h-8 text-xs bg-white/20 hover:bg-white/30 text-white border-white/30"
                disabled={isAddingPart || editingPartId !== null}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Item/Part
              </Button>
            )}
          </div>
          <div className="px-5 py-4">

          {(isAddingPart || editingPartId !== null) && !readOnly && (
            <div className="mb-4 p-5 bg-green-50/50 border-2 border-green-200 rounded-lg shadow-sm">
              <Form {...partForm}>
                <form onSubmit={partForm.handleSubmit(onSubmitPart)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={partForm.control}
                      name="partName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Part Name*</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Oil Filter" className="h-10" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={partForm.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">SKU</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" className="h-10" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={partForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Quantity*</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" placeholder="1" className="h-10" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={partForm.control}
                      name="costExcludingVat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Cost (Ex VAT) (£)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              min="0" 
                              placeholder="e.g. 50.00" 
                              className="h-10" 
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                const value = e.target.value;
                                if (value && value !== "" && !isNaN(parseFloat(value))) {
                                  const excluding = parseFloat(value);
                                  const including = calculateIncludingVat(excluding);
                                  partForm.setValue("costIncludingVat", including.toFixed(2));
                                } else {
                                  partForm.setValue("costIncludingVat", "");
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={partForm.control}
                      name="costIncludingVat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Cost (Inc VAT) (£)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              min="0" 
                              placeholder="e.g. 60.00" 
                              className="h-10" 
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                const value = e.target.value;
                                if (value && value !== "" && !isNaN(parseFloat(value))) {
                                  const including = parseFloat(value);
                                  const excluding = calculateExcludingVat(including);
                                  partForm.setValue("costExcludingVat", excluding.toFixed(2));
                                } else {
                                  partForm.setValue("costExcludingVat", "");
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={partForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Optional notes..." rows={2} className="resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2 justify-end pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleCancelPart}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={createPartMutation.isPending || updatePartMutation.isPending}>
                      {editingPartId ? "Update Item/Part" : "Add Item/Part"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {partsLoading ? (
            <div className="text-sm text-gray-500 py-4 text-center">Loading parts...</div>
          ) : partsUsed.length === 0 ? (
            <div className="text-sm text-gray-400 py-6 text-center border border-dashed border-green-200 rounded-lg bg-green-50/20">
              — No parts recorded —
            </div>
          ) : (
            <div className="space-y-0 border border-green-200 rounded-lg divide-y divide-green-100 overflow-hidden">
              {partsUsed.map((part) => (
                <div key={part.id} className="px-4 py-4 hover:bg-green-50/30 transition-colors">
                  {editingPartId === part.id ? (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <Form {...partForm}>
                        <form onSubmit={partForm.handleSubmit(onSubmitPart)} className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <FormField
                              control={partForm.control}
                              name="partName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Part Name*</FormLabel>
                                  <FormControl>
                                    <Input className="h-9" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={partForm.control}
                              name="sku"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">SKU</FormLabel>
                                  <FormControl>
                                    <Input className="h-9" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <FormField
                              control={partForm.control}
                              name="quantity"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium">Quantity*</FormLabel>
                                  <FormControl>
                                    <Input type="number" min="1" className="h-9" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={partForm.control}
                              name="costExcludingVat"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium">Cost (Ex VAT) (£)</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      min="0" 
                                      className="h-9" 
                                      {...field}
                                      onChange={(e) => {
                                        field.onChange(e);
                                        const value = e.target.value;
                                        if (value && value !== "" && !isNaN(parseFloat(value))) {
                                          const excluding = parseFloat(value);
                                          const including = calculateIncludingVat(excluding);
                                          partForm.setValue("costIncludingVat", including.toFixed(2));
                                        } else {
                                          partForm.setValue("costIncludingVat", "");
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={partForm.control}
                              name="costIncludingVat"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium">Cost (Inc VAT) (£)</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      min="0" 
                                      className="h-9" 
                                      {...field}
                                      onChange={(e) => {
                                        field.onChange(e);
                                        const value = e.target.value;
                                        if (value && value !== "" && !isNaN(parseFloat(value))) {
                                          const including = parseFloat(value);
                                          const excluding = calculateExcludingVat(including);
                                          partForm.setValue("costExcludingVat", excluding.toFixed(2));
                                        } else {
                                          partForm.setValue("costExcludingVat", "");
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={partForm.control}
                            name="notes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Notes</FormLabel>
                                <FormControl>
                                  <Textarea rows={2} className="resize-none" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex gap-2 justify-end">
                            <Button type="submit" size="sm">Update Item/Part</Button>
                            <Button type="button" variant="outline" size="sm" onClick={handleCancelPart}>Cancel</Button>
                          </div>
                        </form>
                      </Form>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-900">{part.partName}</span>
                          {part.sku && <Badge variant="outline" className="text-xs">{part.sku}</Badge>}
                          <span className="text-xs text-gray-500">Qty: {part.quantity}</span>
                        </div>
                        {(() => {
                          const costExcludingVat = part.costExcludingVat ? part.costExcludingVat / 100 : 
                                                   (part.cost ? part.cost / 100 : null);
                          const costIncludingVat = part.costIncludingVat ? part.costIncludingVat / 100 :
                                                   (costExcludingVat ? calculateIncludingVat(costExcludingVat) : null);
                          
                          if (costExcludingVat && costIncludingVat) {
                            return (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-gray-500">Cost (Ex VAT):</span>
                                  <span className="text-gray-900 font-semibold">£{costExcludingVat.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-gray-500">Cost (Inc VAT):</span>
                                  <span className="text-gray-900 font-semibold">£{costIncludingVat.toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {part.notes && (
                          <div className="mt-2 text-xs text-gray-600">
                            <span className="font-medium text-gray-500">Notes:</span>
                            <span className="ml-2 text-gray-700">{part.notes}</span>
                          </div>
                        )}
                      </div>
                      {!readOnly && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditPart(part)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDeletingPartId(part.id)}>
                            <Trash2 className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Notes Section */}
        <div className="bg-purple-50/30 rounded-lg border border-purple-200/50 overflow-hidden">
          <div className="bg-purple-600 px-5 py-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-white" />
              <h3 className="text-lg font-semibold text-white">Notes & Summary</h3>
            </div>
          </div>
          <div className="px-5 py-4 space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Work Summary (Customer-visible)
              </h4>
            <Form {...notesForm}>
              <FormField
                control={notesForm.control}
                name="workSummary"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder={field.value ? undefined : "— No summary recorded —"}
                        rows={4}
                        className="resize-none border-gray-200 focus:border-gray-400"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Form>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveNotes}
                disabled={saveNotesMutation.isPending}
                className="mt-2"
              >
                {saveNotesMutation.isPending ? "Saving..." : "Save Summary"}
              </Button>
            )}
            </div>

            <div className="border-t border-purple-200 pt-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Internal Notes (not on job sheet)
                <Badge variant="secondary" className="text-xs ml-2">Internal Only</Badge>
              </h4>
            <Form {...notesForm}>
              <FormField
                control={notesForm.control}
                name="internalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder={field.value ? undefined : "— No internal notes —"}
                        rows={3}
                        className="resize-none border-gray-200 focus:border-gray-400"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Form>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveNotes}
                disabled={saveNotesMutation.isPending}
                className="mt-2"
              >
                {saveNotesMutation.isPending ? "Saving..." : "Save Notes"}
              </Button>
            )}
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        <div className="bg-orange-50/30 rounded-lg border border-orange-200/50 overflow-hidden">
          <div className="bg-orange-600 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-white" />
              <h3 className="text-lg font-semibold text-white">Attachments (Photos & Files)</h3>
            </div>
            {!readOnly && (
              <label>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx"
                  disabled={uploadingFile}
                />
                <Button asChild variant="secondary" size="sm" className="h-8 text-xs bg-white/20 hover:bg-white/30 text-white border-white/30" disabled={uploadingFile}>
                  <span>
                    <Plus className="h-3 w-3 mr-1" />
                    {uploadingFile ? "Uploading..." : "Add Attachment"}
                  </span>
                </Button>
              </label>
            )}
          </div>
          <div className="px-5 py-4">

          {attachmentsLoading ? (
            <div className="text-sm text-gray-500 py-2">Loading...</div>
          ) : attachments.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-50/50">
              <ImageIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">No attachments uploaded</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="relative flex-shrink-0 group">
                  {attachment.fileType?.startsWith("image/") ? (
                    <div className="relative">
                      <img
                        src={attachment.fileUrl}
                        alt={attachment.fileName}
                        className="w-32 h-32 object-cover rounded border border-gray-200"
                      />
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 bg-white/90 hover:bg-white"
                          onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="w-32 h-32 flex flex-col items-center justify-center bg-gray-100 rounded border border-gray-200">
                      <FileText className="h-8 w-8 text-gray-400 mb-1" />
                      <p className="text-xs text-gray-600 text-center px-2 truncate w-full" title={attachment.fileName}>
                        {attachment.fileName}
                      </p>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Total Price Section */}
        {(grandTotalExcludingVat > 0 || grandTotalIncludingVat > 0) && (
          <div className="bg-gray-900 rounded-lg border-2 border-gray-800 overflow-hidden">
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Total Price</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-300 font-medium">Total (Excluding VAT):</span>
                  <span className="text-white text-lg font-semibold">£{grandTotalExcludingVat.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-300 font-medium">Total (Including VAT):</span>
                  <span className="text-white text-xl font-bold">£{grandTotalIncludingVat.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Print Disclaimer */}
        <div className="pt-2 pb-2">
          <div className="bg-gray-100 rounded-lg px-4 py-3 border border-gray-200">
            <p className="text-xs text-gray-500 text-center italic">
              This section represents the job sheet as it will appear when printed.
            </p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialogs */}
      <AlertDialog open={deletingLabourId !== null} onOpenChange={() => setDeletingLabourId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Labour Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this labour entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLabourId && deleteLabourMutation.mutate(deletingLabourId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletingPartId !== null} onOpenChange={() => setDeletingPartId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Part</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this part entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPartId && deletePartMutation.mutate(deletingPartId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
