// app/[lang]/dashboard/MyShifts.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calendar,
  MapPin,
  Clock,
  Briefcase,
  Loader2,
  XCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface Location {
  name: string;
}

interface Job {
  position: string;
  location: Location | null;
}

interface Shift {
  id: number;
  shift_date: string;
  start_time: string;
  end_time: string;
  job_id: number;
  job: Job;
}

interface ShiftAssignment {
  id: number;
  shift: Shift;
}

// Worker can only use these
type WorkerCancellationReason = "other_job" | "personal" | "sick" | "accident";

type CancellationReason = WorkerCancellationReason;

export function MyShifts({ userId }: { userId: number }) {
  const { t, i18n } = useTranslation("myshifts");
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] =
    useState<ShiftAssignment | null>(null);
  const [cancellationReason, setCancellationReason] =
    useState<CancellationReason>("personal");
  const [cancelAllRemaining, setCancelAllRemaining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchShifts();

    // Real-time subscription
    const channel = supabase
      .channel("my-shifts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shift_assignment",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchShifts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchShifts = async () => {
    setLoading(true);

    try {
      const today = new Date().toISOString().split("T")[0];

      // Get shift assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("shift_assignment")
        .select("id, shift_id")
        .eq("user_id", userId)
        .is("cancelled_at", null)
        .is("deleted_at", null);

      if (assignmentsError) throw assignmentsError;

      if (!assignmentsData || assignmentsData.length === 0) {
        setShifts([]);
        setLoading(false);
        return;
      }

      const shiftIds = assignmentsData.map((a) => a.shift_id);

      // Get shifts
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("shift")
        .select("id, shift_date, start_time, end_time, job_id")
        .in("id", shiftIds)
        .gte("shift_date", today)
        .is("deleted_at", null)
        .order("shift_date", { ascending: true });

      if (shiftsError) throw shiftsError;

      if (!shiftsData || shiftsData.length === 0) {
        setShifts([]);
        setLoading(false);
        return;
      }

      // Get unique job IDs
      const jobIds = [...new Set(shiftsData.map((s) => s.job_id))];

      // Get jobs with locations
      const { data: jobsData, error: jobsError } = await supabase
        .from("job")
        .select(
          `
          id,
          position,
          location_id,
          location:location_id (
            name
          )
        `
        )
        .in("id", jobIds);

      if (jobsError) throw jobsError;

      // Create job lookup map
      const jobsMap = new Map(
        (jobsData || []).map((job) => [
          job.id,
          {
            position: job.position,
            location:
              Array.isArray(job.location) && job.location.length > 0
                ? { name: job.location[0].name }
                : null,
          },
        ])
      );

      // Combine everything
      const shiftsWithDetails: ShiftAssignment[] = assignmentsData
        .map((assignment) => {
          const shiftData = shiftsData.find(
            (s) => s.id === assignment.shift_id
          );
          if (!shiftData) return null;

          const job = jobsMap.get(shiftData.job_id) || {
            position: "Unknown Position",
            location: null,
          };

          return {
            id: assignment.id,
            shift: {
              id: shiftData.id,
              shift_date: shiftData.shift_date,
              start_time: shiftData.start_time,
              end_time: shiftData.end_time,
              job_id: shiftData.job_id,
              job,
            },
          };
        })
        .filter((item): item is ShiftAssignment => item !== null);

      setShifts(shiftsWithDetails);
    } catch (error) {
      console.error("Error fetching shifts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = (assignment: ShiftAssignment) => {
    setSelectedAssignment(assignment);
    setCancellationReason("personal");
    setCancelAllRemaining(false);
    setCancelDialogOpen(true);
  };

const handleCancelShift = async () => {
  if (!selectedAssignment) return;

  setCancelling(true);

  try {
    const now = new Date().toISOString();

    // ✅ Get the user's ID first
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

    const shiftsToCancel: number[] = [];

    if (cancelAllRemaining) {
      // Get all future shifts for this job
      const today = new Date().toISOString().split("T")[0];
      const { data: futureShifts } = await supabase
        .from("shift_assignment")
        .select("id, shift_id, shift:shift_id(shift_date)")
        .eq("user_id", userId)
        .is("cancelled_at", null)
        .is("deleted_at", null);

      if (futureShifts) {
        // Filter to get assignments for shifts >= today for same job
        const relevantAssignments = await Promise.all(
          futureShifts.map(async (assignment) => {
            const { data: shiftData } = await supabase
              .from("shift")
              .select("job_id, shift_date")
              .eq("id", assignment.shift_id)
              .gte("shift_date", today)
              .single();

            if (
              shiftData &&
              shiftData.job_id === selectedAssignment.shift.job_id
            ) {
              return assignment.id;
            }
            return null;
          })
        );

        shiftsToCancel.push(
          ...relevantAssignments.filter((id): id is number => id !== null)
        );
      }
    } else {
      // Just cancel this one
      shiftsToCancel.push(selectedAssignment.id);
    }

    // Update all selected assignments
    const { error } = await supabase
      .from("shift_assignment")
      .update({
        cancelled_at: now,
        cancelled_by: userData.id, // ✅ Add this
        cancellation_reason: cancellationReason,
      })
      .in("id", shiftsToCancel);

    if (error) throw error;

    // Show appropriate message
    if (cancellationReason === "sick" || cancellationReason === "accident") {
      toast.success(
        t("cancel.successWithProof", { count: shiftsToCancel.length }),
        {
          description: t("cancel.proofRequired"),
          duration: 10000,
        }
      );
    } else {
      toast.success(t("cancel.success", { count: shiftsToCancel.length }));
    }

    setCancelDialogOpen(false);
    setSelectedAssignment(null);
    await fetchShifts();
  } catch (error) {
    console.error("Error cancelling shift:", error);
    toast.error(t("cancel.error"));
  } finally {
    setCancelling(false);
  }
};


  // Check if there are remaining shifts for the same job
  const hasRemainingShifts = (assignment: ShiftAssignment): boolean => {
    return shifts.some(
      (s) =>
        s.shift.job_id === assignment.shift.job_id &&
        s.shift.shift_date > assignment.shift.shift_date
    );
  };

  const getRemainingShiftsCount = (assignment: ShiftAssignment): number => {
    return shifts.filter(
      (s) =>
        s.shift.job_id === assignment.shift.job_id &&
        s.shift.shift_date >= assignment.shift.shift_date
    ).length;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (shifts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("noShifts")}</p>
        </CardContent>
      </Card>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("title")}
            <Badge variant="secondary">{shifts.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {shifts.map((assignment) => {
              const shift = assignment.shift;
              const isToday = shift.shift_date === today;

              return (
                <Card
                  key={assignment.id}
                  className={`${
                    isToday
                      ? "border-2 border-primary dark:border-primary"
                      : "dark:bg-card"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {/* Position */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Briefcase className="w-4 h-4 text-primary flex-shrink-0" />
                          <h4 className="font-semibold truncate">
                            {shift.job.position}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isToday && (
                            <Badge variant="default" className="bg-primary">
                              {t("today")}
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelClick(assignment)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            {t("cancel.button")}
                          </Button>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {new Date(shift.shift_date).toLocaleDateString(
                            i18n.language,
                            {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {shift.start_time.slice(0, 5)} -{" "}
                          {shift.end_time.slice(0, 5)}
                        </span>
                      </div>

                      {/* Location */}
                      {shift.job.location && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          <span>{shift.job.location.name}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cancellation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("cancel.title")}</DialogTitle>
            <DialogDescription>
              {selectedAssignment &&
                `${selectedAssignment.shift.job.position} - ${new Date(
                  selectedAssignment.shift.shift_date
                ).toLocaleDateString(i18n.language)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Cancellation Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                {t("cancel.reasonLabel")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={cancellationReason}
                onValueChange={(value) =>
                  setCancellationReason(value as CancellationReason)
                }
              >
                <SelectTrigger id="reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="other_job">
                    {t("cancel.reasons.otherJob")}
                  </SelectItem>
                  <SelectItem value="personal">
                    {t("cancel.reasons.personal")}
                  </SelectItem>
                  <SelectItem value="sick">
                    {t("cancel.reasons.sick")}
                  </SelectItem>
                  <SelectItem value="accident">
                    {t("cancel.reasons.accident")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sick/Accident Warning */}
            {(cancellationReason === "sick" ||
              cancellationReason === "accident") && (
              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                  {t("cancel.proofWarning")}
                </AlertDescription>
              </Alert>
            )}

            {/* Cancel All Remaining Checkbox */}
            {selectedAssignment && hasRemainingShifts(selectedAssignment) && (
              <div className="flex items-start space-x-2 p-3 bg-muted rounded-lg">
                <Checkbox
                  id="cancelAll"
                  checked={cancelAllRemaining}
                  onCheckedChange={(checked) =>
                    setCancelAllRemaining(checked === true)
                  }
                />
                <div className="flex-1">
                  <Label
                    htmlFor="cancelAll"
                    className="cursor-pointer text-sm font-medium"
                  >
                    {t("cancel.cancelAllLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("cancel.cancelAllDescription", {
                      count: getRemainingShiftsCount(selectedAssignment),
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* Info Message */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {cancelAllRemaining
                  ? t("cancel.confirmMultiple", {
                      count: selectedAssignment
                        ? getRemainingShiftsCount(selectedAssignment)
                        : 0,
                    })
                  : t("cancel.confirmSingle")}
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
              {t("cancel.back")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelShift}
              disabled={cancelling}
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("cancel.cancelling")}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  {t("cancel.confirm")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
