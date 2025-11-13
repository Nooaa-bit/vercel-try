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
import { Users, Search } from "lucide-react";
import { getCompanyUsers } from "@/lib/company-users";
import { TimePickerSelect } from "@/components/TimePickerSelect";
import {
  fetchRemainingShifts,
  calculateAllEmployeesAvailability,
  assignStaffToShifts,
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
  workers_needed: number;
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

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (editingJob) {
      setPosition(editingJob.position);
      setSeniority(editingJob.seniority);
      setDescription(editingJob.description || "");
      setWorkersNeeded(editingJob.workers_needed);
      setLocationId(editingJob.location_id);
      setStartDate(editingJob.start_date);
      setEndDate(editingJob.end_date);
      setIsMultipleDays(editingJob.start_date !== editingJob.end_date);
    }
  }, [editingJob]);

  useEffect(() => {
    if (editingJob) {
      const loadShiftTimes = async () => {
        setLoadingShiftTimes(true);
        try {
          const todayStr = new Date().toISOString().split("T")[0];

          const { data: shiftData, error } = await supabase
            .from("shift")
            .select("start_time, end_time")
            .eq("job_id", editingJob.id)
            .gte("shift_date", todayStr)
            .is("deleted_at", null)
            .order("shift_date", { ascending: true })
            .limit(1)
            .single();

          if (!error && shiftData) {
            setShiftStartTime(shiftData.start_time.slice(0, 5));
            setShiftEndTime(shiftData.end_time.slice(0, 5));
          }
        } catch (error) {
          console.error("Error loading shift times:", error);
        } finally {
          setLoadingShiftTimes(false);
        }
      };

      loadShiftTimes();
    }
  }, [editingJob, supabase]);

  useEffect(() => {
    if (!isMultipleDays && startDate) {
      setEndDate(startDate);
    }
  }, [startDate, isMultipleDays]);

  const handleStaffingClick = async () => {
    if (!editingJob) return;

    setStaffingOpen(true);
    setLoadingEmployees(true);
    setLoadingAvailability(true);

    try {
      const users = await getCompanyUsers(companyId);
      setEmployees(users);
      setSelectedEmployees(new Set());
      setSearchTerm("");

      const shifts = await fetchRemainingShifts(supabase, editingJob.id);
      setRemainingShifts(shifts);

      if (shifts.length === 0) {
        setLoadingAvailability(false);
        setLoadingEmployees(false);
        toast.error("No remaining shifts for this job");
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
      toast.error("Failed to load staffing data");
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
      toast.error("Please select at least one employee");
      return;
    }

    if (!editingJob) {
      toast.error("Job must be created first");
      return;
    }

    setSendingInvites(true);

    try {
      const response = await fetch(`/api/job-invitation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: editingJob.id,
          userIds: Array.from(selectedEmployees),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitations");
      }

      toast.success(
        `Invitations sent to ${selectedEmployees.size} employee(s)`
      );
      setStaffingOpen(false);
      setSelectedEmployees(new Set());
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("❌ Error sending invitations:", errorMessage);
      toast.error(`Failed to send invitations: ${errorMessage}`);
    } finally {
      setSendingInvites(false);
    }
  };

  const handleAssignStaff = async () => {
    if (selectedEmployees.size === 0) {
      toast.error("Please select at least one employee");
      return;
    }

    if (!editingJob || !activeRole?.id) {
      toast.error("Invalid job or user");
      return;
    }

    if (remainingShifts.length === 0) {
      toast.error("No shifts to assign");
      return;
    }

    setSendingInvites(true);

    try {
      const result = await assignStaffToShifts(
        supabase,
        Array.from(selectedEmployees),
        remainingShifts,
        activeRole.id,
        employeeAvailabilities
      );

      if (result.success > 0) {
        toast.success(
          `Assigned ${result.success} shift(s) to ${selectedEmployees.size} employee(s)`,
          {
            description: result.details.join(", "),
          }
        );
      }

      if (result.skipped > 0) {
        toast.warning(
          `${result.skipped} shift(s) skipped due to conflicts or capacity`
        );
      }

      setStaffingOpen(false);
      setSelectedEmployees(new Set());
      onSave();
    } catch (error) {
      console.error("Error assigning staff:", error);
      toast.error("Failed to assign staff");
    } finally {
      setSendingInvites(false);
    }
  };

  const handleCancelAllShifts = async () => {
    if (!editingJob) return;

    const todayStr = new Date().toISOString().split("T")[0];
    const jobHasStarted = editingJob.start_date <= todayStr;

    const confirmMessage = jobHasStarted
      ? `Cancel all remaining shifts for "${position}"? The job end date will be updated to yesterday. This cannot be undone.`
      : `Delete the job "${position}"? This will delete the job and all its shifts. This cannot be undone.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setSaving(true);

    try {
      const now = new Date().toISOString();

      if (jobHasStarted) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        const { error: shiftError } = await supabase
          .from("shift")
          .update({
            deleted_at: now,
          })
          .eq("job_id", editingJob.id)
          .gte("shift_date", todayStr)
          .is("deleted_at", null);

        if (shiftError) throw shiftError;

        const { error: jobError } = await supabase
          .from("job")
          .update({
            end_date: yesterdayStr,
          })
          .eq("id", editingJob.id);

        if (jobError) throw jobError;

        toast.success(`All remaining shifts cancelled for ${position}`);
      } else {
        const { error: jobError } = await supabase
          .from("job")
          .update({
            deleted_at: now,
            deleted_by: activeRole?.id || null,
          })
          .eq("id", editingJob.id);

        if (jobError) throw jobError;

        const { error: shiftError } = await supabase
          .from("shift")
          .update({
            deleted_at: now,
          })
          .eq("job_id", editingJob.id)
          .is("deleted_at", null);

        if (shiftError) {
          console.error("Error deleting shifts:", shiftError);
        }

        toast.success(`Job "${position}" and all shifts deleted successfully`);
      }

      onSave();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("Error:", errorMessage);
      toast.error(
        `Failed to ${jobHasStarted ? "cancel shifts" : "delete job"}`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!position || !startDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!editingJob) {
      if (!startTime || !endTime) {
        toast.error("Please fill in start and end times");
        return;
      }

      if (endTime <= startTime) {
        toast.error("End time must be after start time");
        return;
      }

      const now = new Date();
      const selectedDateTime = new Date(startDate + "T" + startTime + ":00");

      if (selectedDateTime < now) {
        toast.error(
          "Cannot create jobs in the past. Please select a future date/time."
        );
        return;
      }

      if (isMultipleDays) {
        if (!endDate) {
          toast.error("Please set an end date");
          return;
        }

        if (endDate < startDate) {
          toast.error("End date cannot be before start date");
          return;
        }
      }
    }

    if (editingJob) {
      if (shiftEndTime <= shiftStartTime) {
        toast.error("Shift end time must be after start time");
        return;
      }
    }

    setSaving(true);

    try {
      const finalEndDate = isMultipleDays ? endDate : startDate;

      if (!finalEndDate) {
        toast.error("Please set an end date");
        setSaving(false);
        return;
      }

      if (!activeRole || !activeRole.id) {
        toast.error("User not authenticated");
        setSaving(false);
        return;
      }

      const now = new Date().toISOString();

      if (editingJob) {
        const { error } = await supabase
          .from("job")
          .update({
            position,
            seniority,
            description: description || null,
            workers_needed: workersNeeded,
            location_id: locationId,
            start_date: startDate,
            end_date: finalEndDate,
          })
          .eq("id", editingJob.id);

        if (error) {
          console.error("Job update error:", error);
          throw error;
        }

        const todayStr = new Date().toISOString().split("T")[0];

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
        }

        toast.success("Job and remaining shifts updated successfully");
      } else {
        const { data: jobData, error: jobError } = await supabase
          .from("job")
          .insert({
            company_id: companyId,
            position,
            seniority,
            description: description || null,
            workers_needed: workersNeeded,
            location_id: locationId,
            start_date: startDate,
            end_date: finalEndDate,
            created_by: activeRole.id,
            created_at: now,
          })
          .select()
          .single();

        if (jobError) {
          console.error("Job creation error:", jobError);
          throw jobError;
        }

        const shifts = generateShifts(
          jobData.id,
          startDate,
          finalEndDate,
          startTime,
          endTime,
          workersNeeded,
          now
        );

        if (shifts.length > 0) {
          const { error: shiftsError } = await supabase
            .from("shift")
            .insert(shifts);

          if (shiftsError) {
            console.error("Shifts creation error:", shiftsError);
            throw shiftsError;
          }
        }

        toast.success(
          `Job created with ${shifts.length} shift(s) successfully`
        );
      }

      onSave();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("Error saving job:", errorMessage);
      toast.error(`Failed to save job: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const generateShifts = (
    jobId: number,
    startDateStr: string,
    endDateStr: string,
    startTimeStr: string,
    endTimeStr: string,
    workersNeeded: number,
    now: string
  ) => {
    const shifts: Array<{
      job_id: number;
      shift_date: string;
      start_time: string;
      end_time: string;
      workers_needed: number;
      created_at: string;
    }> = [];

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const shiftDate = d.toISOString().split("T")[0];

      shifts.push({
        job_id: jobId,
        shift_date: shiftDate,
        start_time: startTimeStr + ":00",
        end_time: endTimeStr + ":00",
        workers_needed: workersNeeded,
        created_at: now,
      });
    }

    return shifts;
  };

  if (!ready) {
    return null;
  }

  return (
    <>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&_button[data-radix-dialog-close]]:z-50">
        <DialogHeader className="top-0 bg-background z-8 pt-6 border-b pb-4">
          <DialogTitle>
            {editingJob ? "Edit Job" : "Create New Job"}
          </DialogTitle>
          <DialogDescription>
            {editingJob
              ? "Update the job details and shift times for remaining shifts"
              : "Create a new job and shifts will be generated for each day"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pr-4">
          <div>
            <Label htmlFor="position" className="text-sm font-medium">
              Position *
            </Label>
            <Input
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g., Delivery Driver"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Job details..."
              className="mt-2"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="seniority" className="text-sm font-medium">
                Seniority *
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
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="workers" className="text-sm font-medium">
                Workers Needed *
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
            </div>
          </div>

          <div>
            <Label htmlFor="location" className="text-sm font-medium">
              Location
            </Label>
            <Select
              value={locationId?.toString() || "none"}
              onValueChange={(value) =>
                setLocationId(value === "none" ? null : parseInt(value))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No location</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id.toString()}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="startDate" className="text-sm font-medium">
              Start Date *
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={editingJob ? undefined : today}
              className="mt-2"
            />
            {!editingJob && (
              <p className="text-xs text-muted-foreground mt-1">
                Must be today or a future date
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
            <Checkbox
              id="multipleDays"
              checked={isMultipleDays}
              onCheckedChange={(checked) => setIsMultipleDays(checked === true)}
            />
            <Label htmlFor="multipleDays" className="cursor-pointer">
              This job spans multiple days
            </Label>
          </div>

          {isMultipleDays && (
            <div>
              <Label htmlFor="endDate" className="text-sm font-medium">
                End Date *
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="mt-2"
              />
            </div>
          )}

          {!editingJob ? (
            <>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Shift Times</h4>
              </div>

              <TimePickerSelect
                value={startTime}
                onChange={setStartTime}
                label="Start Time"
                required
              />

              <TimePickerSelect
                value={endTime}
                onChange={setEndTime}
                label="End Time"
                required
              />
              <p className="text-xs text-muted-foreground -mt-2">
                These times will be applied to all shifts
              </p>
            </>
          ) : (
            <>
              {!loadingShiftTimes && (
                <>
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-1">
                      Update Remaining Shift Times
                    </h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Change the times for all remaining shifts (today and
                      future). Past shifts will not be affected.
                    </p>
                  </div>

                  <TimePickerSelect
                    value={shiftStartTime}
                    onChange={setShiftStartTime}
                    label="Shift Start Time"
                  />

                  <TimePickerSelect
                    value={shiftEndTime}
                    onChange={setShiftEndTime}
                    label="Shift End Time"
                  />
                </>
              )}
            </>
          )}
        </div>

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
                      ? "Cancel All Remaining Shifts"
                      : "Delete Job"}
                  </Button>
                );
              })()}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel}>
              Close
            </Button>
            {editingJob && (
              <Button
                variant="outline"
                onClick={handleStaffingClick}
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                Staff
              </Button>
            )}
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : editingJob ? "Update Job" : "Create Job"}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* ✅ COMPACT Staffing Modal */}
      <Dialog open={staffingOpen} onOpenChange={setStaffingOpen} modal={true}>
        <DialogContent
          className="max-w-3xl h-[75vh] flex flex-col"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex-shrink-0 pb-3">
            <DialogTitle>Staff Job: {position || "Untitled"}</DialogTitle>
            <DialogDescription className="text-xs">
              Assign employees to remaining shifts for this job
            </DialogDescription>
          </DialogHeader>

          {loadingEmployees || loadingAvailability ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Loading employees and availability...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                {/* Compact Capacity Overview */}
                <div className="flex-shrink-0 p-2 bg-muted rounded-lg flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">Capacity: </span>
                    <span className="text-primary font-bold">
                      {shiftCapacity.filled}/{shiftCapacity.total}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {remainingShifts.length} shift(s) ·{" "}
                    {shiftCapacity.remaining} position(s) available
                  </div>
                </div>

                {/* Compact Search */}
                <div className="flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>

                {/* Scrollable Employee List */}
                <div className="flex-1 min-h-0 border rounded-lg">
                  <div className="h-full overflow-y-auto p-3">
                    <div className="space-y-1.5">
                      {(() => {
                        const filtered = employeeAvailabilities.filter(
                          (avail) => {
                            const fullName = `${
                              avail.employee.firstName || ""
                            } ${avail.employee.lastName || ""}`.toLowerCase();
                            const email = avail.employee.email.toLowerCase();
                            const search = searchTerm.toLowerCase();
                            return (
                              fullName.includes(search) ||
                              email.includes(search)
                            );
                          }
                        );

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              No employees found
                            </div>
                          );
                        }

                        return filtered.map((avail) => {
                          const isDisabled =
                            avail.isFullyAssigned || avail.isUnavailable;
                          const canSelect = !isDisabled;

                          return (
                            <div
                              key={avail.employee.userId}
                              className={`flex items-start space-x-2 p-2 rounded transition-colors ${
                                isDisabled
                                  ? "opacity-50 cursor-not-allowed"
                                  : "hover:bg-muted cursor-pointer"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canSelect) {
                                  toggleEmployee(avail.employee.userId);
                                }
                              }}
                            >
                              <Checkbox
                                checked={selectedEmployees.has(
                                  avail.employee.userId
                                )}
                                onCheckedChange={() => {
                                  if (canSelect) {
                                    toggleEmployee(avail.employee.userId);
                                  }
                                }}
                                disabled={isDisabled}
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

                                {avail.isFullyAssigned ? (
                                  <div className="text-xs text-green-600 mt-0.5">
                                    ✓ Assigned to all {avail.total} shift(s)
                                  </div>
                                ) : avail.isUnavailable ? (
                                  <div className="text-xs text-red-600 mt-0.5">
                                    ✗ Unavailable (conflicts or full)
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
                                      {avail.available}/{avail.total} shift(s)
                                    </span>
                                    {avail.alreadyAssigned > 0 && (
                                      <span className="text-muted-foreground ml-1">
                                        ({avail.alreadyAssigned} assigned)
                                      </span>
                                    )}
                                    {avail.conflicts > 0 && (
                                      <span className="text-orange-600 ml-1">
                                        ({avail.conflicts} conflicts)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* Compact Selection Count */}
                <div className="flex-shrink-0 text-sm text-muted-foreground">
                  {selectedEmployees.size} employee(s) selected
                </div>
              </div>

              {/* Fixed Actions */}
              <div className="flex-shrink-0 flex gap-2 justify-end pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStaffingOpen(false);
                  }}
                >
                  Cancel
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
                  {sendingInvites ? "Sending..." : "Send Invitations"}
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
                    loadingAvailability
                  }
                  className="bg-primary hover:bg-primary/90"
                >
                  {sendingInvites ? "Assigning..." : "Assign to Shifts"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
