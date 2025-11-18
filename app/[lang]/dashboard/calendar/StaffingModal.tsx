//hype-hire/vercel/app/[lang]/dashboard/calendar/StaffingModal.tsx
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { getCompanyUsers } from "@/lib/company-users";
import {
  fetchRemainingShifts,
  calculateAllEmployeesAvailability,
  calculateShiftCapacity,
  fetchShiftAssignments,
  type EmployeeAvailability,
  type Shift,
  type Employee,
} from "./staffing-utils";

interface Job {
  id: number;
  company_id: number;
  position: string;
  seniority: "junior" | "senior";
  description: string | null;
  start_date: string;
  end_date: string;
  location_id: number | null;
  created_at: string;
  created_by: number;
  deleted_at: string | null;
  deleted_by: number | null;
}

interface StaffingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  position: string;
  companyId: number;
  onSave: () => void;
  // ✅ NEW: Optional single shift mode
  singleShiftMode?: boolean;
  specificShiftId?: number;
  applyToRemaining?: boolean;
}


const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as Record<string, unknown>).message);
  }
  return "An unknown error occurred";
};

export function StaffingModal({
  open,
  onOpenChange,
  job,
  position,
  companyId,
  onSave,
}: StaffingModalProps) {
  const { t } = useTranslation("jobs");
  const { activeRole } = useActiveRole();
  const supabase = createClient();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<number>>(
    new Set()
  );
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sendingInvites, setSendingInvites] = useState(false);

  const [remainingShifts, setRemainingShifts] = useState<Shift[]>([]);
  const [employeeAvailabilities, setEmployeeAvailabilities] = useState<
    EmployeeAvailability[]
  >([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [shiftCapacity, setShiftCapacity] = useState({
    total: 0,
    filled: 0,
    remaining: 0,
  });

  useEffect(() => {
    if (open) {
      loadStaffingData();
    } else {
      setSelectedEmployees(new Set());
      setSearchTerm("");
    }
  }, [open]);

  const loadStaffingData = async () => {
    setLoadingEmployees(true);
    setLoadingAvailability(true);

    try {
      const users = await getCompanyUsers(companyId);
      setEmployees(users);
      setSelectedEmployees(new Set());
      setSearchTerm("");

      const shifts = await fetchRemainingShifts(supabase, job.id);
      setRemainingShifts(shifts);

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

const handleSendInvites = async () => {
  if (selectedEmployees.size === 0) {
    toast.error(t("staffingToast.selectEmployee"));
    return;
  }

  setSendingInvites(true);

  try {
    // Get the admin's user_id
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

    // Get remaining shifts for the job
    const now = new Date().toISOString().split("T")[0];
    const { data: shifts } = await supabase
      .from("shift")
      .select("id")
      .eq("job_id", job.id)
      .gte("shift_date", now)
      .is("deleted_at", null);

    if (!shifts || shifts.length === 0) {
      toast.error("No available shifts");
      return;
    }

    const shiftIds = shifts.map((s) => s.id);

    // Create invitations for each selected employee
    const invitations = Array.from(selectedEmployees).map((userId) => ({
      job_id: job.id,
      user_id: userId,
      invited_by: userData.id,
      shift_ids: shiftIds,
      status: "pending",
    }));

    const { error } = await supabase.from("job_invitation").insert(invitations);

    if (error) throw error;

    toast.success(
      t("staffingToast.invitationsSent", { count: selectedEmployees.size }),
      {
        description: t("staffingToast.invitationsDescription"),
      }
    );

    onOpenChange(false);
    setSelectedEmployees(new Set());
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("❌ Error sending invitations:", errorMessage);
    toast.error(t("staffingToast.invitationsFailed", { error: errorMessage }));
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

    if (remainingShifts.length === 0) {
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
      const now = new Date().toISOString();

      let totalAssigned = 0;
      let totalSkipped = 0;
      const assignmentDetails: string[] = [];
      const skippedReasons: Record<string, number> = {
        conflict: 0,
        full: 0,
        alreadyAssigned: 0,
      };

      const fetchCurrentAssignments = async () => {
        const shiftIds = remainingShifts.map((s) => s.id);
        const { data: existingAssignments } = await supabase
          .from("shift_assignment")
          .select("shift_id, user_id")
          .in("shift_id", shiftIds)
          .is("cancelled_at", null)
          .is("deleted_at", null);

        const assignmentsByShift: Record<number, number> = {};
        const userAssignedShifts: Record<number, Set<number>> = {};

        existingAssignments?.forEach((a) => {
          assignmentsByShift[a.shift_id] =
            (assignmentsByShift[a.shift_id] || 0) + 1;

          if (!userAssignedShifts[a.user_id]) {
            userAssignedShifts[a.user_id] = new Set();
          }
          userAssignedShifts[a.user_id].add(a.shift_id);
        });

        return { assignmentsByShift, userAssignedShifts };
      };

      const { assignmentsByShift, userAssignedShifts } =
        await fetchCurrentAssignments();

      for (const userId of selectedUserIds) {
        const availability = employeeAvailabilities.find(
          (a) => a.employee.userId === userId
        );

        if (!availability) continue;

        let userAssignedCount = 0;

        for (const shift of remainingShifts) {
          const currentAssignments = assignmentsByShift[shift.id] || 0;

          if (currentAssignments >= shift.workers_needed) {
            skippedReasons.full++;
            totalSkipped++;
            continue;
          }

          if (userAssignedShifts[userId]?.has(shift.id)) {
            skippedReasons.alreadyAssigned++;
            totalSkipped++;
            continue;
          }

          const hasConflict = await checkTimeConflict(
            supabase,
            userId,
            shift.id,
            shift.shift_date,
            shift.start_time,
            shift.end_time
          );

          if (hasConflict) {
            skippedReasons.conflict++;
            totalSkipped++;
            continue;
          }

          const { error: assignError } = await supabase
            .from("shift_assignment")
            .insert({
              shift_id: shift.id,
              user_id: userId,
              assigned_by: activeRole.id,
              assigned_at: now,
            });

          if (!assignError) {
            totalAssigned++;
            userAssignedCount++;

            assignmentsByShift[shift.id] =
              (assignmentsByShift[shift.id] || 0) + 1;

            if (!userAssignedShifts[userId]) {
              userAssignedShifts[userId] = new Set();
            }
            userAssignedShifts[userId].add(shift.id);
          } else {
            console.error("Assignment error:", assignError);
            totalSkipped++;
          }
        }

        if (userAssignedCount > 0) {
          const employeeName =
            availability.employee.firstName && availability.employee.lastName
              ? `${availability.employee.firstName} ${availability.employee.lastName}`
              : availability.employee.email;

          assignmentDetails.push(
            `${employeeName}: ${userAssignedCount} ${t("card.shifts")}`
          );
        }
      }

      // ✅ Translated success/info messages
      if (totalAssigned > 0) {
        toast.success(
          t("staffingToast.assignSuccess", {
            assigned: totalAssigned,
            employees: assignmentDetails.length,
          }),
          {
            description: assignmentDetails.slice(0, 3).join(", "),
            duration: 5000,
          }
        );
      }

      if (totalSkipped > 0) {
        const skipDetails = [];
        if (skippedReasons.full > 0)
          skipDetails.push(
            t("staffingToast.skipDetailsFull", { count: skippedReasons.full })
          );
        if (skippedReasons.conflict > 0)
          skipDetails.push(
            t("staffingToast.skipDetailsConflicts", {
              count: skippedReasons.conflict,
            })
          );
        if (skippedReasons.alreadyAssigned > 0)
          skipDetails.push(
            t("staffingToast.skipDetailsAlreadyAssigned", {
              count: skippedReasons.alreadyAssigned,
            })
          );

        toast.info(
          t("staffingToast.assignmentSkipped", { count: totalSkipped }),
          {
            description: skipDetails.join(", "),
            duration: 4000,
          }
        );
      }

      if (totalAssigned === 0 && totalSkipped > 0) {
        toast.warning(t("staffingToast.noAssignments"), {
          description: t("staffingToast.noAssignmentsDescription"),
          duration: 6000,
        });
      }

      onOpenChange(false);
      setSelectedEmployees(new Set());
      onSave();
    } catch (error) {
      console.error("Error assigning staff:", error);
      toast.error(t("staffingToast.assignFailed"));
    } finally {
      setSendingInvites(false);
    }
  };

  const checkTimeConflict = async (
    supabase: ReturnType<typeof createClient>,
    userId: number,
    excludeShiftId: number,
    shiftDate: string,
    shiftStartTime: string,
    shiftEndTime: string
  ): Promise<boolean> => {
    const { data: otherShifts } = await supabase
      .from("shift_assignment")
      .select(
        `
        shift:shift_id (
          id,
          shift_date,
          start_time,
          end_time
        )
      `
      )
      .eq("user_id", userId)
      .is("cancelled_at", null)
      .is("deleted_at", null);

    if (!otherShifts || otherShifts.length === 0) return false;

    for (const assignment of otherShifts) {
      const otherShift = assignment.shift as unknown as {
        id: number;
        shift_date: string;
        start_time: string;
        end_time: string;
      };

      if (!otherShift || otherShift.id === excludeShiftId) continue;

      if (otherShift.shift_date === shiftDate) {
        const hasTimeOverlap = !(
          shiftEndTime <= otherShift.start_time ||
          shiftStartTime >= otherShift.end_time
        );

        if (hasTimeOverlap) return true;
      }
    }

    return false;
  };

  const filteredAvailabilities = employeeAvailabilities.filter((avail) => {
    const fullName = `${avail.employee.firstName || ""} ${
      avail.employee.lastName || ""
    }`.toLowerCase();
    const email = avail.employee.email.toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent
        className="max-w-3xl h-[75vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0 pb-3">
          <DialogTitle>
            {t("staffing.title", { position: position || "Untitled" })}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("staffing.description")}
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
              {/* Capacity Display */}
              <div className="flex-shrink-0 p-2 bg-muted rounded-lg flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{t("staffing.capacity")} </span>
                  <span className="text-primary font-bold">
                    {shiftCapacity.filled}/{shiftCapacity.total}
                  </span>
                </div>
                <div className="text-muted-foreground text-xs">
                  {t("staffing.shiftsAndPositions", {
                    shifts: remainingShifts.length,
                    positions: shiftCapacity.remaining,
                  })}
                </div>
              </div>

              {/* Search */}
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

              {/* Employee List */}
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

                        return (
                          <div
                            key={avail.employee.userId}
                            className={`flex items-start space-x-2 p-2 rounded transition-colors hover:bg-muted cursor-pointer`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleEmployee(avail.employee.userId);
                            }}
                          >
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
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">
                                {avail.employee.firstName &&
                                avail.employee.lastName
                                  ? `${avail.employee.firstName} ${avail.employee.lastName}`
                                  : avail.employee.email}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {avail.employee.email}
                              </div>

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
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Selected Count */}
              <div className="flex-shrink-0 text-sm text-muted-foreground">
                {t("staffing.employeesSelected", {
                  count: selectedEmployees.size,
                })}
              </div>
            </div>

            {/* Footer Buttons */}
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
                {t("staffing.cancelButton")}
              </Button>
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
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
