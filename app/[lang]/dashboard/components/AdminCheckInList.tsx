"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LogIn,
  LogOut,
  Clock,
  User,
  Briefcase,
  MapPin,
  Loader2,
  CheckCircle2,
  Circle,
  Shield,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { adminCheckIn, adminCheckOut } from "../actions";

// Properly typed admin check-in interfaces
interface AdminWorkerShift {
  assignmentId: number;
  workerId: number;
  workerName: string;
  workerEmail: string;
  shiftId: number;
  shiftDate: string;
  startTime: string;
  endTime: string;
  jobId: number;
  jobTitle: string | null;
  jobPosition: string;
  jobSeniority: string;
  locationName: string | null;
  checkInData: AdminCheckInData | null;
}

interface AdminCheckInData {
  id: number;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  checkedInBy: number | null;
  checkInMethod: string | null;
}

export function AdminCheckInList() {
  const { t } = useTranslation(["checkin", "jobs"]);
  const supabase = createClient();

  const [shifts, setShifts] = useState<AdminWorkerShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch shifts within -6 to +2 hours window
  const fetchShifts = async () => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const todayStr = now.toISOString().split("T")[0];

      console.log("[AdminCheckIn] Fetching shifts for date:", todayStr);
      console.log("[AdminCheckIn] Time window:", {
        start: sixHoursAgo.toISOString(),
        end: twoHoursLater.toISOString(),
      });

      // Step 1: Get today's shifts first
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("shift")
        .select("id, shift_date, start_time, end_time, job_id")
        .eq("shift_date", todayStr)
        .is("deleted_at", null);

      if (shiftsError) {
        console.error("[AdminCheckIn] Shifts error:", shiftsError);
        throw shiftsError;
      }

      console.log("[AdminCheckIn] Found shifts:", shiftsData?.length || 0);

      if (!shiftsData || shiftsData.length === 0) {
        setShifts([]);
        setError("No shifts found for today");
        return;
      }

      // Filter by time window (-6 to +2 hours)
      const filteredShifts = shiftsData.filter((shift) => {
        const shiftStart = new Date(`${shift.shift_date}T${shift.start_time}`);
        return shiftStart >= sixHoursAgo && shiftStart <= twoHoursLater;
      });

      console.log(
        "[AdminCheckIn] Shifts in time window:",
        filteredShifts.length,
      );

      if (filteredShifts.length === 0) {
        setShifts([]);
        setError("No shifts in the -6 to +2 hours window");
        return;
      }

      // Step 2: Get shift assignments for these shifts
      const shiftIds = filteredShifts.map((s) => s.id);
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("shift_assignment")
        .select("id, shift_id, user_id")
        .in("shift_id", shiftIds)
        .is("cancelled_at", null)
        .is("deleted_at", null);

      if (assignmentsError) {
        console.error("[AdminCheckIn] Assignments error:", assignmentsError);
        throw assignmentsError;
      }

      console.log(
        "[AdminCheckIn] Found assignments:",
        assignmentsData?.length || 0,
      );

      if (!assignmentsData || assignmentsData.length === 0) {
        setShifts([]);
        setError("No workers assigned to shifts in this time window");
        return;
      }

      // Step 3: Get worker details
      const workerIds = [...new Set(assignmentsData.map((a) => a.user_id))];
      const { data: workersData, error: workersError } = await supabase
        .from("user")
        .select("id, full_name, email")
        .in("id", workerIds);

      if (workersError) {
        console.error("[AdminCheckIn] Workers error:", workersError);
        throw workersError;
      }

      const workersMap = new Map(
        (workersData || []).map((w) => [
          w.id,
          { id: w.id, full_name: w.full_name, email: w.email },
        ]),
      );

      // Step 4: Get job details
      const jobIds = [...new Set(filteredShifts.map((s) => s.job_id))];
      const { data: jobsData, error: jobsError } = await supabase
        .from("job")
        .select("id, position, title, seniority, location_id")
        .in("id", jobIds);

      if (jobsError) {
        console.error("[AdminCheckIn] Jobs error:", jobsError);
        throw jobsError;
      }

      const jobsMap = new Map(
        (jobsData || []).map((j) => [
          j.id,
          {
            id: j.id,
            position: j.position,
            title: j.title,
            seniority: j.seniority,
            location_id: j.location_id,
          },
        ]),
      );

      // Step 5: Get location details
      const locationIds = [
        ...new Set(
          (jobsData || [])
            .map((j) => j.location_id)
            .filter((id): id is number => id !== null),
        ),
      ];

      let locationsMap = new Map();
      if (locationIds.length > 0) {
        const { data: locationsData, error: locationsError } = await supabase
          .from("location")
          .select("id, name")
          .in("id", locationIds);

        if (locationsError) {
          console.error("[AdminCheckIn] Locations error:", locationsError);
        } else {
          locationsMap = new Map(
            (locationsData || []).map((loc) => [loc.id, loc]),
          );
        }
      }

      // Step 6: Get check-in data
      const assignmentIds = assignmentsData.map((a) => a.id);
      const { data: checkInsData, error: checkInsError } = await supabase
        .from("check_in_out")
        .select(
          "id, assignment_id, check_in_time, check_out_time, checked_in_by, check_in_method",
        )
        .in("assignment_id", assignmentIds);

      if (checkInsError) {
        console.error("[AdminCheckIn] Check-ins error:", checkInsError);
      }

      const checkInsMap = new Map(
        (checkInsData || []).map((ci) => [ci.assignment_id, ci]),
      );

      // Step 7: Build the final mapped data
      const mapped: AdminWorkerShift[] = [];

      for (const assignment of assignmentsData) {
        const shift = filteredShifts.find((s) => s.id === assignment.shift_id);
        if (!shift) continue;

        const worker = workersMap.get(assignment.user_id);
        if (!worker) continue;

        const job = jobsMap.get(shift.job_id);
        if (!job) continue;

        const location = job.location_id
          ? locationsMap.get(job.location_id)
          : null;

        const checkIn = checkInsMap.get(assignment.id);

        mapped.push({
          assignmentId: assignment.id,
          workerId: worker.id,
          workerName: worker.full_name,
          workerEmail: worker.email,
          shiftId: shift.id,
          shiftDate: shift.shift_date,
          startTime: shift.start_time,
          endTime: shift.end_time,
          jobId: job.id,
          jobTitle: job.title,
          jobPosition: job.position,
          jobSeniority: job.seniority,
          locationName: location?.name || null,
          checkInData: checkIn
            ? {
                id: checkIn.id,
                checkInTime: checkIn.check_in_time
                  ? new Date(checkIn.check_in_time)
                  : null,
                checkOutTime: checkIn.check_out_time
                  ? new Date(checkIn.check_out_time)
                  : null,
                checkedInBy: checkIn.checked_in_by,
                checkInMethod: checkIn.check_in_method,
              }
            : null,
        });
      }

      console.log("[AdminCheckIn] Final mapped shifts:", mapped.length);
      setShifts(mapped);
    } catch (error) {
      console.error("[AdminCheckIn] Error fetching shifts:", error);
      if (error && typeof error === "object") {
        console.error(
          "[AdminCheckIn] Error details:",
          JSON.stringify(error, null, 2),
        );
      }
      setError("Failed to load shifts. Check console for details.");
      toast.error("Failed to load shifts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
    const interval = setInterval(fetchShifts, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // ✅ Manual check-in by admin using server action
  const handleAdminCheckIn = async (assignmentId: number, workerId: number) => {
    setProcessing(assignmentId);
    try {
      const result = await adminCheckIn(assignmentId, workerId);

      if (!result.success) {
        toast.error(result.error || "Failed to check in worker");
        return;
      }

      toast.success("Worker checked in successfully");
      await fetchShifts();
    } catch (error) {
      console.error("[AdminCheckIn] Check-in error:", error);
      toast.error("Failed to check in worker");
    } finally {
      setProcessing(null);
    }
  };

  // ✅ Manual check-out by admin using server action
  const handleAdminCheckOut = async (checkInId: number) => {
    setProcessing(checkInId);
    try {
      const result = await adminCheckOut(checkInId);

      if (!result.success) {
        toast.error(result.error || "Failed to check out worker");
        return;
      }

      toast.success("Worker checked out successfully");
      await fetchShifts();
    } catch (error) {
      console.error("[AdminCheckIn] Check-out error:", error);
      toast.error("Failed to check out worker");
    } finally {
      setProcessing(null);
    }
  };

  const sortedShifts = useMemo(() => {
    return [...shifts].sort((a, b) => {
      const timeA = new Date(`${a.shiftDate}T${a.startTime}`).getTime();
      const timeB = new Date(`${b.shiftDate}T${b.startTime}`).getTime();
      return timeA - timeB;
    });
  }, [shifts]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Admin Check-In Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Admin Check-In Dashboard
          </div>
          <Badge variant="outline">
            {shifts.length} {shifts.length === 1 ? "shift" : "shifts"} in window
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Showing shifts from -6 hours to +2 hours from now
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {shifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Circle className="mb-2 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {error || "No shifts in the current time window"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Make sure you have shifts scheduled for today within 6 hours
              before or 2 hours after the current time
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedShifts.map((shift) => {
                  const isCheckedIn = !!shift.checkInData?.checkInTime;
                  const isCheckedOut = !!shift.checkInData?.checkOutTime;
                  const checkedInByAdmin =
                    shift.checkInData?.checkedInBy &&
                    shift.checkInData.checkedInBy !== shift.workerId;

                  const jobDisplayTitle =
                    shift.jobTitle ||
                    shift.locationName ||
                    t(`jobs:positions.${shift.jobPosition}`);

                  return (
                    <TableRow key={shift.assignmentId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {shift.workerName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {shift.workerEmail}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{jobDisplayTitle}</div>
                            <div className="text-sm text-muted-foreground">
                              {t(`jobs:positions.${shift.jobPosition}`)} ·{" "}
                              {t(`jobs:fields.${shift.jobSeniority}`)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {shift.locationName && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {shift.locationName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {shift.startTime.slice(0, 5)} -{" "}
                          {shift.endTime.slice(0, 5)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isCheckedOut ? (
                            <Badge
                              variant="outline"
                              className="border-green-500 text-green-700"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Completed
                            </Badge>
                          ) : isCheckedIn ? (
                            <>
                              <Badge
                                variant="default"
                                className="bg-blue-500 hover:bg-blue-600"
                              >
                                <Clock className="mr-1 h-3 w-3" />
                                Working
                              </Badge>
                              {checkedInByAdmin && (
                                <Badge variant="secondary" className="text-xs">
                                  <Shield className="mr-1 h-3 w-3" />
                                  By Admin
                                </Badge>
                              )}
                            </>
                          ) : (
                            <Badge variant="outline">
                              <Circle className="mr-1 h-3 w-3" />
                              Not Started
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {!isCheckedOut && (
                          <Button
                            size="sm"
                            variant={isCheckedIn ? "destructive" : "default"}
                            onClick={() =>
                              isCheckedIn
                                ? handleAdminCheckOut(shift.checkInData!.id)
                                : handleAdminCheckIn(
                                    shift.assignmentId,
                                    shift.workerId,
                                  )
                            }
                            disabled={
                              processing ===
                              (isCheckedIn
                                ? shift.checkInData!.id
                                : shift.assignmentId)
                            }
                          >
                            {processing ===
                            (isCheckedIn
                              ? shift.checkInData!.id
                              : shift.assignmentId) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isCheckedIn ? (
                              <>
                                <LogOut className="mr-2 h-4 w-4" />
                                Check Out
                              </>
                            ) : (
                              <>
                                <LogIn className="mr-2 h-4 w-4" />
                                Check In
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
