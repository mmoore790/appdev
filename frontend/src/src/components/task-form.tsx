import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useToast } from "../hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { CalendarIcon } from "lucide-react";
import { formatDate } from "../lib/utils";

// Define the task schema for form validation
const taskSchema = z.object({
  title: z.string().min(3, { message: "Title is required" }),
  description: z.string().optional(),
  priority: z.string(),
  status: z.string(),
  assignedTo: z.string().optional(),
  dueDate: z.date().optional(),
  relatedJobId: z.string().optional()
});

interface TaskFormProps {
  taskId?: number;
  editMode?: boolean;
  defaultStatus?: string;
  onComplete?: () => void;
}

export function TaskForm({ taskId, editMode = false, defaultStatus = "pending", onComplete }: TaskFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: defaultStatus,
      assignedTo: "",
      dueDate: undefined,
      relatedJobId: ""
    }
  });

  // Fetch task data if in edit mode
  const { data: task = {}, isLoading: isTaskLoading } = useQuery({
    queryKey: taskId ? [`/api/tasks/${taskId}`] : ["/api/tasks/null"],
    enabled: !!taskId
  });

  // Fetch users for dropdown
  const { data: users = [], isLoading: isUsersLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  // Fetch jobs for dropdown
  const { data: jobs = [], isLoading: isJobsLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  // Update form values when task data is loaded
  useEffect(() => {
    if (task && Object.keys(task).length > 0) {
      form.reset({
        title: (task as any).title || "",
        description: (task as any).description || "",
        priority: (task as any).priority || "medium",
        status: (task as any).status || defaultStatus,
        assignedTo: (task as any).assignedTo?.toString() || "",
        dueDate: (task as any).dueDate ? new Date((task as any).dueDate) : undefined,
        relatedJobId: (task as any).relatedJobId?.toString() || ""
      });
    }
  }, [task, form, defaultStatus]);

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/tasks", {
        ...data,
        assignedTo: data.assignedTo ? parseInt(data.assignedTo) : null,
        dueDate: data.dueDate ? data.dueDate.toISOString() : null,
        relatedJobId: data.relatedJobId ? parseInt(data.relatedJobId) : null,
        status: data.status || "pending"
      });
    },
    onSuccess: () => {
      toast({
        title: "Task created",
        description: "The task has been successfully created."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      if (onComplete) onComplete();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create task: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Update task mutation
  const updateTask = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, {
        ...data,
        assignedTo: data.assignedTo ? parseInt(data.assignedTo) : null,
        dueDate: data.dueDate ? data.dueDate.toISOString() : null,
        relatedJobId: data.relatedJobId ? parseInt(data.relatedJobId) : null
      });
    },
    onSuccess: () => {
      toast({
        title: "Task updated",
        description: "The task has been successfully updated."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}`] });
      if (onComplete) onComplete();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update task: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Form submission handler
  function onSubmit(data: z.infer<typeof taskSchema>) {
    if (editMode && taskId) {
      updateTask.mutate(data);
    } else {
      createTask.mutate(data);
    }
  }

  // Priority options
  const priorityOptions = [
    { value: "high", label: "High", color: "bg-red-600 text-white" },
    { value: "medium", label: "Medium", color: "bg-amber-500 text-white" },
    { value: "low", label: "Low", color: "bg-blue-600 text-white" }
  ];

  // Get user name
  const getUserName = (id: string | undefined) => {
    if (!id || !Array.isArray(users)) return "Select assignee";
    const user = users.find((u: any) => u.id === parseInt(id));
    return user ? user.fullName : "Select assignee";
  };

  // Get job details
  const getJobDetails = (id: string | undefined) => {
    if (!id || !Array.isArray(jobs)) return "Select related job";
    const job = jobs.find((j: any) => j.id === parseInt(id));
    return job ? `${job.jobId} - ${job.description.substring(0, 30)}...` : "Select related job";
  };

  if ((isTaskLoading || isUsersLoading || isJobsLoading) && editMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Task...</CardTitle>
          <CardDescription>Please wait while we fetch the task details.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editMode ? "Edit Task" : "Add New Task"}</CardTitle>
        <CardDescription>
          {editMode 
            ? "Update task information" 
            : "Create a new task to assign to team members"
          }
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title*</FormLabel>
                  <FormControl>
                    <Input placeholder="Task title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Task details" 
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {priorityOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full ${option.color.split(' ')[0]}`}></span>
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select assignee">
                            {getUserName(field.value)}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {Array.isArray(users) && users.map((user: any) => (
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
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                          >
                            {field.value ? (
                              formatDate(field.value.toISOString())
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="relatedJobId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Job</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select job">
                            {getJobDetails(field.value)}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {Array.isArray(jobs) && jobs.map((job: any) => (
                          <SelectItem key={job.id} value={job.id.toString()}>
                            {job.jobId} - {job.description.substring(0, 30)}...
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onComplete}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="bg-green-700 hover:bg-green-800"
              disabled={createTask.isPending || updateTask.isPending}
            >
              {createTask.isPending || updateTask.isPending ? (
                <span className="flex items-center">
                  <span className="material-icons animate-spin mr-2">refresh</span>
                  Saving...
                </span>
              ) : (
                editMode ? "Update Task" : "Create Task"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
