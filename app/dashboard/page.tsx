"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AnalyticsData {
  totalUploads: number;
  validationFailures: number;
  statusData: { name: string; value: number }[];
  machineQuantities: { machine: string; total_qty: number; count: number }[];
  shiftSummary: { shift: string; count: number; total_qty: number; avg_time: number }[];
  uploadTrend: { date: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  "Needs Review": "#f59e0b",
  Approved: "#22c55e",
};

const CHART_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b"];

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load analytics");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
          {error || "Failed to load analytics."}
        </div>
      </div>
    );
  }

  const approved = data.statusData.find((s) => s.name === "Approved")?.value ?? 0;
  const needsReview = data.statusData.find((s) => s.name === "Needs Review")?.value ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Operational analytics and insights from processed documents.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Uploads"
          value={data.totalUploads}
          icon={FileText}
          color="bg-blue-500"
          subtitle="All time"
        />
        <StatCard
          title="Approved"
          value={approved}
          icon={CheckCircle}
          color="bg-green-500"
          subtitle={`${data.totalUploads > 0 ? Math.round((approved / data.totalUploads) * 100) : 0}% of total`}
        />
        <StatCard
          title="Needs Review"
          value={needsReview}
          icon={TrendingUp}
          color="bg-amber-500"
          subtitle="Pending approval"
        />
        <StatCard
          title="Validation Failures"
          value={data.validationFailures}
          icon={AlertTriangle}
          color="bg-red-500"
          subtitle="Records with issues"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Document Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Document Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {data.statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Machine vs Quantity Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quantity Produced by Machine</CardTitle>
          </CardHeader>
          <CardContent>
            {data.machineQuantities.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                No machine data available yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.machineQuantities} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="machine" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total_qty" name="Total Qty" radius={[4, 4, 0, 0]}>
                    {data.machineQuantities.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shift Summary Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shift-wise Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {data.shiftSummary.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                No shift data available yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.shiftSummary} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="shift" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" name="Records" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="total_qty" name="Total Qty" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Upload Trend Line */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.uploadTrend.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                No recent upload data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.uploadTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Uploads"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#3b82f6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Shift Detail Table */}
      {data.shiftSummary.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Shift Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Shift</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Records</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Total Qty</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Avg Time (hrs)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shiftSummary.map((row) => (
                    <tr key={row.shift} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">{row.shift}</td>
                      <td className="py-2 px-3 text-right">{row.count}</td>
                      <td className="py-2 px-3 text-right">{row.total_qty}</td>
                      <td className="py-2 px-3 text-right">{row.avg_time ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
