// app/[lang]/dashboard/calendar/StaffingModal.tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, AlertCircle, X, Mail, UserMinus } from "lucide-react";
import { getCompanyUsers } from "@/lib/company-users";
import {
  fetchRemainingShifts,
  calculateAllEmployeesAvailability,
  calculateShiftCapacity,
  fetchShiftAssignments,
  assignStaffToShifts,
  cancelStaffAssignment,
  type EmployeeAvailability,
  type Shift,
  type Employee,
} from "./staffing-utils";
import { ProfileAvatar } from "./ProfileAvatar";
interface StaffingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: number;
  position: string;
  companyId: number;
  onSave: () => void;
  singleShiftMode?: boolean;
  singleShiftData?: {
    id: number;
    shift_date: string;
    start_time: string;
    end_time: string;
    workers_needed: number;
  };
  applyToRemaining?: boolean;
  startFromShiftId?: number; // ✅ NEW: Optional shift ID to start from
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as Record<string, unknown>).message);
  }
  return "An unknown error occurred";
};

const getCancellationReasonLabel = (
  reason: string | null,
  t: (key: string) => string
): string => {
  if (!reason) return t("staffing.cancelReasons.unknown");

  const reasonKey = `staffing.cancelReasons.${reason}`;
  const translated = t(reasonKey);

  return translated !== reasonKey ? translated : reason;
};

export function StaffingModal({
  open,
  onOpenChange,
  jobId,
  position,
  companyId,
  onSave,
  singleShiftMode = false,
  singleShiftData,
  applyToRemaining = false,
  startFromShiftId, // ✅ NEW: Add to destructuring
}: StaffingModalProps) {
  const { t } = useTranslation("jobs");
  const { activeRole } = useActiveRole();
  const supabase = createClient();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<number>>(
    new Set()
  );
  const [selectedForRemoval, setSelectedForRemoval] = useState<
    Map<number, number[]>
  >(new Map());

  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sendingInvites, setSendingInvites] = useState(false);

  const [shiftsToUse, setShiftsToUse] = useState<Shift[]>([]);
  const [employeeAvailabilities, setEmployeeAvailabilities] = useState<
    EmployeeAvailability[]
  >([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [shiftCapacity, setShiftCapacity] = useState({
    total: 0,
    filled: 0,
    remaining: 0,
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    employeesToRemove: Array<{ employee: Employee; shiftIds: number[] }>;
  }>({
    open: false,
    employeesToRemove: [],
  });

  useEffect(() => {
    if (open) {
      loadStaffingData();
    } else {
      setSelectedEmployees(new Set());
      setSelectedForRemoval(new Map());
      setSearchTerm("");
      setConfirmDialog({ open: false, employeesToRemove: [] });
    }
  }, [open, applyToRemaining]);

  const loadStaffingData = async () => {
    setLoadingEmployees(true);
    setLoadingAvailability(true);

    try {
      const users = await getCompanyUsers(companyId);
      setEmployees(users);
      setSelectedEmployees(new Set());
      setSelectedForRemoval(new Map());
      setSearchTerm("");

      let shifts: Shift[];

      if (singleShiftMode && singleShiftData && !applyToRemaining) {
        // Single shift mode
        shifts = [
          {
            id: singleShiftData.id,
            job_id: jobId,
            shift_date: singleShiftData.shift_date,
            start_time: singleShiftData.start_time,
            end_time: singleShiftData.end_time,
            workers_needed: singleShiftData.workers_needed,
          },
        ];
      } else {
        // Job mode or apply to remaining
        const allRemainingShifts = await fetchRemainingShifts(supabase, jobId);

        // ✅ NEW: If startFromShiftId is provided, filter to only include that shift and later ones
        if (startFromShiftId) {
          // Find the current shift to get its date and time
          const currentShift = allRemainingShifts.find(
            (s) => s.id === startFromShiftId
          );

          if (currentShift) {
            // Filter shifts that are on or after the current shift
            shifts = allRemainingShifts.filter((s) => {
              // Compare dates first
              if (s.shift_date > currentShift.shift_date) return true;
              if (s.shift_date < currentShift.shift_date) return false;

              // Same date - compare by ID to maintain order
              return s.id >= currentShift.id;
            });
          } else {
            shifts = allRemainingShifts;
          }
        } else {
          shifts = allRemainingShifts;
        }
      }

      setShiftsToUse(shifts);

      if (shifts.length === 0) {
        setLoadingAvailability(false);
        setLoadingEmployees(false);
        toast.error(t("staffingToast.noRemainingShifts"));
        return;
      }

      const shiftIds = shifts.map((s) => s.id);
      const assignmentsMap = await fetchShiftAssignments(supabase, shiftIds);
      const capacity = calculateShiftCapacity(shifts, assignmentsMap);
      setShiftCapacity(capacity);

      const availabilities = await calculateAllEmployeesAvailability(
        supabase,
        users,
        shifts
      );
      setEmployeeAvailabilities(availabilities);
    } catch (error) {
      console.error("Failed to load staffing data:", error);
      toast.error(t("staffingToast.loadStaffingFailed"));
    } finally {
      setLoadingEmployees(false);
      setLoadingAvailability(false);
    }
  };

  const toggleEmployee = (userId: number) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedEmployees(newSelected);
  };

  const toggleEmployeeForRemoval = (userId: number, shiftIds: number[]) => {
    const newSelectedForRemoval = new Map(selectedForRemoval);
    if (newSelectedForRemoval.has(userId)) {
      newSelectedForRemoval.delete(userId);
    } else {
      newSelectedForRemoval.set(userId, shiftIds);
    }
    setSelectedForRemoval(newSelectedForRemoval);
  };

  const handleBulkRemoveClick = () => {
    const employeesToRemove = Array.from(selectedForRemoval.entries()).map(
      ([userId, shiftIds]) => {
        const employee = employees.find((e) => e.userId === userId)!;
        return { employee, shiftIds };
      }
    );

    setConfirmDialog({
      open: true,
      employeesToRemove,
    });
  };

  const handleConfirmBulkRemove = async () => {
    if (!activeRole?.id) return;

    const { employeesToRemove } = confirmDialog;
    let totalRemoved = 0;
    const errors: string[] = [];

    setSendingInvites(true);

    try {
      for (const { employee, shiftIds } of employeesToRemove) {
        const result = await cancelStaffAssignment(
          supabase,
          employee.userId,
          shiftIds,
          activeRole.id,
          "admin_decision"
        );

        if (result.success) {
          totalRemoved += result.cancelled;
        } else {
          const employeeName =
            employee.firstName && employee.lastName
              ? `${employee.firstName} ${employee.lastName}`
              : employee.email;
          errors.push(`${employeeName}: ${result.error}`);
        }
      }

      if (totalRemoved > 0) {
        toast.success(
          t("staffingToast.bulkRemoveSuccess", {
            count: totalRemoved,
            employees: employeesToRemove.length,
          })
        );
      }

      if (errors.length > 0) {
        toast.error(t("staffingToast.bulkRemoveErrors"), {
          description: errors.slice(0, 3).join(", "),
        });
      }

      await loadStaffingData();
      onSave();
    } catch (error) {
      console.error("Error removing staff:", error);
      toast.error(t("staffingToast.removeFailed", { error: "Unknown error" }));
    } finally {
      setSendingInvites(false);
      setConfirmDialog({ open: false, employeesToRemove: [] });
    }
  };

  const handleSendInvites = async () => {
    if (selectedEmployees.size === 0) {
      toast.error(t("staffingToast.selectEmployee"));
      return;
    }

    setSendingInvites(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const { data: userData } = await supabase
        .from("user")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!userData) {
        toast.error("User not found");
        return;
      }

      const now = new Date().toISOString();

      const invitations = [];
      for (const userId of Array.from(selectedEmployees)) {
        const userAvailability = employeeAvailabilities.find(
          (a) => a.employee.userId === userId
        );

        const availableShiftIds = shiftsToUse
          .filter((shift) => {
            if (userAvailability?.assignedShiftIds.includes(shift.id)) {
              return false;
            }
            const hasConflict = userAvailability?.conflictDetails.some(
              (detail) => detail.includes(shift.shift_date)
            );
            return !hasConflict;
          })
          .map((s) => s.id);

        if (availableShiftIds.length > 0) {
          invitations.push({
            job_id: jobId,
            user_id: userId,
            invited_by: userData.id,
            shift_ids: availableShiftIds,
            status: "pending",
            created_at: now,
            updated_at: now,
          });
        }
      }

      if (invitations.length === 0) {
        toast.error(t("staffingToast.noAvailableShifts"));
        setSendingInvites(false);
        return;
      }

      const { error } = await supabase
        .from("job_invitation")
        .insert(invitations);

      if (error) throw error;

      toast.success(
        t("staffingToast.invitationsSent", { count: invitations.length }),
        {
          description: t("staffingToast.invitationsDescription"),
        }
      );

      setSelectedEmployees(new Set());
      await loadStaffingData();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("❌ Error sending invitations:", errorMessage);
      toast.error(
        t("staffingToast.invitationsFailed", { error: errorMessage })
      );
    } finally {
      setSendingInvites(false);
    }
  };

  const handleAssignStaff = async () => {
    if (selectedEmployees.size === 0) {
      toast.error(t("staffingToast.selectEmployee"));
      return;
    }

    if (!activeRole?.id) {
      toast.error(t("staffingToast.invalidJob"));
      return;
    }

    if (shiftsToUse.length === 0) {
      toast.error(t("staffingToast.noShifts"));
      return;
    }

    if (shiftCapacity.remaining === 0) {
      toast.error(t("staffingToast.allShiftsFull"));
      return;
    }

    toast.info(
      t("staffingToast.assigningInfo", { count: selectedEmployees.size }),
      {
        description: t("staffingToast.assigningDescription"),
        duration: 3000,
      }
    );

    setSendingInvites(true);

    try {
      const selectedUserIds = Array.from(selectedEmployees);

      const result = await assignStaffToShifts(
        supabase,
        selectedUserIds,
        shiftsToUse,
        activeRole.id,
        employeeAvailabilities
      );

      if (result.success > 0) {
        toast.success(
          t("staffingToast.assignSuccess", {
            assigned: result.success,
            employees: result.details.length,
          }),
          {
            description: result.details.slice(0, 3).join(", "),
            duration: 5000,
          }
        );

        if (result.reactivated > 0) {
          toast.info(
            t("staffingToast.reactivatedInfo", {
              count: result.reactivated,
            }),
            { duration: 4000 }
          );
        }
      }

      if (result.skipped > 0 && result.success === 0) {
        toast.warning(t("staffingToast.noAssignments"), {
          description: t("staffingToast.noAssignmentsDescription"),
          duration: 6000,
        });
      }

      setSelectedEmployees(new Set());
      await loadStaffingData();
      onSave();
    } catch (error) {
      console.error("Error assigning staff:", error);
      toast.error(t("staffingToast.assignFailed"));
    } finally {
      setSendingInvites(false);
    }
  };

  const filteredAvailabilities = employeeAvailabilities.filter((avail) => {
    const fullName = `${avail.employee.firstName || ""} ${
      avail.employee.lastName || ""
    }`.toLowerCase();
    const email = avail.employee.email.toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  const modalTitle =
    singleShiftMode && !applyToRemaining
      ? t("staffing.titleSingleShift", { position: position || "Untitled" })
      : t("staffing.title", { position: position || "Untitled" });

  const modalDescription =
    singleShiftMode && !applyToRemaining
      ? t("staffing.descriptionSingleShift")
      : t("staffing.description");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
        <DialogContent
          className="max-w-3xl h-[75vh] flex flex-col"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex-shrink-0 pb-3">
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription className="text-xs">
              {modalDescription}
            </DialogDescription>
          </DialogHeader>

          {loadingEmployees || loadingAvailability ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t("staffing.loadingEmployees")}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                <div className="flex-shrink-0 p-2 bg-muted rounded-lg flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">
                      {t("staffing.capacity")}{" "}
                    </span>
                    <span className="text-primary font-bold">
                      {shiftCapacity.filled}/{shiftCapacity.total}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("staffing.shiftsAndPositions", {
                      shifts: shiftsToUse.length,
                      positions: shiftCapacity.remaining,
                    })}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("staffing.searchPlaceholder")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0 border rounded-lg">
                  <div className="h-full overflow-y-auto p-3">
                    <div className="space-y-1.5">
                      {filteredAvailabilities.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          {t("staffing.noEmployeesFound")}
                        </div>
                      ) : (
                        filteredAvailabilities.map((avail) => {
                          const isFullyAssigned = avail.isFullyAssigned;
                          const hasAssignments = avail.alreadyAssigned > 0;
                          const hasPendingInvitations =
                            avail.pendingInvitations.length > 0;
                          const isSelectedForRemoval = selectedForRemoval.has(
                            avail.employee.userId
                          );

                          return (
                            <div
                              key={avail.employee.userId}
                              className={`flex items-start gap-2 p-2 rounded transition-colors hover:bg-muted ${
                                avail.hasCancelledBefore
                                  ? "border border-orange-200 bg-orange-50/50 dark:bg-orange-950/10"
                                  : ""
                              } ${
                                isSelectedForRemoval
                                  ? "bg-red-50 border-red-200 dark:bg-red-950/20"
                                  : ""
                              }`}
                            >
                              {hasAssignments ? (
                                <Checkbox
                                  checked={isSelectedForRemoval}
                                  onCheckedChange={() =>
                                    toggleEmployeeForRemoval(
                                      avail.employee.userId,
                                      avail.assignedShiftIds
                                    )
                                  }
                                  className="mt-0.5 border-red-500 data-[state=checked]:bg-red-500"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <Checkbox
                                  checked={selectedEmployees.has(
                                    avail.employee.userId
                                  )}
                                  onCheckedChange={() => {
                                    toggleEmployee(avail.employee.userId);
                                  }}
                                  className="mt-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              {/* ✅ NEW: Profile Picture */}
                              <ProfileAvatar
                                firstName={avail.employee.firstName}
                                lastName={avail.employee.lastName}
                                email={avail.employee.email}
                                profilePicture={avail.employee.profilePicture}
                                size="md"
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="text-sm font-medium">
                                    {avail.employee.firstName &&
                                    avail.employee.lastName
                                      ? `${avail.employee.firstName} ${avail.employee.lastName}`
                                      : avail.employee.email}
                                  </div>
                                  {avail.hasCancelledBefore && (
                                    <Badge
                                      variant="outline"
                                      className="bg-orange-100 text-orange-700 border-orange-300 text-xs"
                                    >
                                      <AlertCircle className="w-3 h-3 mr-1" />
                                      {t("staffing.cancelledBefore")}
                                    </Badge>
                                  )}
                                  {hasPendingInvitations && (
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-100 text-blue-700 border-blue-300 text-xs"
                                    >
                                      <Mail className="w-3 h-3 mr-1" />
                                      {t("staffing.pendingInvitation")}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {avail.employee.email}
                                </div>

                                {avail.cancellationHistory.length > 0 && (
                                  <div className="mt-1 max-h-16 overflow-y-auto space-y-0.5 pr-1">
                                    {avail.cancellationHistory.map(
                                      (cancel, idx) => (
                                        <div
                                          key={idx}
                                          className="text-xs text-orange-600 dark:text-orange-400"
                                        >
                                          {t("staffing.cancelledCount", {
                                            count: cancel.cancelCount,
                                          })}
                                          :{" "}
                                          {getCancellationReasonLabel(
                                            cancel.cancellationReason,
                                            t
                                          )}
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                                {isFullyAssigned ? (
                                  <div className="text-xs text-green-600 mt-0.5">
                                    {t("staffing.assignedToAll", {
                                      total: avail.total,
                                    })}
                                  </div>
                                ) : avail.isUnavailable ? (
                                  <div className="text-xs text-orange-600 mt-0.5">
                                    {t("staffing.unavailableConflicts")}
                                  </div>
                                ) : (
                                  <div className="text-xs mt-0.5">
                                    <span
                                      className={`font-medium ${
                                        avail.available === avail.total
                                          ? "text-green-600"
                                          : "text-orange-600"
                                      }`}
                                    >
                                      {t("staffing.shiftsAvailable", {
                                        available: avail.available,
                                        total: avail.total,
                                      })}
                                    </span>
                                    {avail.alreadyAssigned > 0 && (
                                      <span className="text-muted-foreground ml-1">
                                        {t("staffing.alreadyAssigned", {
                                          count: avail.alreadyAssigned,
                                        })}
                                      </span>
                                    )}
                                    {avail.conflicts > 0 && (
                                      <span className="text-orange-600 ml-1">
                                        {t("staffing.conflicts", {
                                          count: avail.conflicts,
                                        })}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {hasAssignments && (
                                <Button
                                  variant="outline"
                                  size="default"
                                  className="h-9 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 flex-shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEmployeeForRemoval(
                                      avail.employee.userId,
                                      avail.assignedShiftIds
                                    );
                                  }}
                                >
                                  <X className="w-4 h-4 mr-1.5" />
                                  {t("staffing.confirmRemoveButton")}
                                </Button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center justify-between text-sm">
                  {selectedForRemoval.size > 0 ? (
                    <span className="text-red-600 font-medium">
                      {t("staffing.selectedForRemoval", {
                        count: selectedForRemoval.size,
                      })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("staffing.employeesSelected", {
                        count: selectedEmployees.size,
                      })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex gap-2 justify-end pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChange(false);
                  }}
                >
                  {t("staffing.closeButton")}
                </Button>

                {selectedForRemoval.size > 0 ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBulkRemoveClick();
                    }}
                    disabled={sendingInvites}
                  >
                    <UserMinus className="w-4 h-4 mr-1.5" />
                    {t("staffing.removeSelectedButton", {
                      count: selectedForRemoval.size,
                    })}
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendInvites();
                      }}
                      disabled={selectedEmployees.size === 0 || sendingInvites}
                    >
                      {sendingInvites
                        ? t("staffing.sending")
                        : t("staffing.sendInvitationsButton")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAssignStaff();
                      }}
                      disabled={
                        selectedEmployees.size === 0 ||
                        sendingInvites ||
                        loadingAvailability ||
                        shiftCapacity.remaining === 0
                      }
                      className="bg-primary hover:bg-primary/90"
                      title={
                        shiftCapacity.remaining === 0
                          ? t("staffing.allShiftsFull")
                          : t("staffing.assignTooltip")
                      }
                    >
                      {sendingInvites
                        ? t("staffing.assigning")
                        : t("staffing.assignToShiftsButton")}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog({
              open: false,
              employeesToRemove: [],
            });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("staffing.confirmBulkRemoveTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("staffing.confirmBulkRemoveDescription", {
                count: confirmDialog.employeesToRemove.length,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto border rounded-md p-3 bg-muted/50">
            {confirmDialog.employeesToRemove.map(({ employee, shiftIds }) => (
              <div
                key={employee.userId}
                className="text-sm font-medium text-foreground"
              >
                •{" "}
                {employee.firstName && employee.lastName
                  ? `${employee.firstName} ${employee.lastName}`
                  : employee.email}{" "}
                <span className="text-muted-foreground">
                  ({shiftIds.length}{" "}
                  {shiftIds.length === 1
                    ? t("staffing.shift")
                    : t("staffing.shifts")}
                  )
                </span>
              </div>
            ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t("staffing.cancelButton")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkRemove}
              className="bg-red-600 hover:bg-red-700"
              disabled={sendingInvites}
            >
              {sendingInvites
                ? t("staffing.removing")
                : t("staffing.confirmRemoveButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
