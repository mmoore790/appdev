import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Mail, User } from "lucide-react";
import { ContactCustomerDialog } from "./contact-customer-dialog";

interface CustomerActionsProps {
  jobId: number;
  customerEmail: string | null | undefined;
  customerName?: string | null;
  equipmentDescription?: string | null;
}

export function CustomerActions({
  jobId,
  customerEmail,
  customerName,
  equipmentDescription,
}: CustomerActionsProps) {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  return (
    <>
      <Card className="border-green-100">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold text-neutral-800 flex items-center gap-2">
            <User size={16} />
            Customer Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-green-700 hover:bg-green-50 border-green-200"
            onClick={() => setEmailDialogOpen(true)}
            disabled={!customerEmail}
          >
            <Mail size={14} />
            Contact Customer
          </Button>
          {!customerEmail && (
            <p className="text-xs text-neutral-500 mt-2">
              No email address available for this customer
            </p>
          )}
        </CardContent>
      </Card>

      <ContactCustomerDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        jobId={jobId}
        customerEmail={customerEmail}
        customerName={customerName}
        equipmentDescription={equipmentDescription}
      />
    </>
  );
}






