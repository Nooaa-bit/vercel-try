//hype-hire/vercel/app/[lang]/dashboard/team/TeamPageClient.tsx
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
import { getCompanyUsers } from "@/lib/company-users-serverVersion";
import SettingsForm from "@/app/[lang]/dashboard/settings/SettingsForm";
import { useTranslation } from "react-i18next";

type Employee = {
  userId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePicture: string | null;
  phoneNumber: string | null; // ✅ Added
  role: string;
  roleId: number;
  joinedAt: Date;
};

type AvailableRole = {
  role: string;
  count: number;
};

interface TeamPageClientProps {
  lang: string;
}

export default function TeamPageClient({ lang }: TeamPageClientProps) {
  const { t, ready } = useTranslation("team");
  const { activeRole, hasPermission } = useActiveRole();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);

  const hasAccess = hasPermission("company_admin");
  const pageSize = 50;

  // ✅ Helper to get profile picture URL
  const getProfilePictureUrl = useCallback((profilePicture: string | null) => {
    if (!profilePicture) return null;
    if (profilePicture.trim() === "") return null;
    if (profilePicture.startsWith("http")) return profilePicture;
    return null;
  }, []);

  // ✅ Helper to get user initials
  const getUserInitial = useCallback((employee: Employee) => {
    if (employee.firstName) return employee.firstName[0].toUpperCase();
    return employee.email[0].toUpperCase();
  }, []);

  // ✅ Helper to get translated role name
  const getRoleName = useCallback(
    (role: string) => {
      return t(`roles.${role}`, { defaultValue: role.replace("_", " ") });
    },
    [t]
  );

  // ✅ Handle edit button click
  const handleEditUser = useCallback((employee: Employee) => {
    setSelectedUser(employee);
    setEditDialogOpen(true);
  }, []);

  // ✅ Refresh employees after edit
  const refreshEmployees = useCallback(async () => {
    if (activeRole.companyId) {
      setLoading(true);
      const result = await getCompanyUsers(
        activeRole.companyId,
        currentPage,
        pageSize,
        selectedRole
      );
      setEmployees(result.employees);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
      setAvailableRoles(result.availableRoles);
      setLoading(false);
    }
  }, [activeRole.companyId, currentPage, selectedRole]);

  // ✅ Fetch employees when page or role changes
  useEffect(() => {
    if (hasAccess) {
      refreshEmployees();
    }
  }, [hasAccess, refreshEmployees]);

  // ✅ Handle role filter change (reset to page 1)
  const handleRoleChange = useCallback((role: string) => {
    setSelectedRole(role);
    setCurrentPage(1);
  }, []);

  // ✅ Access control
  useEffect(() => {
    if (!hasAccess) {
      router.push(`/${lang}/dashboard`);
    }
  }, [hasAccess, router, lang]);

  // ✅ Memoized total count
  const totalAllCount = useMemo(
    () => availableRoles.reduce((sum, r) => sum + r.count, 0),
    [availableRoles]
  );

  // ✅ Show loading state while translations load
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
      ) : employees.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("header.noEmployees")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((employee) => {
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
                    {totalPages} • {t("pagination.showing")} {employees.length}{" "}
                    {t("pagination.of")} {totalCount}
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

      {/* ✅ Edit User Dialog */}
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
                phoneNumber: selectedUser.phoneNumber || "", // ✅ Added
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
