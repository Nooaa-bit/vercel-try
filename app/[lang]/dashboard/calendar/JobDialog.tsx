//hype-hire/vercel/app/[lang]/dashboard/calendar/JobDialog.tsx
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { TimePickerSelect } from "@/components/TimePickerSelect";
import { StaffingModal } from "./StaffingModal";

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

interface Location {
  id: number;
  name: string;
}

interface JobDialogProps {
  editingJob: Job | null;
  locations: Location[];
  onSave: () => void;
  onCancel: () => void;
  companyId: number;
  defaultStartDate?: string;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as Record<string, unknown>).message);
  }
  return "An unknown error occurred";
};

export default function JobDialog({
  editingJob,
  locations,
  onSave,
  onCancel,
  companyId,
  defaultStartDate,
}: JobDialogProps) {
  const { t, ready } = useTranslation("jobs");
  const { activeRole } = useActiveRole();
  const supabase = createClient();

  const [position, setPosition] = useState("");
  const [seniority, setSeniority] = useState<"junior" | "senior">("junior");
  const [description, setDescription] = useState("");
  const [workersNeeded, setWorkersNeeded] = useState(1);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(defaultStartDate || "");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [isMultipleDays, setIsMultipleDays] = useState(false);
  const [saving, setSaving] = useState(false);

  const [shiftStartTime, setShiftStartTime] = useState("09:00");
  const [shiftEndTime, setShiftEndTime] = useState("17:00");
  const [loadingShiftTimes, setLoadingShiftTimes] = useState(false);

  const [staffingOpen, setStaffingOpen] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (editingJob) {
      setPosition(editingJob.position);
      setSeniority(editingJob.seniority);
      setDescription(editingJob.description || "");
      setLocationId(editingJob.location_id);
      setStartDate(editingJob.start_date);
      setEndDate(editingJob.end_date);
      setIsMultipleDays(editingJob.start_date !== editingJob.end_date);
    }
  }, [editingJob]);

  useEffect(() => {
    if (editingJob) {
      const loadShiftData = async () => {
        setLoadingShiftTimes(true);
        try {
          const todayStr = new Date().toISOString().split("T")[0];

          const { data: shiftData, error } = await supabase
            .from("shift")
            .select("start_time, end_time, workers_needed")
            .eq("job_id", editingJob.id)
            .gte("shift_date", todayStr)
            .is("deleted_at", null)
            .order("shift_date", { ascending: true })
            .limit(1)
            .single();

          if (!error && shiftData) {
            setShiftStartTime(shiftData.start_time.slice(0, 5));
            setShiftEndTime(shiftData.end_time.slice(0, 5));
            setWorkersNeeded(shiftData.workers_needed);
          }
        } catch (error) {
          console.error("Error loading shift data:", error);
        } finally {
          setLoadingShiftTimes(false);
        }
      };

      loadShiftData();
    }
  }, [editingJob, supabase]);

  useEffect(() => {
    if (!isMultipleDays && startDate) {
      setEndDate(startDate);
    }
  }, [startDate, isMultipleDays]);

  const handleCancelAllShifts = async () => {
    if (!editingJob) return;

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const jobHasStartedOrStartsToday = editingJob.start_date <= todayStr;

    let canCancelToday = true;
    let todayShiftStartTime: string | null = null;
    let todayHasAssignments = false;

    if (jobHasStartedOrStartsToday) {
      const { data: todayShift } = await supabase
        .from("shift")
        .select("id, start_time")
        .eq("job_id", editingJob.id)
        .eq("shift_date", todayStr)
        .is("deleted_at", null)
        .single();

      if (todayShift) {
        const { count } = await supabase
          .from("shift_assignment")
          .select("id", { count: "exact", head: true })
          .eq("shift_id", todayShift.id)
          .is("cancelled_at", null)
          .is("deleted_at", null);

        todayHasAssignments = (count || 0) > 0;

        if (todayHasAssignments) {
          const [hours, minutes, seconds] = todayShift.start_time.split(":");
          const shiftStartDateTime = new Date();
          shiftStartDateTime.setHours(
            parseInt(hours),
            parseInt(minutes),
            parseInt(seconds || "0"),
            0
          );

          const timeDiffInHours =
            (shiftStartDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

          canCancelToday = timeDiffInHours >= 1;
          todayShiftStartTime = todayShift.start_time;
        }
      }
    }

    // ✅ Translated confirmations
    let confirmMessage = "";
    let toastSuccessKey = "";

    if (!jobHasStartedOrStartsToday) {
      confirmMessage = t("confirmations.deleteJob", { position });
      toastSuccessKey = "toast.deleteSuccess";
    } else if (canCancelToday) {
      const noAssignmentsNote = !todayHasAssignments
        ? t("confirmations.noAssignmentsNote")
        : "";
      confirmMessage = t("confirmations.cancelAllShifts", {
        position,
        noAssignments: noAssignmentsNote,
      });
      toastSuccessKey = "toast.cancelSuccess";
    } else {
      confirmMessage = t("confirmations.cancelFutureShifts", {
        position,
        time: todayShiftStartTime,
      });
      toastSuccessKey = "toast.cancelFutureSuccess";
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    let deleteFromDate = todayStr;
    if (jobHasStartedOrStartsToday && !canCancelToday) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      deleteFromDate = tomorrow.toISOString().split("T")[0];
    }

    setSaving(true);

    try {
      if (!jobHasStartedOrStartsToday) {
        const { data, error } = await supabase.rpc("delete_job_and_shifts", {
          p_job_id: editingJob.id,
          p_deleted_by: activeRole?.id || null,
        });
        if (error) throw error;
      } else {
        const endDate = new Date(deleteFromDate);
        endDate.setDate(endDate.getDate() - 1);
        const endDateStr = endDate.toISOString().split("T")[0];

        const { data, error } = await supabase.rpc("cancel_shifts_from_date", {
          p_job_id: editingJob.id,
          p_from_date: deleteFromDate,
          p_new_end_date: endDateStr,
        });
        if (error) throw error;
      }

      toast.success(t(toastSuccessKey, { position }));
      onSave();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("Error:", errorMessage);
      toast.error(t("toast.saveFailed", { error: errorMessage }));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    // ✅ Translated validation messages
    if (!position || !startDate) {
      toast.error(t("validation.fillRequired"));
      return;
    }

    if (!editingJob) {
      if (!startTime || !endTime) {
        toast.error(t("validation.fillTimes"));
        return;
      }

      if (endTime <= startTime) {
        toast.error(t("validation.endAfterStart"));
        return;
      }

      const now = new Date();
      const selectedDateTime = new Date(startDate + "T" + startTime + ":00");

      if (selectedDateTime < now) {
        toast.error(t("validation.noPastJobs"));
        return;
      }

      if (isMultipleDays) {
        if (!endDate) {
          toast.error(t("validation.setEndDate"));
          return;
        }

        if (endDate < startDate) {
          toast.error(t("validation.endDateAfterStart"));
          return;
        }
      }
    }

    if (editingJob) {
      if (shiftEndTime <= shiftStartTime) {
        toast.error(t("validation.shiftEndAfterStart"));
        return;
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const todayStr = `${year}-${month}-${day}`;

      if (startDate === todayStr) {
        const newShiftStartDateTime = new Date(
          startDate + "T" + shiftStartTime + ":00"
        );

        if (newShiftStartDateTime < now) {
          toast.error(t("validation.noPastTime", { time: shiftStartTime }));
          return;
        }
      } else if (startDate < todayStr) {
        toast.error(t("validation.noPastDate"));
        return;
      }

      const finalEndDate = isMultipleDays ? endDate : startDate;

      if (!finalEndDate) {
        toast.error(t("validation.setEndDate"));
        return;
      }

      // Check if reducing workers would over-assign shifts
      const { data: shiftsWithAssignments, error: checkError } = await supabase
        .from("shift")
        .select("id, shift_date, workers_needed")
        .eq("job_id", editingJob.id)
        .gte("shift_date", todayStr)
        .is("deleted_at", null);

      if (checkError) {
        console.error("Error checking shifts:", checkError);
        toast.error(t("validation.validateWorkers"));
        return;
      }

      if (shiftsWithAssignments && shiftsWithAssignments.length > 0) {
        const shiftIds = shiftsWithAssignments.map((s) => s.id);
        const { data: assignments } = await supabase
          .from("shift_assignment")
          .select("shift_id")
          .in("shift_id", shiftIds)
          .is("cancelled_at", null)
          .is("deleted_at", null);

        const assignmentsByShift: Record<number, number> = {};
        (assignments || []).forEach((a) => {
          assignmentsByShift[a.shift_id] =
            (assignmentsByShift[a.shift_id] || 0) + 1;
        });

        const overassignedShifts = shiftsWithAssignments.filter(
          (shift) => (assignmentsByShift[shift.id] || 0) > workersNeeded
        );

        if (overassignedShifts.length > 0) {
          const exampleShift = overassignedShifts[0];
          const assignedCount = assignmentsByShift[exampleShift.id];

          toast.error(
            t("validation.cannotReduceWorkers", {
              needed: workersNeeded,
              date: exampleShift.shift_date,
              assigned: assignedCount,
            }),
            { duration: 6000 }
          );
          return;
        }
      }

      // Check for shifts outside new date range
      const datesChanged =
        startDate !== editingJob.start_date ||
        finalEndDate !== editingJob.end_date;

      if (datesChanged) {
        const { data: outsideShifts, error: checkError } = await supabase
          .from("shift")
          .select("id, shift_date, start_time")
          .eq("job_id", editingJob.id)
          .is("deleted_at", null)
          .or(`shift_date.lt.${startDate},shift_date.gt.${finalEndDate}`);

        if (checkError) {
          console.error("Error checking shifts:", checkError);
          toast.error(t("validation.validateDates"));
          return;
        }

        if (outsideShifts && outsideShifts.length > 0) {
          const shiftIds = outsideShifts.map((s) => s.id);

          const { data: assignments, count: assignmentCount } = await supabase
            .from("shift_assignment")
            .select("shift_id", { count: "exact" })
            .in("shift_id", shiftIds)
            .is("cancelled_at", null)
            .is("deleted_at", null);

          const hasAssignments = (assignmentCount || 0) > 0;

          const todayShift = outsideShifts.find(
            (s) => s.shift_date === todayStr
          );

          if (todayShift && hasAssignments) {
            const todayHasAssignments = assignments?.some(
              (a) => a.shift_id === todayShift.id
            );

            if (todayHasAssignments) {
              const [hours, minutes, seconds] =
                todayShift.start_time.split(":");
              const shiftStartDateTime = new Date();
              shiftStartDateTime.setHours(
                parseInt(hours),
                parseInt(minutes),
                parseInt(seconds || "0"),
                0
              );

              const timeDiffInHours =
                (shiftStartDateTime.getTime() - now.getTime()) /
                (1000 * 60 * 60);

              if (timeDiffInHours < 1 && timeDiffInHours > 0) {
                toast.error(
                  t("validation.cannotChangeDates", {
                    time: todayShift.start_time.slice(0, 5),
                  }),
                  { duration: 6000 }
                );
                return;
              }
            }
          }

          const outsideDates = outsideShifts.map((s) => s.shift_date).sort();
          const dateRangeMsg =
            outsideDates.length === 1
              ? outsideDates[0]
              : `${outsideDates[0]} to ${
                  outsideDates[outsideDates.length - 1]
                }`;

          let warningMessage = t("validation.dateChangeWarning", {
            count: outsideShifts.length,
            dates: dateRangeMsg,
          });
          warningMessage += "\n\n";

          if (hasAssignments) {
            warningMessage += t("validation.shiftsWithAssignments");
          } else {
            warningMessage += t("validation.shiftsNoAssignments");
          }

          warningMessage += "\n\n";
          warningMessage += t("validation.continueQuestion");

          if (!confirm(warningMessage)) {
            return;
          }

          try {
            const { error: deleteError } = await supabase.rpc(
              "delete_shifts_outside_range",
              {
                p_shift_ids: shiftIds,
              }
            );

            if (deleteError) {
              console.error("Error deleting outside shifts:", deleteError);
              throw new Error(t("validation.deleteShiftsFailed"));
            }

            toast.info(
              t("validation.shiftsDeleted", { count: outsideShifts.length })
            );
          } catch (error) {
            const errorMessage = getErrorMessage(error);
            console.error("Error handling outside shifts:", errorMessage);
            toast.error(
              t("validation.dateChangeFailed", { error: errorMessage })
            );
            return;
          }
        }
      }
    }

    setSaving(true);

    try {
      const finalEndDate = isMultipleDays ? endDate : startDate;

      if (!finalEndDate) {
        toast.error(t("validation.setEndDate"));
        setSaving(false);
        return;
      }

      if (!activeRole || !activeRole.userId) {
        toast.error(t("validation.userNotAuthenticated"));
        setSaving(false);
        return;
      }

      if (editingJob) {
        const { error: jobError } = await supabase
          .from("job")
          .update({
            position,
            seniority,
            description: description || null,
            location_id: locationId,
            start_date: startDate,
            end_date: finalEndDate,
          })
          .eq("id", editingJob.id);

        if (jobError) {
          console.error("Job update error:", jobError);
          throw jobError;
        }

        const { data: shiftData, error: shiftError } = await supabase.rpc(
          "generate_missing_shifts",
          {
            p_job_id: editingJob.id,
            p_start_time: shiftStartTime + ":00",
            p_end_time: shiftEndTime + ":00",
            p_workers_needed: workersNeeded,
          }
        );

        if (shiftError) {
          console.error("Error generating shifts:", shiftError);
          throw shiftError;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const todayStr = `${year}-${month}-${day}`;

        const { error: shiftUpdateError } = await supabase
          .from("shift")
          .update({
            start_time: shiftStartTime + ":00",
            end_time: shiftEndTime + ":00",
            workers_needed: workersNeeded,
          })
          .eq("job_id", editingJob.id)
          .gte("shift_date", todayStr)
          .is("deleted_at", null);

        if (shiftUpdateError) {
          console.error("Shift update error:", shiftUpdateError);
          throw shiftUpdateError;
        }

        toast.success(t("toast.updateSuccess"));
      } else {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "create_job_with_shifts",
          {
            p_company_id: companyId,
            p_position: position,
            p_seniority: seniority,
            p_description: description || null,
            p_workers_needed: workersNeeded,
            p_location_id: locationId,
            p_start_date: startDate,
            p_end_date: finalEndDate,
            p_start_time: startTime + ":00",
            p_end_time: endTime + ":00",
            p_created_by: activeRole.userId,
          }
        );

        if (rpcError) {
          console.error("Job creation error:", rpcError);
          throw rpcError;
        }

        toast.success(
          t("toast.createSuccess", { count: rpcData.created_shifts })
        );
      }

      onSave();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("Error saving job:", errorMessage);
      toast.error(t("toast.saveFailed", { error: errorMessage }));
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return null;
  }

  return (
    <>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&_button[data-radix-dialog-close]]:z-50">
        <DialogHeader className="top-0 bg-background z-8 pt-6 border-b pb-4">
          <DialogTitle>
            {editingJob ? t("dialog.editTitle") : t("dialog.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {editingJob
              ? t("dialog.editDescription")
              : t("dialog.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pr-4">
          {/* Position */}
          <div>
            <Label htmlFor="position" className="text-sm font-medium">
              {t("fields.position")} {t("fields.required")}
            </Label>
            <Input
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder={t("fields.positionPlaceholder")}
              className="mt-2"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              {t("fields.description")}
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("fields.descriptionPlaceholder")}
              className="mt-2"
              rows={3}
            />
          </div>

          {/* Seniority & Workers Needed */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="seniority" className="text-sm font-medium">
                {t("fields.seniority")} {t("fields.required")}
              </Label>
              <Select
                value={seniority}
                onValueChange={(value) =>
                  setSeniority(value as "junior" | "senior")
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">{t("fields.junior")}</SelectItem>
                  <SelectItem value="senior">{t("fields.senior")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="workers" className="text-sm font-medium">
                {t("fields.workersNeeded")} {t("fields.required")}
              </Label>
              <Input
                id="workers"
                type="number"
                min={1}
                value={workersNeeded}
                onChange={(e) =>
                  setWorkersNeeded(parseInt(e.target.value) || 1)
                }
                className="mt-2"
              />
              {editingJob && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dialog.appliesToAllShifts")}
                </p>
              )}
            </div>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location" className="text-sm font-medium">
              {t("fields.location")}
            </Label>
            <Select
              value={locationId?.toString() || "none"}
              onValueChange={(value) =>
                setLocationId(value === "none" ? null : parseInt(value))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={t("fields.selectLocation")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("fields.noLocation")}</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id.toString()}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div>
            <Label htmlFor="startDate" className="text-sm font-medium">
              {t("fields.startDate")} {t("fields.required")}
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                e.target.blur();
              }}
              min={editingJob ? undefined : today}
              className="mt-2"
            />
            {!editingJob && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("dialog.mustBeFutureDate")}
              </p>
            )}
          </div>

          {/* Multiple Days Checkbox */}
          <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
            <Checkbox
              id="multipleDays"
              checked={isMultipleDays}
              onCheckedChange={(checked) => setIsMultipleDays(checked === true)}
            />
            <Label htmlFor="multipleDays" className="cursor-pointer">
              {t("dialog.multipleDaysLabel")}
            </Label>
          </div>

          {/* End Date (if multiple days) */}
          {isMultipleDays && (
            <div>
              <Label htmlFor="endDate" className="text-sm font-medium">
                {t("fields.endDate")} {t("fields.required")}
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  e.target.blur();
                }}
                min={startDate}
                className="mt-2"
              />
            </div>
          )}

          {/* Shift Times */}
          {!editingJob ? (
            <>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">
                  {t("dialog.shiftTimes")}
                </h4>
              </div>

              <TimePickerSelect
                value={startTime}
                onChange={setStartTime}
                label={t("fields.startTime")}
                required
              />

              <TimePickerSelect
                value={endTime}
                onChange={setEndTime}
                label={t("fields.endTime")}
                required
              />
              <p className="text-xs text-muted-foreground -mt-2">
                {t("dialog.allShiftsNote")}
              </p>
            </>
          ) : (
            <>
              {!loadingShiftTimes && (
                <>
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-1">
                      {t("dialog.updateShiftTimes")}
                    </h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      {t("dialog.updateShiftTimesDescription")}
                    </p>
                  </div>

                  <TimePickerSelect
                    value={shiftStartTime}
                    onChange={setShiftStartTime}
                    label={t("fields.shiftStartTime")}
                  />

                  <TimePickerSelect
                    value={shiftEndTime}
                    onChange={setShiftEndTime}
                    label={t("fields.shiftEndTime")}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 justify-between pt-6 border-t bottom-0 bg-background">
          <div>
            {editingJob &&
              (() => {
                const todayStr = new Date().toISOString().split("T")[0];
                const jobHasStarted = editingJob.start_date <= todayStr;

                return (
                  <Button
                    variant="destructive"
                    onClick={handleCancelAllShifts}
                    disabled={saving}
                  >
                    {jobHasStarted
                      ? t("dialog.cancelAllShifts")
                      : t("dialog.deleteJob")}
                  </Button>
                );
              })()}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel}>
              {t("dialog.close")}
            </Button>
            {editingJob && (
              <Button
                variant="outline"
                onClick={() => setStaffingOpen(true)}
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                {t("dialog.staff")}
              </Button>
            )}
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? t("dialog.saving")
                : editingJob
                ? t("dialog.updateButton")
                : t("dialog.createButton")}
            </Button>
          </div>
        </div>
      </DialogContent>

      {editingJob && (
        <StaffingModal
          open={staffingOpen}
          onOpenChange={setStaffingOpen}
          job={editingJob}
          position={position}
          companyId={companyId}
          onSave={onSave}
        />
      )}
    </>
  );
}
