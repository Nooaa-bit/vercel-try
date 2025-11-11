"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertTriangle, Info } from "lucide-react";
import { TimePickerSelect } from "@/components/TimePickerSelect";

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
  // ✅ Check if shift is in the past
  const isShiftInPast = () => {
    const now = new Date();
    const shiftDateTime = new Date(shift.shift_date + "T" + shift.start_time);
    return shiftDateTime < now;
  };

  const shiftIsPast = isShiftInPast();

  // ✅ Ensure proper time format (HH:MM)
  const formatTime = (time: string) => {
    const cleaned = time.slice(0, 5); // Get HH:MM only
    const [hours, minutes] = cleaned.split(":");
    // Round minutes to nearest 15
    const roundedMinutes = Math.round(parseInt(minutes || "0") / 15) * 15;
    return `${hours.padStart(2, "0")}:${String(
      roundedMinutes === 60 ? 0 : roundedMinutes
    ).padStart(2, "0")}`;
  };

  const [startTime, setStartTime] = useState(formatTime(shift.start_time));
  const [endTime, setEndTime] = useState(formatTime(shift.end_time));
  const [workersNeeded, setWorkersNeeded] = useState(shift.workers_needed);
  const [applyToRestOfJob, setApplyToRestOfJob] = useState(false); // ✅ Changed name
  const [saving, setSaving] = useState(false);
  const [remainingShiftCount, setRemainingShiftCount] = useState(0);
  const supabase = createClient();

  // ✅ Fetch count of remaining shifts (today onwards) for this job
  useEffect(() => {
    const fetchRemainingShiftCount = async () => {
      const today = new Date().toISOString().split("T")[0];

      const { count } = await supabase
        .from("shift")
        .select("*", { count: "exact", head: true })
        .eq("job_id", shift.job_id)
        .gte("shift_date", today)
        .is("deleted_at", null);

      setRemainingShiftCount(count || 0);
    };

    fetchRemainingShiftCount();
  }, [shift.job_id, supabase]);

  // ✅ Validation checks
  const timeValidation = {
    isValid: endTime > startTime,
    message: "End time must be after start time",
  };

  const workersValidation = {
    isOverstaffed: assignmentCount > workersNeeded,
    isUnderstaffed: assignmentCount < workersNeeded && assignmentCount > 0,
    isPerfect: assignmentCount === workersNeeded,
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

    // ✅ Prevent editing shift times to be in the past (only for today's shifts)
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

    // ✅ Warn if reducing workers below current assignments
    if (workersNeeded < assignmentCount && !applyToRestOfJob) {
      if (
        !confirm(
          `You have ${assignmentCount} workers assigned but only need ${workersNeeded}. This shift will be overstaffed. Continue?`
        )
      ) {
        return;
      }
    }

    setSaving(true);

    try {
      if (applyToRestOfJob) {
        // ✅ Update all remaining shifts of this job (today and future)
        const todayStr = new Date().toISOString().split("T")[0];

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
        toast.success(
          `Updated ${remainingShiftCount} remaining shift(s) for this job`
        );
      } else {
        // Update only this shift
        const { error } = await supabase
          .from("shift")
          .update({
            start_time: startTime + ":00",
            end_time: endTime + ":00",
            workers_needed: workersNeeded,
          })
          .eq("id", shift.id);

        if (error) throw error;
        toast.success("Shift updated successfully");
      }

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
          assignmentCount > 0
            ? `${assignmentCount} worker(s) are assigned and will be notified.`
            : ""
        }`
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      const now = new Date().toISOString();

      // Soft delete the shift
      const { error } = await supabase
        .from("shift")
        .update({
          deleted_at: now,
        })
        .eq("id", shift.id);

      if (error) throw error;

      toast.success("Shift cancelled successfully");
      onSave();
    } catch (error) {
      console.error("Error cancelling shift:", error);
      toast.error("Failed to cancel shift");
    } finally {
      setSaving(false);
    }
  };

  // ✅ If shift is in the past, show read-only view
  if (shiftIsPast) {
    return (
      <DialogContent className="max-w-md">
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
              <Label className="text-muted-foreground">Workers Assigned</Label>
              <p className="font-medium">{assignmentCount}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Close
          </Button>
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-md">
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

      <div className="space-y-4">
        {/* ✅ Staffing Status Alert */}
        {workersValidation.isOverstaffed && (
          <Alert className="border-orange-500 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Overstaffed:</strong> {assignmentCount} workers assigned,{" "}
              {workersNeeded} needed
            </AlertDescription>
          </Alert>
        )}

        {workersValidation.isUnderstaffed && (
          <Alert className="border-blue-500 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Understaffed:</strong> {assignmentCount} workers assigned,{" "}
              {workersNeeded} needed
            </AlertDescription>
          </Alert>
        )}

        {workersValidation.isPerfect && assignmentCount > 0 && (
          <Alert className="border-green-500 bg-green-50">
            <Info className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Fully Staffed:</strong> {assignmentCount}/{workersNeeded}{" "}
              workers assigned
            </AlertDescription>
          </Alert>
        )}

        {/* ✅ Start Time */}
        <TimePickerSelect
          value={startTime}
          onChange={setStartTime}
          label="Start Time"
          required
        />

        {/* ✅ End Time */}
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

        {/* Workers Needed */}
        <div>
          <Label htmlFor="workersNeeded">Workers Needed *</Label>
          <Input
            id="workersNeeded"
            type="number"
            min={1}
            value={workersNeeded}
            onChange={(e) => setWorkersNeeded(parseInt(e.target.value) || 1)}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Currently {assignmentCount} worker(s) assigned
          </p>
        </div>

        {/* ✅ A) Apply to Rest of Job Shifts */}
        {remainingShiftCount > 1 && (
          <div className="flex items-start space-x-2 p-3 bg-muted rounded-lg">
            <Checkbox
              id="applyToRestOfJob"
              checked={applyToRestOfJob}
              onCheckedChange={(checked) =>
                setApplyToRestOfJob(checked === true)
              }
              className="mt-1"
            />
            <div className="flex-1">
              <Label
                htmlFor="applyToRestOfJob"
                className="cursor-pointer text-sm font-medium"
              >
                Apply changes to all remaining shifts of this job
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                This will update {remainingShiftCount} remaining shift(s) (today
                and future)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-between pt-4 border-t">
        <Button variant="destructive" onClick={handleCancel} disabled={saving}>
          Cancel Shift
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Close
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !timeValidation.isValid}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
