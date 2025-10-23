"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Filter } from "lucide-react";
import { getCompanyUsers } from "@/lib/company-users";

type Employee = {
  userId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  roleId: number;
  joinedAt: Date;
};

export default function ProtectedPage() {
  const { activeRole, hasPermission } = useActiveRole();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const hasAccess = hasPermission("company_admin");

  // Fetch employees when component mounts
  useEffect(() => {
    async function loadEmployees() {
      if (activeRole.companyId) {
        setLoading(true);
        const users = await getCompanyUsers(activeRole.companyId);
        setEmployees(users);
        setFilteredEmployees(users);
        setLoading(false);
      }
    }

    if (hasAccess) {
      loadEmployees();
    }
  }, [activeRole.companyId, hasAccess]);

  // Filter employees when role selection changes
  useEffect(() => {
    if (selectedRole === "all") {
      setFilteredEmployees(employees);
    } else {
      setFilteredEmployees(
        employees.filter((emp) => emp.role === selectedRole)
      );
    }
  }, [selectedRole, employees]);

  useEffect(() => {
    if (!hasAccess) {
      router.push("/dashboard");
    }
  }, [hasAccess, router]);

  if (!hasAccess) {
    return null;
  }

  // Get unique roles from employees
  const availableRoles = Array.from(new Set(employees.map((emp) => emp.role)));

  return (
    <div className="space-y-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Directory</h1>
          <p className="text-muted-foreground mt-1">{activeRole.companyName}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {filteredEmployees.length} employees
        </div>
      </div>

      {/* Role Filter Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter by Role
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedRole("all")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedRole === "all"
                  ? "bg-pulse-500 text-white"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              All ({employees.length})
            </button>
            {availableRoles.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                  selectedRole === role
                    ? "bg-pulse-500 text-white"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {role.replace("_", " ")} (
                {employees.filter((e) => e.role === role).length})
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employee Cards */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading employees...
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No employees found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((employee) => (
            <Card
              key={employee.roleId}
              className="hover:border-pulse-500 transition-colors"
            >
              <CardHeader>
                <CardTitle className="text-lg">
                  {employee.firstName && employee.lastName
                    ? `${employee.firstName} ${employee.lastName}`
                    : employee.email}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {employee.email}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Role:</span>
                    <span className="text-sm font-medium capitalize px-2 py-1 bg-muted rounded">
                      {employee.role.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Joined:
                    </span>
                    <span className="text-sm">
                      {new Date(employee.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
