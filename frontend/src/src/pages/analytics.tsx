import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  Clock, 
  Wrench, 
  Package, 
  CheckCircle,
  Users,
  TrendingUp,
  AlertTriangle,
  Calendar
} from "lucide-react";

export default function Analytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/analytics/summary"],
  });

  const { data: jobs } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const { data: tasks } = useQuery({
    queryKey: ["/api/tasks"],
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Calculate job status distribution for pie chart
  const jobsArray = Array.isArray(jobs) ? jobs : [];
  const waitingJobs = jobsArray.filter((j: any) => j.status === "waiting_assessment").length;
  const inProgressJobs = jobsArray.filter((j: any) => j.status === "in_progress").length;
  const partsOrderedJobs = jobsArray.filter((j: any) => j.status === "parts_ordered").length;
  const completedJobs = jobsArray.filter((j: any) => j.status === "completed").length;

  const jobStatusData = [
    { name: "Waiting Assessment", value: waitingJobs, color: "#EF4444" },
    { name: "In Progress", value: inProgressJobs, color: "#F59E0B" },
    { name: "Parts Ordered", value: partsOrderedJobs, color: "#3B82F6" },
    { name: "Completed", value: completedJobs, color: "#10B981" }
  ].filter(item => item.value > 0);

  // Calculate task status distribution
  const tasksArray = Array.isArray(tasks) ? tasks : [];
  const pendingTasks = tasksArray.filter((t: any) => t.status === "pending").length;
  const inProgressTasks = tasksArray.filter((t: any) => t.status === "in_progress").length;
  const reviewTasks = tasksArray.filter((t: any) => t.status === "review").length;
  const completedTasks = tasksArray.filter((t: any) => t.status === "completed").length;

  const taskStatusData = [
    { name: "Pending", value: pendingTasks, color: "#6B7280" },
    { name: "In Progress", value: inProgressTasks, color: "#3B82F6" },
    { name: "Review", value: reviewTasks, color: "#8B5CF6" },
    { name: "Completed", value: completedTasks, color: "#10B981" }
  ].filter(item => item.value > 0);

  // Equipment types data from analytics
  const equipmentJobsData = (analytics as any)?.jobsByEquipmentType || [];

  return (
    <>
      <PageHeader title="Workshop Analytics" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Wrench className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <div className="text-2xl font-bold text-gray-900">{(analytics as any)?.activeJobs || 0}</div>
                  <div className="text-sm text-gray-500">Active Jobs</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-amber-600" />
                <div className="ml-3">
                  <div className="text-2xl font-bold text-gray-900">{(analytics as any)?.avgRepairTime || "—"}</div>
                  <div className="text-sm text-gray-500">Avg Repair Days</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <div className="text-2xl font-bold text-gray-900">{(analytics as any)?.completedThisWeek || 0}</div>
                  <div className="text-sm text-gray-500">Completed This Week</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Job Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Job Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={jobStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {jobStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Equipment Types */}
          <Card>
            <CardHeader>
              <CardTitle>Jobs by Equipment Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={equipmentJobsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2E7D32" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task Status Distribution */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Task Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Live Job Status Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Current Workshop Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <h3 className="ml-2 font-medium text-red-900">Waiting Assessment</h3>
                </div>
                <div className="mt-2 text-2xl font-bold text-red-900">
                  {waitingJobs}
                </div>
                <div className="mt-1 text-sm text-red-600">
                  Need immediate attention
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center">
                  <Wrench className="h-5 w-5 text-amber-600" />
                  <h3 className="ml-2 font-medium text-amber-900">In Progress</h3>
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-900">
                  {inProgressJobs}
                </div>
                <div className="mt-1 text-sm text-amber-600">
                  Currently being worked on
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <Package className="h-5 w-5 text-blue-600" />
                  <h3 className="ml-2 font-medium text-blue-900">Parts Ordered</h3>
                </div>
                <div className="mt-2 text-2xl font-bold text-blue-900">
                  {partsOrderedJobs}
                </div>
                <div className="mt-1 text-sm text-blue-600">
                  Waiting for parts delivery
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="ml-2 font-medium text-green-900">Ready for Pickup</h3>
                </div>
                <div className="mt-2 text-2xl font-bold text-green-900">
                  {completedJobs}
                </div>
                <div className="mt-1 text-sm text-green-600">
                  Completed and ready
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
