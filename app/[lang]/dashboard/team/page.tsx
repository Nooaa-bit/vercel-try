"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Filter, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { getCompanyUsers } from "@/lib/company-users";
import SettingsForm from "@/app/[lang]/dashboard/settings/SettingsForm";
import { useTranslation } from "react-i18next";

type Employee = {
  userId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePicture: string | null;
  role: string;
  roleId: number;
  joinedAt: Date;
};

// ✅ Correct Next.js page props structure
interface PageProps {
  params: { lang: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default function TeamPage({ params }: PageProps) {
  const { lang } = params; // ✅ Extract lang from params
  const { t, ready } = useTranslation("team");
  const { activeRole, hasPermission } = useActiveRole();
  const router = useRouter();

  // Store ALL employees once
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);

  const hasAccess = hasPermission("company_admin");
  const pageSize = 50;

  // Helper functions
  const getProfilePictureUrl = useCallback((profilePicture: string | null) => {
    if (!profilePicture) return null;
    if (profilePicture.trim() === "") return null;
    if (profilePicture.startsWith("http")) return profilePicture;
    return null;
  }, []);

  const getUserInitial = useCallback((employee: Employee) => {
    if (employee.firstName) return employee.firstName[0].toUpperCase();
    return employee.email[0].toUpperCase();
  }, []);

  const getRoleName = useCallback(
    (role: string) => {
      return t(`roles.${role}`, { defaultValue: role.replace("_", " ") });
    },
    [t]
  );

  const handleEditUser = useCallback((employee: Employee) => {
    setSelectedUser(employee);
    setEditDialogOpen(true);
  }, []);

  // Client-side filtering
  const filteredEmployees = useMemo(() => {
    if (selectedRole === "all") {
      return allEmployees;
    }
    return allEmployees.filter((emp) => emp.role === selectedRole);
  }, [allEmployees, selectedRole]);

  // Calculate available roles
  const availableRoles = useMemo(() => {
    const roleCounts = allEmployees.reduce((acc, emp) => {
      acc[emp.role] = (acc[emp.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(roleCounts).map(([role, count]) => ({
      role,
      count,
    }));
  }, [allEmployees]);

  // Client-side pagination
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredEmployees.slice(startIndex, endIndex);
  }, [filteredEmployees, currentPage, pageSize]);

  // Calculate pagination metadata
  const totalCount = filteredEmployees.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Load ALL employees once
  useEffect(() => {
    async function loadEmployees() {
      if (activeRole.companyId) {
        setLoading(true);
        const users = await getCompanyUsers(activeRole.companyId);
        setAllEmployees(users);
        setLoading(false);
      }
    }

    if (hasAccess) {
      loadEmployees();
    }
  }, [activeRole.companyId, hasAccess]);

  // Reset to page 1 when filter changes
  const handleRoleChange = useCallback((role: string) => {
    setSelectedRole(role);
    setCurrentPage(1);
  }, []);

  // Refresh employees after edit
  const refreshEmployees = useCallback(async () => {
    if (activeRole.companyId) {
      const users = await getCompanyUsers(activeRole.companyId);
      setAllEmployees(users);
    }
  }, [activeRole.companyId]);

  // Access control
  useEffect(() => {
    if (!hasAccess) {
      router.push(`/${lang}/dashboard`);
    }
  }, [hasAccess, router, lang]);

  // Show loading while translations load
  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  const totalAllCount = availableRoles.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="space-y-4 py-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {totalCount}{" "}
          {selectedRole === "all"
            ? t("header.employees")
            : getRoleName(selectedRole)}
        </div>
      </div>

      {/* Role Filter Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t("filter.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleRoleChange("all")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedRole === "all"
                  ? "bg-pulse-500 text-white"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {t("filter.all")} ({totalAllCount})
            </button>
            {availableRoles.map((roleInfo) => (
              <button
                key={roleInfo.role}
                onClick={() => handleRoleChange(roleInfo.role)}
                className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                  selectedRole === roleInfo.role
                    ? "bg-pulse-500 text-white"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {getRoleName(roleInfo.role)} ({roleInfo.count})
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employee Cards */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("header.loading")}
        </div>
      ) : paginatedEmployees.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("header.noEmployees")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedEmployees.map((employee) => {
              const profilePictureUrl = getProfilePictureUrl(
                employee.profilePicture
              );
              const userInitial = getUserInitial(employee);

              return (
                <Card
                  key={employee.roleId}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3 mb-2">
                      {profilePictureUrl ? (
                        <img
                          src={profilePictureUrl}
                          alt={`${employee.firstName || employee.email}${t(
                            "card.profileAlt"
                          )}`}
                          className="w-12 h-12 rounded-full object-cover shadow-md"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-pulse-500 to-pulse-600 rounded-full flex items-center justify-center text-white font-semibold text-lg shadow-md">
                          {userInitial}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {employee.firstName && employee.lastName
                            ? `${employee.firstName} ${employee.lastName}`
                            : employee.email}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground truncate">
                          {employee.email}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {t("card.role")}
                        </span>
                        <span className="text-xs bg-muted px-2 py-1 rounded capitalize">
                          {getRoleName(employee.role)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {t("card.joined")}
                        </span>
                        <span className="text-sm">
                          {new Date(employee.joinedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleEditUser(employee)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        {t("card.edit")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {t("pagination.page")} {currentPage} {t("pagination.of")}{" "}
                    {totalPages} • {t("pagination.showing")}{" "}
                    {paginatedEmployees.length} {t("pagination.of")}{" "}
                    {totalCount}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t("pagination.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      {t("pagination.next")}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Edit User Dialog */}
      {selectedUser && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {t("dialog.editTitle")}{" "}
                {selectedUser.firstName || selectedUser.email}
                {t("dialog.editTitleSuffix")}
              </DialogTitle>
            </DialogHeader>

            <SettingsForm
              user={{
                firstName: selectedUser.firstName || "",
                lastName: selectedUser.lastName || "",
                email: selectedUser.email,
                profilePictureUrl: getProfilePictureUrl(
                  selectedUser.profilePicture
                ),
              }}
              targetUserId={selectedUser.userId}
              onSuccess={() => {
                refreshEmployees();
                setEditDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
