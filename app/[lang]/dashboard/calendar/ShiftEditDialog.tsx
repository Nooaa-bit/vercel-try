"use client";

import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import {
  AlertTriangle,
  Info,
  Users,
  Search,
  X as XIcon,
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

export function ShiftEditDialog({
  shift,
  assignmentCount,
  onSave,
  onCancel,
}: ShiftEditDialogProps) {
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
        toast.error("Failed to load shift data");
      } finally {
        setLoadingInitialData(false);
      }
    };

    loadInitialData();
  }, [shift.id, shift.job_id, supabase]);

  const timeValidation = {
    isValid: endTime > startTime,
    message: "End time must be after start time",
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
      toast.error("Loading company data...");
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
      toast.error("Failed to load employee data");
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
      toast.error("Please select at least one employee");
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

    toast.info(`${selectedStaffIds.size} employee(s) added (pending save)`);
    setStaffModalOpen(false);
    setSelectedStaffIds(new Set());
  };

  const handleSendInvites = async () => {
    if (selectedStaffIds.size === 0) {
      toast.error("Please select at least one employee");
      return;
    }

    setSendingInvites(true);

    try {
      const response = await fetch(`/api/job-invitation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: shift.job_id,
          userIds: Array.from(selectedStaffIds),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitations");
      }

      toast.success(`Invitations sent to ${selectedStaffIds.size} employee(s)`);
      setStaffModalOpen(false);
      setSelectedStaffIds(new Set());
    } catch (error) {
      console.error("Error sending invitations:", error);
      toast.error("Failed to send invitations");
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

    toast.info(`${userName} removed (pending save)`);
  };

  const assignStaffDirectly = async (
    userIds: number[],
    shiftIds: number[],
    adminId: number
  ) => {
    console.log("=== Starting assignStaffDirectly ===");
    console.log("User IDs to assign:", userIds);
    console.log("Shift IDs:", shiftIds);
    console.log("Admin ID:", adminId);

    const now = new Date().toISOString();
    let successCount = 0;

    const { data: allAssignments } = await supabase
      .from("shift_assignment")
      .select("id, shift_id, user_id, deleted_at, cancelled_at")
      .in("shift_id", shiftIds)
      .in("user_id", userIds);

    console.log("All assignments (including deleted):", allAssignments);

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

    console.log("Active assignments:", Array.from(activeAssignments));
    console.log("Deleted assignments:", Array.from(deletedAssignments.keys()));

    for (const userId of userIds) {
      for (const shiftId of shiftIds) {
        const key = `${shiftId}-${userId}`;

        if (activeAssignments.has(key)) {
          console.log(
            `⏭️ Skipping - active assignment exists for user ${userId}, shift ${shiftId}`
          );
          continue;
        }

        const deletedAssignment = deletedAssignments.get(key);
        if (deletedAssignment) {
          console.log(
            `🔄 Undeleting assignment for user ${userId}, shift ${shiftId}`
          );

          const { error } = await supabase
            .from("shift_assignment")
            .update({
              deleted_at: null,
              cancelled_at: null,
              assigned_by: adminId,
              assigned_at: now,
            })
            .eq("id", deletedAssignment.id);

          if (error) {
            console.error(`❌ Error undeleting assignment:`, error);
            continue;
          }

          console.log(
            `✅ Undeleted assignment for user ${userId}, shift ${shiftId}`
          );
          successCount++;
          continue;
        }

        console.log(
          `➕ Creating new assignment for user ${userId}, shift ${shiftId}`
        );

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

        if (error) {
          if (error.code === "23505") {
            console.log(
              `⚠️ Duplicate detected for user ${userId}, shift ${shiftId} - skipping`
            );
            continue;
          } else {
            console.error(`❌ Error creating assignment:`, error);
            continue;
          }
        }

        if (data) {
          console.log(`✅ Created new assignment:`, data);
          successCount++;
        }
      }
    }

    console.log(`✅ Total assignments processed: ${successCount}`);
    return successCount;
  };

  const handleSave = async () => {
    if (!startTime || !endTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!timeValidation.isValid) {
      toast.error(timeValidation.message);
      return;
    }

    if (workersNeeded < 1) {
      toast.error("Workers needed must be at least 1");
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
        toast.error("Cannot set shift time in the past for today's date");
        return;
      }
    }

    if (workersNeeded < currentStaff.length && !applyToRestOfJob) {
      if (
        !confirm(
          `You have ${currentStaff.length} workers assigned but only need ${workersNeeded}. This shift will be overstaffed. Continue?`
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
        console.log(
          `Removed ${staffToRemove.size} staff from ${shiftsToModify.length} shift(s)`
        );
      }

      if (staffToAdd.size > 0) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          toast.error("User not authenticated");
          setSaving(false);
          return;
        }

        console.log("Auth user ID:", authUser.id);

        let adminUserId: number | null = null;

        const { data: userData1 } = await supabase
          .from("user")
          .select("id")
          .eq("auth_user_id", authUser.id)
          .single();

        if (userData1) {
          adminUserId = userData1.id;
          console.log("Found user via auth_user_id:", adminUserId);
        }

        if (!adminUserId) {
          const { data: userData2 } = await supabase
            .from("user")
            .select("id")
            .eq("supabase_user_id", authUser.id)
            .single();

          if (userData2) {
            adminUserId = userData2.id;
            console.log("Found user via supabase_user_id:", adminUserId);
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
            console.log("Using user_id from user_role:", adminUserId);
          }
        }

        if (!adminUserId) {
          console.error("Could not find user ID in database");
          toast.error("Could not find user data. Staff changes not applied.");
        } else {
          const assignedCount = await assignStaffDirectly(
            Array.from(staffToAdd),
            shiftsToModify,
            adminUserId
          );

          console.log(
            `Successfully assigned ${assignedCount} shift assignments`
          );

          if (assignedCount > 0) {
            toast.success(
              `Assigned ${staffToAdd.size} worker(s) to ${shiftsToModify.length} shift(s)`
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
        ? `Updated ${remainingShiftCount} remaining shift(s)`
        : "Shift updated successfully";

      toast.success(message);

      onSave();
    } catch (error) {
      console.error("Error updating shift:", error);
      toast.error("Failed to update shift");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (
      !confirm(
        `Are you sure you want to cancel this shift? ${
          currentStaff.length > 0
            ? `${currentStaff.length} worker(s) are assigned and will be notified.`
            : ""
        }`
      )
    ) {
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

      console.log("Remaining shifts for job:", remainingCount);
      console.log("Current shift ID:", shift.id);

      const isLastShift =
        remainingCount === 1 && remainingShifts?.[0]?.id === shift.id;

      console.log("Is this the last shift?", isLastShift);

      const { error: shiftError } = await supabase
        .from("shift")
        .update({
          deleted_at: nowIso,
        })
        .eq("id", shift.id);

      if (shiftError) throw shiftError;

      if (isLastShift) {
        console.log("Deleting job because this was the last shift");

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

        if (jobError) {
          console.error("Error deleting job:", jobError);
          throw jobError;
        }

        toast.success(
          "Shift cancelled successfully. Job also deleted as it was the last shift."
        );
      } else {
        toast.success("Shift cancelled successfully");
      }

      onSave();
    } catch (error) {
      console.error("Error cancelling shift:", error);
      toast.error("Failed to cancel shift");
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitialData) {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Loading Shift</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">
              Loading shift details...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (shiftIsPast) {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Shift (Past)</DialogTitle>
            <DialogDescription>
              {shift.position} -{" "}
              {new Date(shift.shift_date + "T00:00:00").toLocaleDateString(
                "en-US",
                {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="border-gray-500 bg-gray-50">
              <Info className="h-4 w-4 text-gray-600" />
              <AlertDescription className="text-gray-800">
                This shift has already started and cannot be edited.
              </AlertDescription>
            </Alert>

            <div className="space-y-3 text-sm">
              <div>
                <Label className="text-muted-foreground">Time</Label>
                <p className="font-medium">
                  {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Workers Needed</Label>
                <p className="font-medium">{shift.workers_needed}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  Workers Assigned
                </Label>
                <p className="font-medium">{originalStaff.length}</p>
              </div>

              {originalStaff.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">
                    Assigned Staff
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
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
            <DialogDescription>
              {shift.position} -{" "}
              {new Date(shift.shift_date + "T00:00:00").toLocaleDateString(
                "en-US",
                {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pb-4">
            {workersValidation.isOverstaffed && (
              <Alert className="border-orange-500 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Overstaffed:</strong> {currentStaff.length} workers
                  assigned, {workersNeeded} needed
                </AlertDescription>
              </Alert>
            )}

            {workersValidation.isUnderstaffed && (
              <Alert className="border-blue-500 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Understaffed:</strong> {currentStaff.length} workers
                  assigned, {workersNeeded} needed
                </AlertDescription>
              </Alert>
            )}

            {workersValidation.isPerfect && currentStaff.length > 0 && (
              <Alert className="border-green-500 bg-green-50">
                <Info className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Fully Staffed:</strong> {currentStaff.length}/
                  {workersNeeded} workers assigned
                </AlertDescription>
              </Alert>
            )}

            <TimePickerSelect
              value={startTime}
              onChange={setStartTime}
              label="Start Time"
              required
            />

            <div>
              <TimePickerSelect
                value={endTime}
                onChange={setEndTime}
                label="End Time"
                required
              />
              {!timeValidation.isValid && (
                <p className="text-sm text-red-600 mt-1">
                  {timeValidation.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="workersNeeded">Workers Needed *</Label>
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
                Currently {currentStaff.length} worker(s) assigned
              </p>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">
                  Current Staff ({currentStaff.length}/{workersNeeded})
                  {(staffToAdd.size > 0 || staffToRemove.size > 0) && (
                    <span className="text-xs text-orange-600 ml-2">
                      (Pending changes)
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
                  Add Staff
                </Button>
              </div>

              {currentStaff.length === 0 ? (
                <div className="text-sm text-muted-foreground italic py-2">
                  No staff assigned yet
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
                            ? "bg-green-50 border border-green-200"
                            : isMarkedForRemoval
                            ? "bg-red-50 border border-red-200 opacity-50"
                            : "bg-muted"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-2">
                            {staffName}
                            {isNewlyAdded && (
                              <span className="text-xs text-green-600">
                                (New)
                              </span>
                            )}
                            {isMarkedForRemoval && (
                              <span className="text-xs text-red-600">
                                (To remove)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {staff.email}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) =>
                            handleRemoveStaff(e, staff.userId, staffName)
                          }
                          className="text-destructive hover:text-destructive flex-shrink-0 ml-2"
                        >
                          <XIcon className="w-3 h-3" />
                        </Button>
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
                    Apply changes to all remaining shifts
                  </Label>
                  <p
                    className="text-xs text-muted-foreground mt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Updates times, workers needed, and staffing for{" "}
                    {remainingShiftCount} shift(s)
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
                  Cancelling...
                </>
              ) : (
                "Cancel Shift"
              )}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={saving}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !timeValidation.isValid}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>Add Staff to Shift</DialogTitle>
            <DialogDescription>
              {applyToRestOfJob
                ? `Select employees for ${remainingShiftCount} remaining shift(s)`
                : "Select employees for this shift"}
            </DialogDescription>
          </DialogHeader>

          {loadingStaff ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Loading employees and calculating availability...
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
                      placeholder="Search by name or email..."
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
                          No employees found
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
                                      ✓ Already assigned
                                    </div>
                                  ) : avail.isUnavailable ? (
                                    <div className="text-xs text-red-600">
                                      ✗ Unavailable
                                    </div>
                                  ) : (
                                    <div className="text-xs text-primary">
                                      Available for {avail.available}/
                                      {avail.total} shift(s)
                                      {avail.conflicts > 0 &&
                                        ` (${avail.conflicts} conflicts)`}
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
                  {selectedStaffIds.size} selected
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
                  Cancel
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
                      Sending...
                    </>
                  ) : (
                    "Send Invitations"
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
                  Assign Selected
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
