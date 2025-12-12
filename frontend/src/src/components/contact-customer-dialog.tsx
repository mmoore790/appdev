import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { useToast } from "../hooks/use-toast";
import { apiRequest } from "../lib/queryClient";
import { Mail } from "lucide-react";

interface ContactCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: number;
  customerEmail: string | null | undefined;
  customerName?: string | null;
  equipmentDescription?: string | null;
}

export function ContactCustomerDialog({
  open,
  onOpenChange,
  jobId,
  customerEmail,
  customerName,
  equipmentDescription,
}: ContactCustomerDialogProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const { toast } = useToast();

  // Fetch business data for template
  const { data: businessData } = useQuery<{
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  }>({
    queryKey: ["/api/business/me"],
  });

  // Initialize template when dialog opens
  useEffect(() => {
    if (open) {
      const name = customerName || "Customer";
      const businessName = businessData?.name || "Our Team";
      
      // Set default subject with equipment name
      const equipmentName = equipmentDescription || "your equipment";
      setSubject(`Update on your service request for ${equipmentName}`);
      
      // Set template body with pre-filled content
      const emailBody = `Hi ${name},

Best regards,
${businessName}`;
      
      setBody(emailBody);
    }
  }, [open, customerName, businessData, equipmentDescription]);

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { subject: string; body: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/send-email`, data);
    },
    onSuccess: () => {
      toast({
        title: "Email sent",
        description: `Email successfully sent to ${customerEmail}`,
      });
      setSubject("");
      setBody("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send email",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) {
      toast({
        title: "Validation error",
        description: "Please fill in both subject and message.",
        variant: "destructive",
      });
      return;
    }

    if (!customerEmail) {
      toast({
        title: "No email address",
        description: "Customer email address is not available.",
        variant: "destructive",
      });
      return;
    }

    sendEmailMutation.mutate({ subject: subject.trim(), body: body.trim() });
  };

  const handleCancel = () => {
    setSubject("");
    setBody("");
    onOpenChange(false);
  };

  if (!customerEmail) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact Customer</DialogTitle>
            <DialogDescription>
              No email address available for this customer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail size={20} />
            Contact Customer
          </DialogTitle>
          <DialogDescription>
            Send an email to {customerName || "the customer"} at {customerEmail}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email-to">To</Label>
            <Input
              id="email-to"
              value={customerEmail}
              disabled
              className="bg-neutral-50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject *</Label>
            <Input
              id="email-subject"
              placeholder="Enter email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sendEmailMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-body">Message *</Label>
            <Textarea
              id="email-body"
              placeholder="Enter your message here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              disabled={sendEmailMutation.isPending}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={sendEmailMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendEmailMutation.isPending || !subject.trim() || !body.trim()}
            className="bg-green-700 hover:bg-green-800"
          >
            {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}






