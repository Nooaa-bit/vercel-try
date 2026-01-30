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
import {
  VALID_POSITIONS,
  isValidPosition,
  type JobPosition,
} from "@/lib/positions";

interface Job {
  id: number;
  company_id: number;
  position: string;
  title: string | null; 
  seniority: "junior" | "senior";
  description: string | null;
  start_date: string;
  end_date: string;
  location_id: number | null;
  hourly_rate: string | null;
  shift_rate: string | null;
  check_in_radius_job: number | null;
  check_in_window_minutes: number;
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
  const [title, setTitle] = useState(""); 
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
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [shiftRate, setShiftRate] = useState<string>("");
  const [checkInRadius, setCheckInRadius] = useState<number>(0);
  const [checkInWindow, setCheckInWindow] = useState<number>(0);

  useEffect(() => {
    if (editingJob) {
      setPosition(editingJob.position);
      setTitle(editingJob.title || ""); 
      setSeniority(editingJob.seniority);
      setDescription(editingJob.description || "");
      setLocationId(editingJob.location_id);
      setStartDate(editingJob.start_date);
      setEndDate(editingJob.end_date);
      setIsMultipleDays(editingJob.start_date !== editingJob.end_date);

      // Load new fields
      setHourlyRate(editingJob.hourly_rate || "");
      setShiftRate(editingJob.shift_rate || "");
      setCheckInRadius(editingJob.check_in_radius_job || 50);
      setCheckInWindow(editingJob.check_in_window_minutes || 5);
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
            0,
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
    if (!startDate) {
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
          startDate + "T" + shiftStartTime + ":00",
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
          (shift) => (assignmentsByShift[shift.id] || 0) > workersNeeded,
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
            { duration: 6000 },
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
            (s) => s.shift_date === todayStr,
          );

          if (todayShift && hasAssignments) {
            const todayHasAssignments = assignments?.some(
              (a) => a.shift_id === todayShift.id,
            );

            if (todayHasAssignments) {
              const [hours, minutes, seconds] =
                todayShift.start_time.split(":");
              const shiftStartDateTime = new Date();
              shiftStartDateTime.setHours(
                parseInt(hours),
                parseInt(minutes),
                parseInt(seconds || "0"),
                0,
              );

              const timeDiffInHours =
                (shiftStartDateTime.getTime() - now.getTime()) /
                (1000 * 60 * 60);

              if (timeDiffInHours < 1 && timeDiffInHours > 0) {
                toast.error(
                  t("validation.cannotChangeDates", {
                    time: todayShift.start_time.slice(0, 5),
                  }),
                  { duration: 6000 },
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
              },
            );

            if (deleteError) {
              console.error("Error deleting outside shifts:", deleteError);
              throw new Error(t("validation.deleteShiftsFailed"));
            }

            toast.info(
              t("validation.shiftsDeleted", { count: outsideShifts.length }),
            );
          } catch (error) {
            const errorMessage = getErrorMessage(error);
            console.error("Error handling outside shifts:", errorMessage);
            toast.error(
              t("validation.dateChangeFailed", { error: errorMessage }),
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
            title: title || null,
            seniority,
            description: description || null,
            location_id: locationId,
            start_date: startDate,
            end_date: finalEndDate,
            hourly_rate: hourlyRate || null,
            shift_rate: shiftRate || null,
            check_in_radius_job: checkInRadius || null,
            check_in_window_minutes: checkInWindow,
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
          },
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
            p_title: title || null,
            p_seniority: seniority,
            p_description: description || null,
            p_workers_needed: workersNeeded,
            p_location_id: locationId,
            p_start_date: startDate,
            p_end_date: finalEndDate,
            p_start_time: startTime + ":00",
            p_end_time: endTime + ":00",
            p_created_by: activeRole.userId,
            p_hourly_rate: hourlyRate || null,
            p_shift_rate: shiftRate || null,
            p_check_in_radius_job: checkInRadius || null,
            p_check_in_window_minutes: checkInWindow,
          },
        );

        if (rpcError) {
          console.error("Job creation error:", rpcError);
          throw rpcError;
        }

        toast.success(
          t("toast.createSuccess", { count: rpcData.created_shifts }),
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingJob ? t("dialog.editTitle") : t("dialog.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {editingJob
              ? t("dialog.editDescription")
              : t("dialog.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 1. POSITION - Dropdown , JOB TITLE (Optional)*/}
          <div>
            <Label>
              {t("fields.position")} {t("fields.required")}
            </Label>
            <Select
              value={position}
              onValueChange={(value) => setPosition(value)}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={t("fields.selectPosition")} />
              </SelectTrigger>
              <SelectContent>
                {VALID_POSITIONS.map((pos) => (
                  <SelectItem key={pos} value={pos}>
                    {t(`positions.${pos}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* JOB TITLE (Optional) */}
          <div>
            <Label>{t("fields.title")}</Label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("fields.titlePlaceholder")}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("fields.titleHelper")}
            </p>
          </div>

          {/* 2. SENIORITY & WORKERS NEEDED - Same row, equal height */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>
                {t("fields.seniority")} {t("fields.required")}
              </Label>
              <Select
                value={seniority}
                onValueChange={(value) =>
                  setSeniority(value as "junior" | "senior")
                }
              >
                <SelectTrigger className="mt-2 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">{t("fields.junior")}</SelectItem>
                  <SelectItem value="senior">{t("fields.senior")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>
                {t("fields.workersNeeded")} {t("fields.required")}
              </Label>
              <Input
                type="number"
                min="1"
                value={workersNeeded}
                onChange={(e) =>
                  setWorkersNeeded(parseInt(e.target.value) || 1)
                }
                className="mt-2 h-10"
              />
            </div>
          </div>

          {editingJob && (
            <p className="text-sm text-muted-foreground">
              {t("dialog.appliesToAllShifts")}
            </p>
          )}

          {/* 3. START DATE */}
          <div>
            <Label>
              {t("fields.startDate")} {t("fields.required")}
            </Label>
            <Input
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
              <p className="text-sm text-muted-foreground mt-1">
                {t("dialog.mustBeFutureDate")}
              </p>
            )}
          </div>

          {/* 4. MULTIPLE DAYS CHECKBOX - Highlighted */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="multipleDays"
                checked={isMultipleDays}
                onCheckedChange={(checked) =>
                  setIsMultipleDays(checked === true)
                }
              />
              <Label htmlFor="multipleDays" className="cursor-pointer">
                {t("dialog.multipleDaysLabel")}
              </Label>
            </div>
          </div>

          {/* End Date (if multiple days) */}
          {isMultipleDays && (
            <div>
              <Label>
                {t("fields.endDate")} {t("fields.required")}
              </Label>
              <Input
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

          {/* 5. SHIFT TIMES */}
          <div>
            {!editingJob ? (
              <>
                <Label>{t("dialog.shiftTimes")}</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  {t("dialog.allShiftsNote")}
                </p>
              </>
            ) : (
              <>
                {!loadingShiftTimes && (
                  <>
                    <Label>{t("dialog.updateShiftTimes")}</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t("dialog.updateShiftTimesDescription")}
                    </p>
                  </>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <TimePickerSelect
                  value={editingJob ? shiftStartTime : startTime}
                  onChange={editingJob ? setShiftStartTime : setStartTime}
                  label={t("fields.startTime")}
                />
              </div>
              <div className="space-y-2">
                <TimePickerSelect
                  value={editingJob ? shiftEndTime : endTime}
                  onChange={editingJob ? setShiftEndTime : setEndTime}
                  label={t("fields.endTime")}
                />
              </div>
            </div>
          </div>

          {/* 6. RATES - Hourly Rate & Shift Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("fields.hourlyRate")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="15.50"
                className="mt-2 placeholder:opacity-30"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("fields.hourlyRateHelper")}
              </p>
            </div>

            <div>
              <Label>{t("fields.shiftRate")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={shiftRate}
                onChange={(e) => setShiftRate(e.target.value)}
                placeholder="120.00"
                className="mt-2 placeholder:opacity-30"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("fields.shiftRateHelper")}
              </p>
            </div>
          </div>

          {/* 7. LOCATION */}
          <div>
            <Label>{t("fields.location")}</Label>
            <Select
              value={locationId?.toString() || "none"}
              onValueChange={(value) =>
                setLocationId(value === "none" ? null : parseInt(value))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
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

          {/* 8. CHECK-IN SETTINGS */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("fields.checkInRadius")}</Label>
              <Input
                type="number"
                min="10"
                step="10"
                value={checkInRadius}
                onChange={(e) =>
                  setCheckInRadius(parseInt(e.target.value) || 50)
                }
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("fields.checkInRadiusHelper")}
              </p>
            </div>

            <div>
              <Label>{t("fields.checkInWindow")}</Label>
              <Input
                type="number"
                min="1"
                max="60"
                value={checkInWindow}
                onChange={(e) =>
                  setCheckInWindow(parseInt(e.target.value) || 5)
                }
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("fields.checkInWindowHelper")}
              </p>
            </div>
          </div>

          {/* 9. DESCRIPTION - Moved to end */}
          <div>
            <Label>{t("fields.description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("fields.descriptionPlaceholder")}
              className="mt-2"
              rows={3}
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-between mt-6">
          {/* Left side - Delete/Cancel button */}
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

          {/* Right side - Action buttons */}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              {t("dialog.close")}
            </Button>

            {/* HIGHLIGHTED STAFF BUTTON */}
            {editingJob && (
              <Button
                onClick={() => setStaffingOpen(true)}
                className="gap-2 bg-gradient-to-r from-red-600 to-yellow-600 hover:from-yellow-700 hover:to-purple-700 text-white font-semibold shadow-md"
              >
                <Users className="w-4 h-4" />
                {t("dialog.staff")}
              </Button>
            )}

            {/* Save/Update button */}
            <Button onClick={handleSave} disabled={saving}>
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
          jobId={editingJob.id}
          position={position}
          companyId={companyId}
          onSave={onSave}
        />
      )}
    </>
  );
}
