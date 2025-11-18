//hype-hire/vercel/app/[lang]/dashboard/calendar/ShiftEditDialog.tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle,
  Info,
  Users,
  Search,
  X as XIcon,
  XCircle,
  Loader2,
} from "lucide-react";
import { TimePickerSelect } from "@/components/TimePickerSelect";
import {
  fetchAssignedStaffForShift,
  fetchRemainingShifts,
  calculateAllEmployeesAvailability,
  removeStaffFromShifts,
  type Employee as StaffEmployee,
  type EmployeeAvailability,
} from "./staffing-utils";
import { getCompanyUsers } from "@/lib/company-users";

interface ShiftEditDialogProps {
  shift: {
    id: number;
    job_id: number;
    shift_date: string;
    start_time: string;
    end_time: string;
    workers_needed: number;
    position: string;
  };
  assignmentCount: number;
  onSave: () => void;
  onCancel: () => void;
}

type AdminCancellationReason =
  | "other_job"
  | "personal"
  | "sick"
  | "accident"
  | "bad_performance"
  | "day_off"
  | "admin_decision";

export function ShiftEditDialog({
  shift,
  assignmentCount,
  onSave,
  onCancel,
}: ShiftEditDialogProps) {
  const { t, i18n } = useTranslation("jobs");

  const isShiftInPast = () => {
    const now = new Date();
    const shiftDateTime = new Date(shift.shift_date + "T" + shift.start_time);
    return shiftDateTime < now;
  };

  const shiftIsPast = isShiftInPast();

  const formatTime = (time: string) => {
    const cleaned = time.slice(0, 5);
    const [hours, minutes] = cleaned.split(":");
    const roundedMinutes = Math.round(parseInt(minutes || "0") / 15) * 15;
    return `${hours.padStart(2, "0")}:${String(
      roundedMinutes === 60 ? 0 : roundedMinutes
    ).padStart(2, "0")}`;
  };

  const [startTime, setStartTime] = useState(formatTime(shift.start_time));
  const [endTime, setEndTime] = useState(formatTime(shift.end_time));
  const [workersNeeded, setWorkersNeeded] = useState(shift.workers_needed);
  const [applyToRestOfJob, setApplyToRestOfJob] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remainingShiftCount, setRemainingShiftCount] = useState(0);
  const supabase = createClient();

  const [loadingInitialData, setLoadingInitialData] = useState(true);

  const [originalStaff, setOriginalStaff] = useState<StaffEmployee[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffEmployee[]>([]);
  const [staffToAdd, setStaffToAdd] = useState<Set<number>>(new Set());
  const [staffToRemove, setStaffToRemove] = useState<Set<number>>(new Set());

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [allEmployees, setAllEmployees] = useState<StaffEmployee[]>([]);
  const [employeeAvailabilities, setEmployeeAvailabilities] = useState<
    EmployeeAvailability[]
  >([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<number>>(
    new Set()
  );
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffSearchTerm, setStaffSearchTerm] = useState("");
  const [companyId, setCompanyId] = useState<number>(0);
  const [sendingInvites, setSendingInvites] = useState(false);

  // Cancellation state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [staffToCancel, setStaffToCancel] = useState<{
    userId: number;
    name: string;
  } | null>(null);
  const [cancellationReason, setCancellationReason] =
    useState<AdminCancellationReason>("admin_decision");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoadingInitialData(true);

      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const today = `${year}-${month}-${day}`;

        const { count } = await supabase
          .from("shift")
          .select("*", { count: "exact", head: true })
          .eq("job_id", shift.job_id)
          .gte("shift_date", today)
          .is("deleted_at", null);

        setRemainingShiftCount(count || 0);

        const staff = await fetchAssignedStaffForShift(supabase, shift.id);
        setOriginalStaff(staff);
        setCurrentStaff(staff);

        const { data } = await supabase
          .from("job")
          .select("company_id")
          .eq("id", shift.job_id)
          .single();

        if (data) {
          setCompanyId(data.company_id);
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        toast.error(t("shiftEditToast.loadShiftFailed"));
      } finally {
        setLoadingInitialData(false);
      }
    };

    loadInitialData();
  }, [shift.id, shift.job_id, supabase, t]);

  const timeValidation = {
    isValid: endTime > startTime,
    message: t("shiftEditToast.endAfterStart"),
  };

  const workersValidation = {
    isOverstaffed: currentStaff.length > workersNeeded,
    isUnderstaffed:
      currentStaff.length < workersNeeded && currentStaff.length > 0,
    isPerfect: currentStaff.length === workersNeeded,
  };

  const handleAddStaff = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (companyId === 0) {
      toast.error(t("shiftEditToast.loadingCompany"));
      return;
    }

    setStaffModalOpen(true);
    setLoadingStaff(true);

    try {
      const employees = await getCompanyUsers(companyId);
      setAllEmployees(employees);
      setSelectedStaffIds(new Set());
      setStaffSearchTerm("");

      const shiftsToAssign = applyToRestOfJob
        ? await fetchRemainingShifts(supabase, shift.job_id)
        : [
            {
              id: shift.id,
              job_id: shift.job_id,
              shift_date: shift.shift_date,
              start_time: shift.start_time,
              end_time: shift.end_time,
              workers_needed: shift.workers_needed,
            },
          ];

      const availabilities = await calculateAllEmployeesAvailability(
        supabase,
        employees,
        shiftsToAssign
      );
      setEmployeeAvailabilities(availabilities);
    } catch (error) {
      console.error("Error loading staff data:", error);
      toast.error(t("shiftEditToast.loadEmployeesFailed"));
      setStaffModalOpen(false);
    } finally {
      setLoadingStaff(false);
    }
  };

  const toggleStaffSelection = (userId: number) => {
    const newSelected = new Set(selectedStaffIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedStaffIds(newSelected);
  };

  const handleAddSelectedStaff = () => {
    if (selectedStaffIds.size === 0) {
      toast.error(t("shiftEditToast.selectEmployee"));
      return;
    }

    const newStaffToAdd = new Set(staffToAdd);
    selectedStaffIds.forEach((id) => {
      newStaffToAdd.add(id);
      staffToRemove.delete(id);
    });
    setStaffToAdd(newStaffToAdd);

    const employeesToAdd = allEmployees.filter((emp) =>
      selectedStaffIds.has(emp.userId)
    );
    const updatedStaff = [...currentStaff];
    employeesToAdd.forEach((emp) => {
      if (!updatedStaff.find((s) => s.userId === emp.userId)) {
        updatedStaff.push(emp);
      }
    });
    setCurrentStaff(updatedStaff);

    toast.info(
      t("shiftEditToast.employeesAdded", { count: selectedStaffIds.size })
    );
    setStaffModalOpen(false);
    setSelectedStaffIds(new Set());
  };

  const handleSendInvites = async () => {
    if (selectedStaffIds.size === 0) {
      toast.error(t("shiftEditToast.selectEmployee"));
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

      let shiftIds: number[];

      if (applyToRestOfJob) {
        const remainingShifts = await fetchRemainingShifts(
          supabase,
          shift.job_id
        );
        shiftIds = remainingShifts.map((s) => s.id);
      } else {
        shiftIds = [shift.id];
      }

      const now = new Date().toISOString();

      const invitations = Array.from(selectedStaffIds).map((userId) => ({
        job_id: shift.job_id,
        user_id: userId,
        invited_by: userData.id,
        shift_ids: shiftIds,
        status: "pending",
        created_at: now,
        updated_at: now,
      }));

      const { error } = await supabase
        .from("job_invitation")
        .insert(invitations);

      if (error) throw error;

      toast.success(
        t("shiftEditToast.invitationsSent", { count: selectedStaffIds.size })
      );

      setStaffModalOpen(false);
      setSelectedStaffIds(new Set());
    } catch (error) {
      console.error("Error sending invitations:", error);
      toast.error(t("shiftEditToast.invitationsFailed"));
    } finally {
      setSendingInvites(false);
    }
  };

  const handleRemoveStaff = (
    e: React.MouseEvent,
    userId: number,
    userName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const wasOriginal = originalStaff.find((s) => s.userId === userId);
    if (wasOriginal) {
      const newStaffToRemove = new Set(staffToRemove);
      newStaffToRemove.add(userId);
      setStaffToRemove(newStaffToRemove);
    }

    const newStaffToAdd = new Set(staffToAdd);
    newStaffToAdd.delete(userId);
    setStaffToAdd(newStaffToAdd);

    const updatedStaff = currentStaff.filter((s) => s.userId !== userId);
    setCurrentStaff(updatedStaff);

    toast.info(t("shiftEditToast.staffRemoved", { name: userName }));
  };

  const handleCancelStaff = (
    e: React.MouseEvent,
    userId: number,
    userName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setStaffToCancel({ userId, name: userName });
    setCancellationReason("admin_decision");
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!staffToCancel) return;

    setCancelling(true);

    try {
      const now = new Date().toISOString();

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

      const { data: assignment } = await supabase
        .from("shift_assignment")
        .select("id")
        .eq("shift_id", shift.id)
        .eq("user_id", staffToCancel.userId)
        .is("cancelled_at", null)
        .is("deleted_at", null)
        .single();

      if (!assignment) {
        toast.error("Assignment not found");
        return;
      }

      const { error } = await supabase
        .from("shift_assignment")
        .update({
          cancelled_at: now,
          cancelled_by: userData.id,
          cancellation_reason: cancellationReason,
        })
        .eq("id", assignment.id);

      if (error) throw error;

      toast.success(
        t("shiftEdit.staffCancelled", { name: staffToCancel.name })
      );

      const updatedStaff = await fetchAssignedStaffForShift(supabase, shift.id);
      setOriginalStaff(updatedStaff);
      setCurrentStaff(updatedStaff);

      setCancelDialogOpen(false);
      setStaffToCancel(null);
    } catch (error) {
      console.error("Error cancelling staff:", error);
      toast.error(t("shiftEdit.cancelStaffFailed"));
    } finally {
      setCancelling(false);
    }
  };

  const assignStaffDirectly = async (
    userIds: number[],
    shiftIds: number[],
    adminId: number
  ) => {
    const now = new Date().toISOString();
    let successCount = 0;

    const { data: allAssignments } = await supabase
      .from("shift_assignment")
      .select("id, shift_id, user_id, deleted_at, cancelled_at")
      .in("shift_id", shiftIds)
      .in("user_id", userIds);

    const activeAssignments = new Set(
      (allAssignments || [])
        .filter((a) => !a.deleted_at && !a.cancelled_at)
        .map((a) => `${a.shift_id}-${a.user_id}`)
    );

    const deletedAssignments = new Map(
      (allAssignments || [])
        .filter((a) => a.deleted_at || a.cancelled_at)
        .map((a) => [`${a.shift_id}-${a.user_id}`, a])
    );

    for (const userId of userIds) {
      for (const shiftId of shiftIds) {
        const key = `${shiftId}-${userId}`;

        if (activeAssignments.has(key)) {
          continue;
        }

        const deletedAssignment = deletedAssignments.get(key);
        if (deletedAssignment) {
          const { error } = await supabase
            .from("shift_assignment")
            .update({
              deleted_at: null,
              cancelled_at: null,
              assigned_by: adminId,
              assigned_at: now,
            })
            .eq("id", deletedAssignment.id);

          if (!error) {
            successCount++;
          }
          continue;
        }

        const { data, error } = await supabase
          .from("shift_assignment")
          .insert({
            shift_id: shiftId,
            user_id: userId,
            assigned_by: adminId,
            assigned_at: now,
          })
          .select()
          .maybeSingle();

        if (!error && data) {
          successCount++;
        } else if (error && error.code !== "23505") {
          console.error("Error creating assignment:", error);
        }
      }
    }

    return successCount;
  };

  const handleSave = async () => {
    if (!startTime || !endTime) {
      toast.error(t("shiftEditToast.fillRequired"));
      return;
    }

    if (!timeValidation.isValid) {
      toast.error(timeValidation.message);
      return;
    }

    if (workersNeeded < 1) {
      toast.error(t("shiftEditToast.workersMin"));
      return;
    }

    const shiftDate = new Date(shift.shift_date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (shiftDate.getTime() === today.getTime()) {
      const now = new Date();
      const [hours, minutes] = startTime.split(":").map(Number);
      const shiftStartDateTime = new Date();
      shiftStartDateTime.setHours(hours, minutes, 0, 0);

      if (shiftStartDateTime < now) {
        toast.error(t("shiftEditToast.pastTime"));
        return;
      }
    }

    if (workersNeeded < currentStaff.length && !applyToRestOfJob) {
      if (
        !confirm(
          t("shiftEditToast.overstaffedConfirm", {
            assigned: currentStaff.length,
            needed: workersNeeded,
          })
        )
      ) {
        return;
      }
    }

    setSaving(true);

    try {
      if (applyToRestOfJob) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const todayStr = `${year}-${month}-${day}`;

        const { error } = await supabase
          .from("shift")
          .update({
            start_time: startTime + ":00",
            end_time: endTime + ":00",
            workers_needed: workersNeeded,
          })
          .eq("job_id", shift.job_id)
          .gte("shift_date", todayStr)
          .is("deleted_at", null);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("shift")
          .update({
            start_time: startTime + ":00",
            end_time: endTime + ":00",
            workers_needed: workersNeeded,
          })
          .eq("id", shift.id);

        if (error) throw error;
      }

      const shiftsToModify = applyToRestOfJob
        ? (await fetchRemainingShifts(supabase, shift.job_id)).map((s) => s.id)
        : [shift.id];

      if (staffToRemove.size > 0) {
        for (const userId of staffToRemove) {
          await removeStaffFromShifts(supabase, userId, shiftsToModify);
        }
      }

      if (staffToAdd.size > 0) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          toast.error(t("shiftEditToast.userNotAuthenticated"));
          setSaving(false);
          return;
        }

        let adminUserId: number | null = null;

        const { data: userData1 } = await supabase
          .from("user")
          .select("id")
          .eq("auth_user_id", authUser.id)
          .single();

        if (userData1) {
          adminUserId = userData1.id;
        }

        if (!adminUserId) {
          const { data: userData2 } = await supabase
            .from("user")
            .select("id")
            .eq("supabase_user_id", authUser.id)
            .single();

          if (userData2) {
            adminUserId = userData2.id;
          }
        }

        if (!adminUserId) {
          const { data: roleData } = await supabase
            .from("user_role")
            .select("user_id")
            .eq("company_id", companyId)
            .limit(1)
            .single();

          if (roleData) {
            adminUserId = roleData.user_id;
          }
        }

        if (!adminUserId) {
          toast.error(t("shiftEditToast.userDataNotFound"));
        } else {
          const assignedCount = await assignStaffDirectly(
            Array.from(staffToAdd),
            shiftsToModify,
            adminUserId
          );

          if (assignedCount > 0) {
            toast.success(
              t("shiftEditToast.staffAssigned", {
                staffCount: staffToAdd.size,
                shiftCount: shiftsToModify.length,
              })
            );
          }
        }
      }

      const updatedStaff = await fetchAssignedStaffForShift(supabase, shift.id);
      setOriginalStaff(updatedStaff);
      setCurrentStaff(updatedStaff);
      setStaffToAdd(new Set());
      setStaffToRemove(new Set());

      const message = applyToRestOfJob
        ? t("shiftEditToast.updateSuccess", { count: remainingShiftCount })
        : t("shiftEditToast.shiftUpdated");

      toast.success(message);

      onSave();
    } catch (error) {
      console.error("Error updating shift:", error);
      toast.error(t("shiftEditToast.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    const staffInfo =
      currentStaff.length > 0
        ? t("shiftEditToast.staffNotified", { count: currentStaff.length })
        : "";

    if (!confirm(t("shiftEditToast.cancelConfirm", { staffInfo }))) {
      return;
    }

    setSaving(true);

    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const todayStr = `${year}-${month}-${day}`;
      const nowIso = now.toISOString();

      const { data: remainingShifts, count: remainingCount } = await supabase
        .from("shift")
        .select("id", { count: "exact" })
        .eq("job_id", shift.job_id)
        .gte("shift_date", todayStr)
        .is("deleted_at", null);

      const isLastShift =
        remainingCount === 1 && remainingShifts?.[0]?.id === shift.id;

      const { error: shiftError } = await supabase
        .from("shift")
        .update({
          deleted_at: nowIso,
        })
        .eq("id", shift.id);

      if (shiftError) throw shiftError;

      if (isLastShift) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        let deletedByUserId: number | null = null;

        if (authUser) {
          const { data: userData } = await supabase
            .from("user")
            .select("id")
            .eq("auth_user_id", authUser.id)
            .single();

          if (userData) {
            deletedByUserId = userData.id;
          }
        }

        const { error: jobError } = await supabase
          .from("job")
          .update({
            deleted_at: nowIso,
            deleted_by: deletedByUserId,
          })
          .eq("id", shift.job_id);

        if (jobError) throw jobError;

        toast.success(t("shiftEditToast.jobDeleted"));
      } else {
        toast.success(t("shiftEditToast.shiftCancelled"));
      }

      onSave();
    } catch (error) {
      console.error("Error cancelling shift:", error);
      toast.error(t("shiftEditToast.cancelFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitialData) {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("shiftEdit.loadingTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">
              {t("shiftEdit.loadingMessage")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (shiftIsPast) {
    const shiftDate = new Date(
      shift.shift_date + "T00:00:00"
    ).toLocaleDateString(i18n.language, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return (
      <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("shiftEdit.viewTitle")}</DialogTitle>
            <DialogDescription>
              {shift.position} - {shiftDate}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="border-gray-500 bg-gray-50">
              <Info className="h-4 w-4 text-gray-600" />
              <AlertDescription className="text-gray-800">
                {t("shiftEdit.pastShiftAlert")}
              </AlertDescription>
            </Alert>

            <div className="space-y-3 text-sm">
              <div>
                <Label className="text-muted-foreground">
                  {t("shiftEdit.time")}
                </Label>
                <p className="font-medium">
                  {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  {t("shiftEdit.workersNeeded")}
                </Label>
                <p className="font-medium">{shift.workers_needed}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  {t("shiftEdit.workersAssigned")}
                </Label>
                <p className="font-medium">{originalStaff.length}</p>
              </div>

              {originalStaff.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">
                    {t("shiftEdit.assignedStaff")}
                  </Label>
                  <div className="space-y-1 mt-2">
                    {originalStaff.map((staff) => (
                      <div
                        key={staff.userId}
                        className="text-sm p-2 bg-muted rounded"
                      >
                        {staff.firstName && staff.lastName
                          ? `${staff.firstName} ${staff.lastName}`
                          : staff.email}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              {t("shiftEdit.closeButton")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const shiftDate = new Date(shift.shift_date + "T00:00:00").toLocaleDateString(
    i18n.language,
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  return (
    <>
      <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("shiftEdit.title")}</DialogTitle>
            <DialogDescription>
              {shift.position} - {shiftDate}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pb-4">
            {workersValidation.isOverstaffed && (
              <Alert className="border-orange-500 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>{t("shiftEdit.overstaffed")}</strong>{" "}
                  {t("shiftEdit.overstaffedDescription", {
                    assigned: currentStaff.length,
                    needed: workersNeeded,
                  })}
                </AlertDescription>
              </Alert>
            )}

            {workersValidation.isUnderstaffed && (
              <Alert className="border-blue-500 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>{t("shiftEdit.understaffed")}</strong>{" "}
                  {t("shiftEdit.understaffedDescription", {
                    assigned: currentStaff.length,
                    needed: workersNeeded,
                  })}
                </AlertDescription>
              </Alert>
            )}

            {workersValidation.isPerfect && currentStaff.length > 0 && (
              <Alert className="border-green-500 bg-green-50">
                <Info className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>{t("shiftEdit.fullyStaffed")}</strong>{" "}
                  {t("shiftEdit.fullyStaffedDescription", {
                    assigned: currentStaff.length,
                    needed: workersNeeded,
                  })}
                </AlertDescription>
              </Alert>
            )}

            <TimePickerSelect
              value={startTime}
              onChange={setStartTime}
              label={t("shiftEdit.startTime")}
              required
            />

            <div>
              <TimePickerSelect
                value={endTime}
                onChange={setEndTime}
                label={t("shiftEdit.endTime")}
                required
              />
              {!timeValidation.isValid && (
                <p className="text-sm text-red-600 mt-1">
                  {timeValidation.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="workersNeeded">
                {t("shiftEdit.workersNeeded")} {t("shiftEdit.required")}
              </Label>
              <Input
                id="workersNeeded"
                type="number"
                min={1}
                value={workersNeeded}
                onChange={(e) =>
                  setWorkersNeeded(parseInt(e.target.value) || 1)
                }
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("shiftEdit.currentlyAssigned", {
                  count: currentStaff.length,
                })}
              </p>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">
                  {t("shiftEdit.currentStaff")} ({currentStaff.length}/
                  {workersNeeded})
                  {(staffToAdd.size > 0 || staffToRemove.size > 0) && (
                    <span className="text-xs text-orange-600 ml-2">
                      {t("shiftEdit.pendingChanges")}
                    </span>
                  )}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddStaff}
                  className="gap-2"
                >
                  <Users className="w-3 h-3" />
                  {t("shiftEdit.addStaffButton")}
                </Button>
              </div>

              {currentStaff.length === 0 ? (
                <div className="text-sm text-muted-foreground italic py-2">
                  {t("shiftEdit.noStaffAssigned")}
                </div>
              ) : (
                <div className="space-y-2">
                  {currentStaff.map((staff) => {
                    const staffName =
                      staff.firstName && staff.lastName
                        ? `${staff.firstName} ${staff.lastName}`
                        : staff.email;

                    const isNewlyAdded = staffToAdd.has(staff.userId);
                    const isMarkedForRemoval = staffToRemove.has(staff.userId);

                    return (
                      <div
                        key={staff.userId}
                        className={`flex items-center justify-between p-2 rounded ${
                          isNewlyAdded
                            ? "bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800"
                            : isMarkedForRemoval
                            ? "bg-red-50 border border-red-200 opacity-50 dark:bg-red-950/20 dark:border-red-800"
                            : "bg-muted"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-2">
                            {staffName}
                            {isNewlyAdded && (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                {t("shiftEdit.newStaff")}
                              </span>
                            )}
                            {isMarkedForRemoval && (
                              <span className="text-xs text-red-600 dark:text-red-400">
                                {t("shiftEdit.toRemove")}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {staff.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          {!isMarkedForRemoval && !isNewlyAdded && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) =>
                                handleCancelStaff(e, staff.userId, staffName)
                              }
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                              title="Cancel assignment"
                            >
                              <XCircle className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) =>
                              handleRemoveStaff(e, staff.userId, staffName)
                            }
                            className="text-destructive hover:text-destructive"
                            title="Remove from list"
                          >
                            <XIcon className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {remainingShiftCount > 1 && (
              <div
                className="flex items-start space-x-2 p-3 bg-muted rounded-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  id="applyToRestOfJob"
                  checked={applyToRestOfJob}
                  onCheckedChange={(checked) => {
                    setApplyToRestOfJob(checked === true);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setApplyToRestOfJob(!applyToRestOfJob);
                  }}
                >
                  <Label
                    htmlFor="applyToRestOfJob"
                    className="cursor-pointer text-sm font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t("shiftEdit.applyToRemaining")}
                  </Label>
                  <p
                    className="text-xs text-muted-foreground mt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t("shiftEdit.applyToRemainingDescription", {
                      count: remainingShiftCount,
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-between pt-4 border-t">
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancel}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  {t("shiftEdit.cancelling")}
                </>
              ) : (
                t("shiftEdit.cancelShiftButton")
              )}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={saving}
              >
                {t("shiftEdit.closeButton")}
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !timeValidation.isValid}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    {t("shiftEdit.saving")}
                  </>
                ) : (
                  t("shiftEdit.saveChangesButton")
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Staff Modal (existing functionality) */}
      <Dialog
        open={staffModalOpen}
        onOpenChange={setStaffModalOpen}
        modal={true}
      >
        <DialogContent
          className="max-w-2xl h-[80vh] flex flex-col"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{t("shiftEdit.addStaffToShift")}</DialogTitle>
            <DialogDescription>
              {applyToRestOfJob
                ? t("shiftEdit.selectForRemaining", {
                    count: remainingShiftCount,
                  })
                : t("shiftEdit.selectForShift")}
            </DialogDescription>
          </DialogHeader>

          {loadingStaff ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t("shiftEdit.loadingAvailability")}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 flex flex-col min-h-0 space-y-4">
                <div className="flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("shiftEdit.searchPlaceholder")}
                      value={staffSearchTerm}
                      onChange={(e) => setStaffSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0 border rounded-lg">
                  <div className="h-full overflow-y-auto p-4">
                    <div className="space-y-2">
                      {employeeAvailabilities.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          {t("shiftEdit.noEmployees")}
                        </div>
                      ) : (
                        employeeAvailabilities
                          .filter((avail) => {
                            const fullName = `${
                              avail.employee.firstName || ""
                            } ${avail.employee.lastName || ""}`.toLowerCase();
                            const email = avail.employee.email.toLowerCase();
                            const search = staffSearchTerm.toLowerCase();
                            return (
                              fullName.includes(search) ||
                              email.includes(search)
                            );
                          })
                          .map((avail) => {
                            const isDisabled =
                              avail.isFullyAssigned || avail.isUnavailable;
                            const canSelect = !isDisabled;

                            return (
                              <div
                                key={avail.employee.userId}
                                className={`flex items-start space-x-3 p-3 rounded transition-colors ${
                                  isDisabled
                                    ? "opacity-50 cursor-not-allowed"
                                    : "hover:bg-muted cursor-pointer"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canSelect) {
                                    toggleStaffSelection(avail.employee.userId);
                                  }
                                }}
                              >
                                <Checkbox
                                  checked={selectedStaffIds.has(
                                    avail.employee.userId
                                  )}
                                  onCheckedChange={(checked) => {
                                    if (canSelect) {
                                      toggleStaffSelection(
                                        avail.employee.userId
                                      );
                                    }
                                  }}
                                  disabled={isDisabled}
                                  className="mt-1"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">
                                    {avail.employee.firstName &&
                                    avail.employee.lastName
                                      ? `${avail.employee.firstName} ${avail.employee.lastName}`
                                      : avail.employee.email}
                                  </div>
                                  <div className="text-xs text-muted-foreground mb-1 truncate">
                                    {avail.employee.email}
                                  </div>

                                  {avail.isFullyAssigned ? (
                                    <div className="text-xs text-green-600">
                                      {t("shiftEdit.alreadyAssigned")}
                                    </div>
                                  ) : avail.isUnavailable ? (
                                    <div className="text-xs text-red-600">
                                      {t("shiftEdit.unavailable")}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-primary">
                                      {t("shiftEdit.availableFor", {
                                        available: avail.available,
                                        total: avail.total,
                                      })}
                                      {avail.conflicts > 0 &&
                                        ` ${t("shiftEdit.conflicts", {
                                          count: avail.conflicts,
                                        })}`}
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

                <div className="flex-shrink-0 text-sm text-muted-foreground">
                  {t("shiftEdit.selected", { count: selectedStaffIds.size })}
                </div>
              </div>

              <div className="flex-shrink-0 flex gap-3 justify-end pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStaffModalOpen(false);
                  }}
                >
                  {t("shiftEdit.cancelButton")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendInvites();
                  }}
                  disabled={selectedStaffIds.size === 0 || sendingInvites}
                >
                  {sendingInvites ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      {t("shiftEdit.sending")}
                    </>
                  ) : (
                    t("shiftEdit.sendInvitationsButton")
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddSelectedStaff();
                  }}
                  disabled={selectedStaffIds.size === 0}
                  className="bg-primary hover:bg-primary/90"
                >
                  {t("shiftEdit.assignSelectedButton")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancellation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("shiftEdit.cancelStaffTitle")}</DialogTitle>
            <DialogDescription>
              {staffToCancel && `${staffToCancel.name} - ${shift.position}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Cancellation Reason */}
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">
                {t("shiftEdit.cancelReasonLabel")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={cancellationReason}
                onValueChange={(value) =>
                  setCancellationReason(value as AdminCancellationReason)
                }
              >
                <SelectTrigger id="cancel-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Admin-specific reasons first */}
                  <SelectItem value="admin_decision">
                    {t("shiftEdit.cancelReasons.adminDecision")}
                  </SelectItem>
                  <SelectItem value="day_off">
                    {t("shiftEdit.cancelReasons.dayOff")}
                  </SelectItem>
                  <SelectItem value="bad_performance">
                    {t("shiftEdit.cancelReasons.badPerformance")}
                  </SelectItem>

                  {/* Worker reasons */}
                  <SelectItem value="sick">
                    {t("shiftEdit.cancelReasons.sick")}
                  </SelectItem>
                  <SelectItem value="accident">
                    {t("shiftEdit.cancelReasons.accident")}
                  </SelectItem>
                  <SelectItem value="personal">
                    {t("shiftEdit.cancelReasons.personal")}
                  </SelectItem>
                  <SelectItem value="other_job">
                    {t("shiftEdit.cancelReasons.otherJob")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Warning for bad performance */}
            {cancellationReason === "bad_performance" && (
              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                  {t("shiftEdit.performanceWarning")}
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertDescription className="text-sm">
                {staffToCancel &&
                  t("shiftEdit.cancelStaffConfirm", {
                    worker: staffToCancel.name,
                  })}
              </AlertDescription>
            </Alert>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelling}
            >
              {t("shiftEdit.back")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("shiftEdit.cancelling")}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  {t("shiftEdit.confirmCancel")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
