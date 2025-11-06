import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Job update form schema
const updateSchema = z.object({
  note: z.string().min(3, "Update note must be at least 3 characters long"),
  isPublic: z.boolean().default(false),
});

type JobUpdateFormValues = z.infer<typeof updateSchema>;

interface JobUpdateFormProps {
  jobId: number;
  onSuccess?: () => void;
}

export function JobUpdateForm({ jobId, onSuccess }: JobUpdateFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set up form with default values
  const form = useForm<JobUpdateFormValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      note: "",
      isPublic: false,
    },
  });

  // Mutation for creating job update
  const mutation = useMutation({
    mutationFn: async (data: JobUpdateFormValues) => {
      return apiRequest("POST", `/api/jobs/${jobId}/updates`, data);
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/updates`] });
      
      // Reset form
      form.reset();
      
      // Show success toast
      toast({
        title: "Update added",
        description: "Job update has been successfully added.",
        variant: "default",
      });
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      setIsSubmitting(false);
    },
    onError: (error) => {
      // Show error toast
      toast({
        title: "Error adding update",
        description: "Failed to add job update. Please try again.",
        variant: "destructive",
      });
      console.error("Error adding job update:", error);
      setIsSubmitting(false);
    },
  });

  // Form submission handler
  const onSubmit = async (data: JobUpdateFormValues) => {
    setIsSubmitting(true);
    await mutation.mutateAsync(data);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Add Job Update</CardTitle>
        <CardDescription>
          Add progress updates for this job
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Update Note</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter details about the job progress..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Customer Visible</FormLabel>
                    <FormDescription>
                      Make this update visible to the customer in the public job tracker
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Public updates will be visible to customers when they track their job status online.
                Use this for important status changes, estimated completion times, or part arrivals.
              </p>
            </div>
          </CardContent>
          
          <CardFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Update...
                </>
              ) : (
                "Add Update"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}