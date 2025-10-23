//hype-hire/vercel/app/[lang]/dashboard/page.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Activity,
  FileText,
  UserPlus,
  BarChart3,
  Settings,
  Download,
  Plus,
  Building2,
} from "lucide-react";
import { useActiveRole } from "../../hooks/useActiveRole";
import { useTranslation } from "react-i18next";

const MetricCard = ({
  title,
  value,
  change,
  trend,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
        {trend === "up" ? (
          <TrendingUp className="h-4 w-4 text-green-500" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-500" />
        )}
        <span className={trend === "up" ? "text-green-500" : "text-red-500"}>
          {change}
        </span>
        <span>{description}</span>
      </div>
    </CardContent>
  </Card>
);

export default function Dashboard2Page() {
  const { t } = useTranslation("dashboard");
  const { activeRole, activeCompanyId, hasPermission, loading } =
    useActiveRole();

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-muted-foreground">{t("loading")}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/*  I deleted a lot of stuff which are in actual_page. Although its all front end without any functionality*/}
      </div>
    </div>
  );
}
 








             {/*    <MetricCard
              title="New Customers"
              value="1,234"
              change="-5.2%"
              trend="down"
              description="from last month"
              icon={Users}
            />
            <MetricCard
              title="Active Sessions"
              value="45,678"
              change="+18.1%"
              trend="up"
              description="from last month"
              icon={Activity}
            />
            <MetricCard
              title="Growth Rate"
              value="4.5%"
              change="+2.1%"
              trend="up"
              description="steady growth"
              icon={TrendingUp}      */
}

          {/* Chart Section 
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Analytics Overview</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="default" className="bg-pulse-500">
                    Last 3 months
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-orange-200 text-orange-600"
                  >
                    Last 30 days
                  </Badge>
                  <Badge variant="outline">Last 7 days</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gradient-to-br from-pulse-50 to-pulse-100 rounded-lg flex items-center justify-center border">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-pulse-500 rounded-full mx-auto flex items-center justify-center">
                      <BarChart3 className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium">
                        Chart visualization area
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Analytics for the last 3 months
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start hover:bg-pulse-50 hover:border-pulse-200"
                >
                  <FileText className="h-4 w-4 mr-3" />
                  Create Document
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start hover:bg-pulse-50 hover:border-pulse-200"
                >
                  <UserPlus className="h-4 w-4 mr-3" />
                  Add Team Member
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start hover:bg-pulse-50 hover:border-pulse-200"
                >
                  <BarChart3 className="h-4 w-4 mr-3" />
                  Generate Report
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start hover:bg-pulse-50 hover:border-pulse-200"
                >
                  <Settings className="h-4 w-4 mr-3" />
                  Configure Settings
                </Button>
              </CardContent>
            </Card>
          </div> */}

          {/* Table Section 
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  Customize Columns
                </Button>
                <Button variant="outline" size="sm">
                  Add Section
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Document
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Last Updated
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Assignee
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-muted/50 transition-all duration-200">
                      <td className="py-3 px-4 font-medium">
                        Q4 Financial Report
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-600 border-blue-200"
                        >
                          Report
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className="bg-green-100 text-green-600 border-green-200">
                          Complete
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        2 hours ago
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-pulse-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            JD
                          </div>
                          John Doe
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b hover:bg-muted/50 transition-all duration-200">
                      <td className="py-3 px-4 font-medium">
                        Marketing Strategy
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="bg-purple-50 text-purple-600 border-purple-200"
                        >
                          Proposal
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="bg-orange-50 text-orange-600 border-orange-200"
                        >
                          In Progress
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        1 day ago
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-pulse-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            JS
                          </div>
                          Jane Smith
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b hover:bg-muted/50 transition-all duration-200">
                      <td className="py-3 px-4 font-medium">
                        Team Performance Review
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-600 border-green-200"
                        >
                          Review
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="bg-gray-50 text-gray-600 border-gray-200"
                        >
                          Draft
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        3 days ago
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-pulse-700 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            MB
                          </div>
                          Mike Brown
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>  */}

