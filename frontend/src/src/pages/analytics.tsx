import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { 
  Clock, 
  Wrench, 
  Package, 
  CheckCircle,
  Users,
  TrendingUp,
  AlertTriangle,
  Calendar,
  PhoneCall,
  Download,
  FileText,
  Target,
  Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Analytics() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
  const [callbackFromDate, setCallbackFromDate] = useState<string>("");
  const [callbackToDate, setCallbackToDate] = useState<string>("");

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

  // Callback analytics query
  const callbackAnalyticsUrl = (() => {
    const params = new URLSearchParams();
    if (callbackFromDate) params.append("fromDate", callbackFromDate);
    if (callbackToDate) params.append("toDate", callbackToDate);
    const queryString = params.toString();
    return `/api/analytics/callbacks${queryString ? `?${queryString}` : ""}`;
  })();

  const { data: callbackAnalytics, isLoading: callbackAnalyticsLoading, error: callbackError } = useQuery({
    queryKey: [callbackAnalyticsUrl],
    enabled: isAdmin,
  });

  // Debug logging
  if (callbackError) {
    console.error("[Analytics] Callback analytics error:", callbackError);
  }
  if (callbackAnalytics) {
    console.log("[Analytics] Callback analytics data:", callbackAnalytics);
  }

  const handleDownloadPDF = () => {
    const params = new URLSearchParams();
    if (callbackFromDate) params.append("fromDate", callbackFromDate);
    if (callbackToDate) params.append("toDate", callbackToDate);
    
    const url = `/api/analytics/callbacks/report${params.toString() ? `?${params.toString()}` : ""}`;
    window.open(url, "_blank");
  };

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
  const completedJobs = jobsArray.filter((j: any) => j.status === "completed").length;

  const jobStatusData = [
    { name: "Waiting Assessment", value: waitingJobs, color: "#EF4444" },
    { name: "In Progress", value: inProgressJobs, color: "#F59E0B" },
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

  // Format hours for display
  const formatHours = (hours: number | null) => {
    if (hours === null) return "N/A";
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days}d`;
    return `${days}d ${remainingHours.toFixed(1)}h`;
  };

  const callbackData = callbackAnalytics as any;

  return (
    <>
      <PageHeader title="Workshop Analytics" />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 mt-4 sm:mt-6 md:mt-8">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="general" className="text-xs sm:text-sm py-2 sm:py-2.5">General Analytics</TabsTrigger>
            {isAdmin && <TabsTrigger value="callbacks" className="text-xs sm:text-sm py-2 sm:py-2.5">Callback Analytics</TabsTrigger>}
          </TabsList>

          <TabsContent value="general" className="space-y-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Job Status Distribution */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Job Status Distribution</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="h-[250px] sm:h-[300px]">
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
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Jobs by Equipment Type</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="h-[250px] sm:h-[300px]">
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
        <Card className="mb-6 sm:mb-8">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Task Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="h-[250px] sm:h-[300px]">
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
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Current Workshop Status</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
        </TabsContent>

        {isAdmin && (
          <TabsContent value="callbacks" className="space-y-8">
            {/* Callback Analytics Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <PhoneCall className="h-5 w-5" />
                      Customer Callback Analytics
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Comprehensive insights into callback performance and staff efficiency
                    </CardDescription>
                  </div>
                  <Button onClick={handleDownloadPDF} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download PDF Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Date Range Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <Label htmlFor="fromDate">From Date</Label>
                    <Input
                      id="fromDate"
                      type="date"
                      value={callbackFromDate}
                      onChange={(e) => setCallbackFromDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="toDate">To Date</Label>
                    <Input
                      id="toDate"
                      type="date"
                      value={callbackToDate}
                      onChange={(e) => setCallbackToDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCallbackFromDate("");
                        setCallbackToDate("");
                      }}
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {callbackAnalyticsLoading ? (
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
            ) : callbackError ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-600 font-medium">Error loading callback analytics</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {callbackError instanceof Error ? callbackError.message : "Unknown error"}
                  </p>
                </CardContent>
              </Card>
            ) : callbackData ? (
              <>
                {/* Summary Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <PhoneCall className="h-8 w-8 text-blue-600" />
                        <div className="ml-3">
                          <div className="text-2xl font-bold text-gray-900">
                            {callbackData.summary?.totalCallbacks || 0}
                          </div>
                          <div className="text-sm text-gray-500">Total Callbacks</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                        <div className="ml-3">
                          <div className="text-2xl font-bold text-gray-900">
                            {callbackData.summary?.totalCompleted || 0}
                          </div>
                          <div className="text-sm text-gray-500">Completed</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <Target className="h-8 w-8 text-purple-600" />
                        <div className="ml-3">
                          <div className="text-2xl font-bold text-gray-900">
                            {callbackData.summary?.completionRate?.toFixed(1) || 0}%
                          </div>
                          <div className="text-sm text-gray-500">Completion Rate</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <Timer className="h-8 w-8 text-amber-600" />
                        <div className="ml-3">
                          <div className="text-2xl font-bold text-gray-900">
                            {formatHours(callbackData.summary?.overallAvgCompletionTimeHours)}
                          </div>
                          <div className="text-sm text-gray-500">Avg Completion Time</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Staff Performance Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Staff Performance</CardTitle>
                    <CardDescription>
                      Individual callback metrics for each staff member
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Staff Member</TableHead>
                            <TableHead className="text-center">Total</TableHead>
                            <TableHead className="text-center">Completed</TableHead>
                            <TableHead className="text-center">Pending</TableHead>
                            <TableHead className="text-center">Completion Rate</TableHead>
                            <TableHead className="text-center">Avg Time</TableHead>
                            <TableHead className="text-center">Longest Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {callbackData.staffPerformance?.length > 0 ? (
                            callbackData.staffPerformance.map((staff: any) => (
                              <TableRow key={staff.staffId}>
                                <TableCell className="font-medium">
                                  {staff.staffName}
                                </TableCell>
                                <TableCell className="text-center">
                                  {staff.totalCallbacks}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="bg-green-50 text-green-700">
                                    {staff.completedCallbacks}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                    {staff.pendingCallbacks}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className={
                                      staff.completionRate >= 80
                                        ? "bg-green-50 text-green-700"
                                        : staff.completionRate >= 60
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-red-50 text-red-700"
                                    }
                                  >
                                    {staff.completionRate.toFixed(1)}%
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  {formatHours(staff.avgCompletionTimeHours)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {formatHours(staff.longestCompletionTimeHours)}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-gray-500">
                                No staff performance data available
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Status Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Status Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                {
                                  name: "Pending",
                                  value: callbackData.statusBreakdown?.pending || 0,
                                  color: "#F59E0B",
                                },
                                {
                                  name: "Completed",
                                  value: callbackData.statusBreakdown?.completed || 0,
                                  color: "#10B981",
                                },
                                {
                                  name: "Archived",
                                  value: callbackData.statusBreakdown?.archived || 0,
                                  color: "#6B7280",
                                },
                              ].filter((item) => item.value > 0)}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, value }) => `${name}: ${value}`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {[
                                { name: "Pending", value: callbackData.statusBreakdown?.pending || 0, color: "#F59E0B" },
                                { name: "Completed", value: callbackData.statusBreakdown?.completed || 0, color: "#10B981" },
                                { name: "Archived", value: callbackData.statusBreakdown?.archived || 0, color: "#6B7280" },
                              ]
                                .filter((item) => item.value > 0)
                                .map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Priority Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Priority Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              {
                                name: "Low",
                                value: callbackData.priorityDistribution?.low || 0,
                              },
                              {
                                name: "Medium",
                                value: callbackData.priorityDistribution?.medium || 0,
                              },
                              {
                                name: "High",
                                value: callbackData.priorityDistribution?.high || 0,
                              },
                              {
                                name: "Urgent",
                                value: callbackData.priorityDistribution?.urgent || 0,
                              },
                            ]}
                          >
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
                </div>

                {/* Daily Trends */}
                {callbackData.dailyTrends && callbackData.dailyTrends.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Daily Trends (Last 30 Days)</CardTitle>
                      <CardDescription>
                        Callbacks created vs completed over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={callbackData.dailyTrends}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(value) => format(new Date(value), "MMM dd")}
                            />
                            <YAxis />
                            <Tooltip
                              labelFormatter={(value) => format(new Date(value), "MMM dd, yyyy")}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="created"
                              stroke="#3B82F6"
                              name="Created"
                              strokeWidth={2}
                            />
                            <Line
                              type="monotone"
                              dataKey="completed"
                              stroke="#10B981"
                              name="Completed"
                              strokeWidth={2}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Additional Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Overall Performance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Average Completion Time</span>
                        <span className="font-semibold">
                          {formatHours(callbackData.summary?.overallAvgCompletionTimeHours)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Longest Completion Time</span>
                        <span className="font-semibold">
                          {formatHours(callbackData.summary?.overallLongestCompletionTimeHours)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Pending</span>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700">
                          {callbackData.summary?.totalPending || 0}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button
                        onClick={handleDownloadPDF}
                        className="w-full gap-2"
                        variant="outline"
                      >
                        <FileText className="h-4 w-4" />
                        Generate PDF Report
                      </Button>
                      <div className="text-xs text-gray-500 text-center">
                        Download a comprehensive PDF report with all callback analytics
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <PhoneCall className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No callback data available</p>
                  <p className="text-sm text-gray-400 mb-4">
                    {callbackData?.summary?.totalCallbacks === 0 
                      ? "There are no callbacks in the system yet. You can still generate a PDF report."
                      : "Unable to load callback analytics data."}
                  </p>
                  {callbackData && (
                    <Button
                      onClick={handleDownloadPDF}
                      variant="outline"
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Generate PDF Report
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
        </Tabs>
      </div>
    </>
  );
}
