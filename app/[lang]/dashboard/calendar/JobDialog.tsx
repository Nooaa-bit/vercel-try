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

interface Employee {
  userId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePicture: string | null;
  role: string;
  roleId: number;
  joinedAt: Date;
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

  // ✅ NEW: Staffing modal state
  const [staffingOpen, setStaffingOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<number>>(
    new Set()
  );
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sendingInvites, setSendingInvites] = useState(false);

  // ✅ Pre-fill if editing
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

  // ✅ Auto-set end date when start date changes if not multiple days
  useEffect(() => {
    if (!isMultipleDays && startDate) {
      setEndDate(startDate);
    }
  }, [startDate, isMultipleDays]);

  // ✅ Load employees when staffing modal opens
  const handleStaffingClick = async () => {
    setStaffingOpen(true);
    setLoadingEmployees(true);

    try {
      const users = await getCompanyUsers(companyId);
      setEmployees(users);
      setSelectedEmployees(new Set());
      setSearchTerm("");
    } catch (error) {
      console.error("Failed to load employees:", error);
      toast.error("Failed to load employees");
    } finally {
      setLoadingEmployees(false);
    }
  };

  // ✅ Toggle employee selection
  const toggleEmployee = (userId: number) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedEmployees(newSelected);
  };

  // ✅ Filter employees by search
  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.firstName || ""} ${
      emp.lastName || ""
    }`.toLowerCase();
    const email = emp.email.toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  // ✅ Send invitations
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
      console.log("🔍 Sending invitations for jobId:", editingJob.id);
      console.log("🔍 Selected employees:", Array.from(selectedEmployees));

      const response = await fetch(`/api/job-invitation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: editingJob.id,
          userIds: Array.from(selectedEmployees),
        }),
      });

      const data = await response.json();

      console.log("📡 API Response Status:", response.status);
      console.log("📡 API Response Data:", data);

      if (!response.ok) {
        console.error("❌ API Error:", data.error || "Unknown error");
        throw new Error(data.error || "Failed to send invitations");
      }

      console.log("✅ Success:", data);
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


  const handleSave = async () => {
    if (!position || !startDate || !startTime || !endTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);

    try {
      const finalEndDate = isMultipleDays ? endDate : startDate;

      if (!activeRole || !activeRole.id) {
        toast.error("User not authenticated");
        setSaving(false);
        return;
      }

      const now = new Date().toISOString();

      if (editingJob) {
        // ✅ UPDATE existing job
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

        toast.success("Job updated successfully");
      } else {
        // ✅ CREATE new job
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

        // ✅ Generate shifts for each day
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
        start_time: startTimeStr,
        end_time: endTimeStr,
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
      {/* ✅ Main Job Dialog */}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&_button[data-radix-dialog-close]]:z-50">
        <DialogHeader className="top-0 bg-background z-8 pt-6 border-b">
          <DialogTitle>
            {editingJob ? "Edit Job" : "Create New Job"}
          </DialogTitle>
          <DialogDescription>
            {editingJob
              ? "Update the job details"
              : "Create a new job and shifts will be generated for each day"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pr-4">
          {/* Position */}
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

          {/* Description */}
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

          {/* Seniority & Workers */}
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

          {/* Location */}
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

          {/* Start Date */}
          <div>
            <Label htmlFor="startDate" className="text-sm font-medium">
              Start Date *
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* Start Time */}
          <div>
            <Label htmlFor="startTime" className="text-sm font-medium">
              Start Time *
            </Label>
            <Input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* End Time */}
          <div>
            <Label htmlFor="endTime" className="text-sm font-medium">
              End Time *
            </Label>
            <Input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* Multiple Days Checkbox */}
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

          {/* End Date (only show if multiple days) */}
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
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-6 border-t bottom-0 bg-background">
          <Button variant="outline" onClick={onCancel}>
            Cancel
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
      </DialogContent>

      {/* ✅ Staffing Modal */}
      <Dialog open={staffingOpen} onOpenChange={setStaffingOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Staff Job: {position || "Untitled"}</DialogTitle>
            <DialogDescription>
              Select employees to invite to this job
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Employee List */}
            {loadingEmployees ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading employees...
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No employees found
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-lg p-4">
                {filteredEmployees.map((emp) => (
                  <div
                    key={emp.userId}
                    className="flex items-center space-x-3 p-2 hover:bg-muted rounded cursor-pointer"
                    onClick={() => toggleEmployee(emp.userId)}
                  >
                    <Checkbox
                      checked={selectedEmployees.has(emp.userId)}
                      onCheckedChange={() => toggleEmployee(emp.userId)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {emp.firstName && emp.lastName
                          ? `${emp.firstName} ${emp.lastName}`
                          : emp.email}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {emp.email}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selection Count */}
            <div className="text-sm text-muted-foreground">
              {selectedEmployees.size} selected
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-6 border-t">
            <Button variant="outline" onClick={() => setStaffingOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendInvites}
              disabled={selectedEmployees.size === 0 || sendingInvites}
              className="bg-primary hover:bg-primary/90"
            >
              {sendingInvites
                ? "Sending..."
                : `Send Invitations (${selectedEmployees.size})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
