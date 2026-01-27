import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@/assets/logo-m.png";

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartSetup: () => void;
  userName?: string;
}

export function WelcomeModal({ open, onOpenChange, onStartSetup, userName }: WelcomeModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dismissMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/dismiss-onboarding-welcome");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      onOpenChange(false);
    },
  });

  const handleSkip = () => {
    dismissMutation.mutate();
  };

  const handleStart = () => {
    onStartSetup();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <img src={logoPath} alt="Boltdown Logo" className="h-16 object-contain" />
          </div>
          <DialogTitle className="text-2xl text-center">
            Welcome to Boltdown{userName ? `, ${userName.split(" ")[0]}` : ""}!
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Let's get you set up in just a few minutes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-slate-700 leading-relaxed">
              <strong>Boltdown helps you take your business online,</strong> removing paper sheets and ensuring you keep track of the customers and jobs interacting and passing through your workshop.
            </p>
            <p className="text-sm text-slate-600">
              We'll walk you through setting up your workshop, adding your first customer, and creating your first job. There are more features to explore, but let's get to grips with the basics first.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600 bg-amber-50 rounded-lg p-3">
            <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>This takes about 5 minutes</span>
          </div>

          <div className="space-y-2 pt-2">
            <Button
              onClick={handleStart}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              size="lg"
            >
              Start guided setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              onClick={handleSkip}
              variant="ghost"
              className="w-full"
              disabled={dismissMutation.isPending}
            >
              {dismissMutation.isPending ? "Saving..." : "Skip for now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

