// app/[lang]/dashboard/calendar/ShiftEditDialog.tsx
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
  XCircle,
  Loader2,
  UserMinus,
} from "lucide-react";
import { TimePickerSelect } from "@/components/TimePickerSelect";
import {
  fetchAssignedStaffForShift,
  fetchRemainingShifts,
  cancelStaffAssignment,
  type Employee as StaffEmployee,
} from "./staffing-utils";
import { StaffingModal } from "./StaffingModal";
import { ProfileAvatar } from "./ProfileAvatar";


interface ShiftEditDialogProps {
  shift: {
    id: number;
    job_id: number;
    shift_date: string;
    start_time: string;
    end_time: string;
    workers_needed: number;
    position?: string; 
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

  // ✅ NEW: Bulk removal selection
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<number>>(
    new Set()
  );

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [companyId, setCompanyId] = useState<number>(0);
  const [position, setPosition] = useState<string>("");

  // ✅ UPDATED: Single cancellation dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [staffToCancel, setStaffToCancel] = useState<{
    userId: number;
    name: string;
  } | null>(null);
  const [cancellationReason, setCancellationReason] =
    useState<AdminCancellationReason>("admin_decision");
  const [cancelling, setCancelling] = useState(false);

  // ✅ NEW: Bulk removal confirmation
  const [bulkRemovalDialog, setBulkRemovalDialog] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoadingInitialData(true);

      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const today = `${year}-${month}-${day}`;

        // ✅ Fetch all remaining shifts
        const { data: allShifts, error: shiftsError } = await supabase
          .from("shift")
          .select("id, shift_date")
          .eq("job_id", shift.job_id)
          .gte("shift_date", today)
          .is("deleted_at", null)
          .order("shift_date", { ascending: true })
          .order("id", { ascending: true });

        if (shiftsError) throw shiftsError;

        // ✅ Calculate count from current shift onwards
        let countFromCurrentShift = 0;
        if (allShifts && allShifts.length > 0) {
          // Find index of current shift
          const currentShiftIndex = allShifts.findIndex(
            (s) => s.id === shift.id
          );

          if (currentShiftIndex !== -1) {
            // Count from current shift to end
            countFromCurrentShift = allShifts.length - currentShiftIndex;
          } else {
            // If current shift not found (shouldn't happen), use total count
            countFromCurrentShift = allShifts.length;
          }
        }

        setRemainingShiftCount(countFromCurrentShift);

        const staff = await fetchAssignedStaffForShift(supabase, shift.id);
        setOriginalStaff(staff);
        setCurrentStaff(staff);

        const { data: jobData } = await supabase
          .from("job")
          .select("company_id, position")
          .eq("id", shift.job_id)
          .single();

        if (jobData) {
          setCompanyId(jobData.company_id);
          setPosition(jobData.position);
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

  const handleAddStaff = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (companyId === 0) {
      toast.error(t("shiftEditToast.loadingCompany"));
      return;
    }

    setStaffModalOpen(true);
  };

  // ✅ NEW: Toggle staff for bulk removal
  const toggleStaffForRemoval = (userId: number) => {
    const newSelected = new Set(selectedForRemoval);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedForRemoval(newSelected);
  };

  // ✅ NEW: Handle bulk removal confirmation
  const handleBulkRemovalClick = () => {
    if (selectedForRemoval.size === 0) {
      toast.error(t("shiftEditToast.selectEmployee"));
      return;
    }
    setBulkRemovalDialog(true);
  };

  // ✅ NEW: Confirm and execute bulk removal
  const handleConfirmBulkRemoval = async () => {
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

    setSaving(true);

    try {
      const shiftsToModify = applyToRestOfJob
        ? (await fetchRemainingShifts(supabase, shift.job_id)).map((s) => s.id)
        : [shift.id];

      let totalRemoved = 0;

      for (const userId of selectedForRemoval) {
        const result = await cancelStaffAssignment(
          supabase,
          userId,
          shiftsToModify,
          userData.id,
          "admin_decision"
        );

        if (result.success) {
          totalRemoved += result.cancelled;
        }
      }

      if (totalRemoved > 0) {
        toast.success(
          t("staffingToast.bulkRemoveSuccess", {
            count: totalRemoved,
            employees: selectedForRemoval.size,
          })
        );
      }

      // Refresh staff list
      const updatedStaff = await fetchAssignedStaffForShift(supabase, shift.id);
      setOriginalStaff(updatedStaff);
      setCurrentStaff(updatedStaff);
      setSelectedForRemoval(new Set());
      setBulkRemovalDialog(false);
      onSave();
    } catch (error) {
      console.error("Error removing staff:", error);
      toast.error(t("staffingToast.removeFailed", { error: "Unknown error" }));
    } finally {
      setSaving(false);
    }
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

      const shiftsToModify = applyToRestOfJob
        ? (await fetchRemainingShifts(supabase, shift.job_id)).map((s) => s.id)
        : [shift.id];

      const result = await cancelStaffAssignment(
        supabase,
        staffToCancel.userId,
        shiftsToModify,
        userData.id,
        cancellationReason
      );

      if (result.success) {
        toast.success(
          t("shiftEdit.staffCancelled", { name: staffToCancel.name })
        );

        const updatedStaff = await fetchAssignedStaffForShift(
          supabase,
          shift.id
        );
        setOriginalStaff(updatedStaff);
        setCurrentStaff(updatedStaff);
        onSave();
      } else {
        toast.error(t("shiftEdit.cancelStaffFailed"));
      }

      setCancelDialogOpen(false);
      setStaffToCancel(null);
    } catch (error) {
      console.error("Error cancelling staff:", error);
      toast.error(t("shiftEdit.cancelStaffFailed"));
    } finally {
      setCancelling(false);
    }
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

      const updatedStaff = await fetchAssignedStaffForShift(supabase, shift.id);
      setOriginalStaff(updatedStaff);
      setCurrentStaff(updatedStaff);
      setSelectedForRemoval(new Set());

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

  const handleCancelShift = async () => {
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
              {position} - {shiftDate}
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
              {position} - {shiftDate}
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
                  {selectedForRemoval.size > 0 && (
                    <span className="text-xs text-red-600 ml-2">
                      {t("staffing.selectedForRemoval", {
                        count: selectedForRemoval.size,
                      })}
                    </span>
                  )}
                </Label>
                <div className="flex gap-2">
                  {/* ✅ NEW: Remove selected button */}
                  {selectedForRemoval.size > 0 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkRemovalClick}
                      className="gap-2"
                    >
                      <UserMinus className="w-3 h-3" />
                      {t("staffing.removeSelectedButton", {
                        count: selectedForRemoval.size,
                      })}
                    </Button>
                  )}
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

                    const isSelectedForRemoval = selectedForRemoval.has(
                      staff.userId
                    );

                    return (
                      <div
                        key={staff.userId}
                        className={`flex items-center gap-2 p-2 rounded transition-colors ${
                          isSelectedForRemoval
                            ? "bg-red-50 border border-red-200"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        {/* ✅ NEW: Checkbox for bulk selection */}
                        <Checkbox
                          checked={isSelectedForRemoval}
                          onCheckedChange={() =>
                            toggleStaffForRemoval(staff.userId)
                          }
                          className="border-red-500 data-[state=checked]:bg-red-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {/* ✅ NEW: Profile Picture */}
                        <ProfileAvatar
                          firstName={staff.firstName}
                          lastName={staff.lastName}
                          email={staff.email}
                          profilePicture={staff.profilePicture}
                          size="md"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {staffName}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {staff.email}
                          </div>
                        </div>

                        {/* Cancel assignment button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) =>
                            handleCancelStaff(e, staff.userId, staffName)
                          }
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          title="Cancel assignment with reason"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ✅ IMPROVED: Apply to remaining checkbox with better description */}
            {/* ✅ IMPROVED: Apply to remaining checkbox with better dark mode colors */}
            {remainingShiftCount > 1 && (
              <div
                className="flex items-start space-x-2 p-3 bg-muted/50 dark:bg-muted/30 border border-border rounded-lg"
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
                    className="cursor-pointer text-sm font-medium text-foreground"
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
                  {applyToRestOfJob && (
                    <Alert className="mt-2 border-primary/30 bg-primary/10 dark:bg-primary/5">
                      <Info className="h-3 w-3 text-primary" />
                      <AlertDescription className="text-xs text-foreground">
                        {t("shiftEdit.applyToRemainingNote")}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-between pt-4 border-t">
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelShift}
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

      {/* Staffing Modal */}
      {/* Staffing Modal */}
      <StaffingModal
        open={staffModalOpen}
        onOpenChange={setStaffModalOpen}
        jobId={shift.job_id}
        position={position}
        companyId={companyId}
        onSave={async () => {
          const updatedStaff = await fetchAssignedStaffForShift(
            supabase,
            shift.id
          );
          setOriginalStaff(updatedStaff);
          setCurrentStaff(updatedStaff);
          setSelectedForRemoval(new Set());
          onSave();
        }}
        singleShiftMode={!applyToRestOfJob}
        singleShiftData={
          !applyToRestOfJob
            ? {
                id: shift.id,
                shift_date: shift.shift_date,
                start_time: shift.start_time,
                end_time: shift.end_time,
                workers_needed: shift.workers_needed,
              }
            : undefined
        }
        applyToRemaining={applyToRestOfJob}
        startFromShiftId={applyToRestOfJob ? shift.id : undefined} // ✅ NEW: Pass current shift ID
      />

      {/* ✅ IMPROVED: Single Staff Cancellation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("shiftEdit.cancelStaffTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {staffToCancel && `${staffToCancel.name} - ${position}`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
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
                  <SelectItem value="admin_decision">
                    {t("shiftEdit.cancelReasons.adminDecision")}
                  </SelectItem>
                  <SelectItem value="day_off">
                    {t("shiftEdit.cancelReasons.dayOff")}
                  </SelectItem>
                  <SelectItem value="bad_performance">
                    {t("shiftEdit.cancelReasons.badPerformance")}
                  </SelectItem>
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

            {cancellationReason === "bad_performance" && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-800">
                  {t("shiftEdit.performanceWarning")}
                </AlertDescription>
              </Alert>
            )}

            {applyToRestOfJob && (
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800">
                  {t("shiftEdit.cancelAllRemainingNote", {
                    count: remainingShiftCount,
                  })}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>
              {t("shiftEdit.back")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700"
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
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ✅ NEW: Bulk Removal Confirmation Dialog */}
      <AlertDialog open={bulkRemovalDialog} onOpenChange={setBulkRemovalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("staffing.confirmBulkRemoveTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {applyToRestOfJob
                ? t("shiftEdit.bulkRemoveAllShiftsDescription", {
                    count: selectedForRemoval.size,
                    shifts: remainingShiftCount,
                  })
                : t("staffing.confirmBulkRemoveDescription", {
                    count: selectedForRemoval.size,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto border rounded-md p-3 bg-muted/50">
            {Array.from(selectedForRemoval).map((userId) => {
              const staff = currentStaff.find((s) => s.userId === userId);
              if (!staff) return null;

              const staffName =
                staff.firstName && staff.lastName
                  ? `${staff.firstName} ${staff.lastName}`
                  : staff.email;

              return (
                <div
                  key={userId}
                  className="text-sm font-medium text-foreground"
                >
                  • {staffName}
                </div>
              );
            })}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>
              {t("staffing.cancelButton")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkRemoval}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("staffing.removing")}
                </>
              ) : (
                t("staffing.confirmRemoveButton")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
