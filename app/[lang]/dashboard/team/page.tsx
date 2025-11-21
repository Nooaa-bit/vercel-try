// app/[lang]/dashboard/team/page.tsx
"use client";

import { use, useEffect, useState, useMemo, useCallback } from "react";
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
import {
  Users,
  Filter,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Loader2,
} from "lucide-react";
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

interface PageProps {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface RoleInfo {
  role: string;
  count: number;
}

// ✅ Move helper functions outside component to prevent recreation
const getProfilePictureUrl = (profilePicture: string | null): string | null => {
  if (!profilePicture) return null;
  if (profilePicture.trim() === "") return null;
  if (profilePicture.startsWith("http")) return profilePicture;
  return null;
};

const getUserInitial = (employee: Employee): string => {
  if (employee.firstName) return employee.firstName[0].toUpperCase();
  return employee.email[0].toUpperCase();
};

export default function TeamPage({ params }: PageProps) {
  const { lang } = use(params);
  const { t, ready } = useTranslation("team");
  const {
    activeRole,
    hasPermission,
    loading: roleLoading,
    isSuperAdmin,
    selectedCompanyForAdmin,
  } = useActiveRole();
  const router = useRouter();

  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);

  const hasAccess = hasPermission("company_admin");
  const pageSize = 50;

  // ✅ Memoize target company ID
  const targetCompanyId = useMemo(
    () => (isSuperAdmin ? selectedCompanyForAdmin : activeRole?.companyId),
    [isSuperAdmin, selectedCompanyForAdmin, activeRole?.companyId]
  );

  // ✅ Memoize role name getter
  const getRoleName = useCallback(
    (role: string): string => {
      return t(`roles.${role}`, { defaultValue: role.replace("_", " ") });
    },
    [t]
  );

  // ✅ Memoize available roles calculation
  const availableRoles = useMemo((): RoleInfo[] => {
    const roleCounts = allEmployees.reduce((acc, emp) => {
      acc[emp.role] = (acc[emp.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(roleCounts)
      .map(([role, count]) => ({
        role,
        count,
      }))
      .sort((a, b) => b.count - a.count); // ✅ Sort by count for better UX
  }, [allEmployees]);

  // ✅ Memoize total count
  const totalAllCount = useMemo(
    () => availableRoles.reduce((sum, r) => sum + r.count, 0),
    [availableRoles]
  );

  // ✅ Memoize filtered employees
  const filteredEmployees = useMemo((): Employee[] => {
    if (selectedRole === "all") {
      return allEmployees;
    }
    return allEmployees.filter((emp) => emp.role === selectedRole);
  }, [allEmployees, selectedRole]);

  // ✅ Memoize pagination calculations
  const totalCount = filteredEmployees.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  // ✅ Memoize paginated employees
  const paginatedEmployees = useMemo((): Employee[] => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredEmployees.slice(startIndex, endIndex);
  }, [filteredEmployees, currentPage, pageSize]);

  // ✅ Load employees once on mount
  useEffect(() => {
    async function loadEmployees(): Promise<void> {
      if (!targetCompanyId || targetCompanyId <= 0) return;

      setLoading(true);
      try {
        const users = await getCompanyUsers(targetCompanyId);
        setAllEmployees(users);
      } catch (error) {
        console.error("Error loading employees:", error);
      } finally {
        setLoading(false);
      }
    }

    if (hasAccess && !roleLoading && targetCompanyId) {
      loadEmployees();
    }
  }, [targetCompanyId, hasAccess, roleLoading]);

  // ✅ Memoize handlers
  const handleRoleChange = useCallback((role: string): void => {
    setSelectedRole(role);
    setCurrentPage(1);
  }, []);

  const handleEditUser = useCallback((employee: Employee): void => {
    setSelectedUser(employee);
    setEditDialogOpen(true);
  }, []);

  const refreshEmployees = useCallback(async (): Promise<void> => {
    if (targetCompanyId && targetCompanyId > 0) {
      try {
        const users = await getCompanyUsers(targetCompanyId);
        setAllEmployees(users);
      } catch (error) {
        console.error("Error refreshing employees:", error);
      }
    }
  }, [targetCompanyId]);

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  // ✅ Access control
  useEffect(() => {
    if (!hasAccess && !roleLoading) {
      router.push(`/${lang}/dashboard`);
    }
  }, [hasAccess, router, lang, roleLoading]);

  // ✅ Loading state
  if (!ready || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
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
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t("pagination.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
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
