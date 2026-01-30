// app/[lang]/dashboard/dashboard-client.tsx

"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  CheckCircle,
  AlertTriangle,
  Info,
  LogIn,
  LogOut,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import {
  cancelShift,
  acceptInvitation,
  declineInvitation,
  checkIn,
  checkOut,
} from "./actions";
import type { ShiftWithCheckIn, JobInvitation } from "./page";

// ============================================================================
// TYPES
// ============================================================================

type CancellationReason = "other_job" | "personal" | "sick" | "accident";

interface DashboardClientProps {
  userId: number;
  myShifts: ShiftWithCheckIn[];
  pendingInvitations: JobInvitation[];
}

// ============================================================================
// MAIN CLIENT COMPONENT
// ============================================================================

export function DashboardClient({
  userId,
  myShifts,
  pendingInvitations,
}: DashboardClientProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Find shift that can check in (already checked in OR can check in now)
  const activeShift = myShifts.find(
    (s) =>
      (s.canCheckIn && !s.checkInData?.checkOutTime) ||
      (s.checkInData?.checkInTime && !s.checkInData?.checkOutTime),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-20">
      {activeShift ? (
        <>
          <CheckInSection
            shift={activeShift}
            userId={userId}
            currentTime={currentTime}
          />
          <MyShiftsSection
            shifts={myShifts}
            userId={userId}
            currentTime={currentTime}
          />
          <PendingInvitationsSection
            invitations={pendingInvitations}
            userId={userId}
          />
        </>
      ) : (
        <>
          <PendingInvitationsSection
            invitations={pendingInvitations}
            userId={userId}
          />
          <MyShiftsSection
            shifts={myShifts}
            userId={userId}
            currentTime={currentTime}
          />
        </>
      )}
    </div>
  );
}

// ============================================================================
// CHECK-IN/OUT SECTION
// ============================================================================

function CheckInSection({
  shift,
  userId,
  currentTime,
}: {
  shift: ShiftWithCheckIn;
  userId: number;
  currentTime: Date;
}) {
  const { t, i18n } = useTranslation("checkin");
  const [processing, setProcessing] = useState(false);
  const [showEarlyCheckoutDialog, setShowEarlyCheckoutDialog] = useState(false);

  const isCheckedIn = !!shift.checkInData?.checkInTime;
  const isCheckedOut = !!shift.checkInData?.checkOutTime;

  // Calculate working time
  const checkInTime = shift.checkInData?.checkInTime;
  const workingTime = checkInTime
    ? currentTime.getTime() - checkInTime.getTime()
    : 0;

  // Calculate shift duration
  const shiftDuration =
    shift.shiftEndDateTime.getTime() - shift.shiftStartDateTime.getTime();

  // Calculate progress percentage
  const progressPercentage = isCheckedIn
    ? Math.min((workingTime / shiftDuration) * 100, 100)
    : 0;

  // Format working time as HH:MM:SS
  const formatWorkingTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const handleCheckIn = async () => {
    setProcessing(true);
    try {
      const result = await checkIn(shift.id, userId);
      if (!result.success) {
        toast.error(result.error || "Check-in failed");
        return;
      }
      toast.success("Checked in successfully!");
    } catch (error) {
      console.error("Check-in error:", error);
      toast.error("Check-in failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    // Check if shift is at least 90% complete
    const ninetyPercentTime = shiftDuration * 0.9;

    if (workingTime < ninetyPercentTime) {
      setShowEarlyCheckoutDialog(true);
      return;
    }

    await performCheckOut();
  };

  const performCheckOut = async () => {
    setProcessing(true);
    try {
      const result = await checkOut(shift.id, userId);
      if (!result.success) {
        toast.error(result.error || "Check-out failed");
        return;
      }
      toast.success("Checked out successfully!");
      setShowEarlyCheckoutDialog(false);
    } catch (error) {
      console.error("Check-out error:", error);
      toast.error("Check-out failed");
    } finally {
      setProcessing(false);
    }
  };

  const timeUntilStart =
    shift.shiftStartDateTime.getTime() - currentTime.getTime();
  const minutesUntilStart = Math.floor(timeUntilStart / 60000);

  // Calculate circle stroke
  const circumference = 2 * Math.PI * 120; // radius = 120
  const strokeDashoffset =
    circumference - (progressPercentage / 100) * circumference;

  return (
    <>
      <Card className="h-fit border-2 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            {isCheckedIn ? "Current Shift" : "Check In Now"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Shift Info */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg text-center">
              {shift.shift.job.position}
            </h3>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>
                  {currentTime.toLocaleTimeString(i18n.language, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(shift.shift.shift_date).toLocaleDateString(
                    i18n.language,
                    { day: "numeric", month: "short", year: "numeric" },
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Circular Progress */}
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative w-64 h-64">
              {/* Background circle */}
              <svg className="transform -rotate-90 w-64 h-64">
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="16"
                  fill="transparent"
                  className="text-muted"
                />
                {/* Progress circle */}
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="16"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="text-primary transition-all duration-1000"
                  strokeLinecap="round"
                />
              </svg>

              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-bold">
                  {isCheckedIn ? formatWorkingTime(workingTime) : "00:00:00"}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Working Hours
                </div>
              </div>
            </div>
          </div>

          {/* Clock In/Out Times */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Clock In</div>
              <div className="text-xl font-semibold">
                {isCheckedIn && checkInTime
                  ? checkInTime.toLocaleTimeString(i18n.language, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : shift.shift.start_time.slice(0, 5)}
              </div>
            </div>
            <div className="text-center border-l">
              <div className="text-xs text-muted-foreground mb-1">
                Clock Out
              </div>
              <div className="text-xl font-semibold">
                {isCheckedOut && shift.checkInData?.checkOutTime
                  ? shift.checkInData.checkOutTime.toLocaleTimeString(
                      i18n.language,
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )
                  : shift.shift.end_time.slice(0, 5)}
              </div>
            </div>
          </div>

          {/* Location */}
          {shift.shift.job.location && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {shift.shift.job.location.name}
            </div>
          )}

          {/* Action Button */}
          {!isCheckedOut && (
            <Button
              onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
              disabled={processing || (!isCheckedIn && !shift.canCheckIn)}
              className="w-full h-14 text-lg"
              size="lg"
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {isCheckedIn ? "Checking Out..." : "Checking In..."}
                </>
              ) : isCheckedIn ? (
                <>
                  <LogOut className="h-5 w-5 mr-2" />
                  Check Out
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  Check In
                  {!shift.canCheckIn && ` (Opens in ${minutesUntilStart} min)`}
                </>
              )}
            </Button>
          )}

          {isCheckedOut && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Shift completed! Total time:{" "}
                {formatWorkingTime(
                  shift.checkInData!.checkOutTime!.getTime() -
                    shift.checkInData!.checkInTime!.getTime(),
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Early Checkout Confirmation Dialog */}
      <Dialog
        open={showEarlyCheckoutDialog}
        onOpenChange={setShowEarlyCheckoutDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out Early?</DialogTitle>
            <DialogDescription>
              You are checking out before your scheduled shift end time. Are you
              sure you want to continue?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your shift is only {Math.floor(progressPercentage)}% complete.
                Standard shift duration is {Math.floor(shiftDuration / 3600000)}{" "}
                hours and {Math.floor((shiftDuration % 3600000) / 60000)}{" "}
                minutes.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEarlyCheckoutDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={performCheckOut}
                disabled={processing}
                className="flex-1"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking Out...
                  </>
                ) : (
                  "Confirm Check Out"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// PENDING INVITATIONS SECTION
// ============================================================================

function PendingInvitationsSection({
  invitations,
  userId,
}: {
  invitations: JobInvitation[];
  userId: number;
}) {
  const { t, i18n } = useTranslation("job-invitation");
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleAccept = async (invitation: JobInvitation) => {
    setProcessingId(invitation.id);
    try {
      const result = await acceptInvitation({
        invitationId: invitation.id,
        userId,
        shiftIds: invitation.shift_ids,
        invitedBy: invitation.invited_by,
      });

      if (!result.success) {
        if (result.error === "spots_filled") {
          toast.error(t("toast.spotsFilled"));
        } else {
          toast.error(result.error || t("toast.acceptFailed"));
        }
        return;
      }

      toast.success(
        t("toast.acceptSuccess", { count: result.assignedCount || 0 }),
      );
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast.error(t("toast.acceptFailed"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: number) => {
    if (!confirm(t("confirmDecline"))) return;

    setProcessingId(invitationId);
    try {
      const result = await declineInvitation(invitationId, userId);
      if (!result.success) {
        toast.error(result.error || t("toast.declineFailed"));
        return;
      }
      toast.success(t("toast.declined"));
    } catch (error) {
      console.error("Error declining invitation:", error);
      toast.error(t("toast.declineFailed"));
    } finally {
      setProcessingId(null);
    }
  };

  if (invitations.length === 0) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("noPending")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("title")}</CardTitle>
        <Badge variant="secondary">{invitations.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto">
        {invitations.map((invitation) => (
          <div key={invitation.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  {invitation.job.position}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("shiftsCount", { count: invitation.shifts.length })}
                </p>
              </div>
            </div>

            {invitation.job.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {invitation.job.location.name}
              </div>
            )}

            {invitation.job.start_date && invitation.job.end_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {new Date(invitation.job.start_date).toLocaleDateString(
                  i18n.language,
                )}{" "}
                -{" "}
                {new Date(invitation.job.end_date).toLocaleDateString(
                  i18n.language,
                )}
              </div>
            )}

            {invitation.shifts.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("shiftSchedule")}</p>
                <div className="space-y-1">
                  {invitation.shifts.slice(0, 3).map((shift) => (
                    <div
                      key={shift.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Clock className="h-3 w-3" />
                      {new Date(shift.shift_date).toLocaleDateString(
                        i18n.language,
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                      : {shift.start_time.slice(0, 5)} -{" "}
                      {shift.end_time.slice(0, 5)}
                    </div>
                  ))}
                  {invitation.shifts.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-5">
                      {t("moreShifts", {
                        count: invitation.shifts.length - 3,
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleDecline(invitation.id)}
                variant="outline"
                size="sm"
                disabled={processingId === invitation.id}
                className="flex-1"
              >
                {processingId === invitation.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                {t("decline")}
              </Button>
              <Button
                onClick={() => handleAccept(invitation)}
                size="sm"
                disabled={processingId === invitation.id}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {processingId === invitation.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {t("accept")}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MY SHIFTS SECTION
// ============================================================================

function MyShiftsSection({
  shifts,
  userId,
  currentTime,
}: {
  shifts: ShiftWithCheckIn[];
  userId: number;
  currentTime: Date;
}) {
  const { t, i18n } = useTranslation("myshifts");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] =
    useState<ShiftWithCheckIn | null>(null);
  const [cancellationReason, setCancellationReason] =
    useState<CancellationReason>("personal");
  const [cancelAllRemaining, setCancelAllRemaining] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancelClick = (assignment: ShiftWithCheckIn) => {
    setSelectedAssignment(assignment);
    setCancellationReason("personal");
    setCancelAllRemaining(false);
    setCancelDialogOpen(true);
  };

  const handleCancelShift = async () => {
    if (!selectedAssignment) return;

    setCancelling(true);
    try {
      const result = await cancelShift({
        assignmentId: selectedAssignment.id,
        userId,
        jobId: selectedAssignment.shift.job_id,
        cancellationReason,
        cancelAllRemaining,
      });

      if (!result.success) {
        toast.error(result.error || t("cancel.error"));
        return;
      }

      if (cancellationReason === "sick" || cancellationReason === "accident") {
        toast.success(
          t("cancel.successWithProof", { count: result.cancelledCount || 1 }),
          {
            description: t("cancel.proofRequired"),
            duration: 10000,
          },
        );
      } else {
        toast.success(
          t("cancel.success", { count: result.cancelledCount || 1 }),
        );
      }

      setCancelDialogOpen(false);
      setSelectedAssignment(null);
    } catch (error) {
      console.error("Error cancelling shift:", error);
      toast.error(t("cancel.error"));
    } finally {
      setCancelling(false);
    }
  };

  const hasRemainingShifts = (assignment: ShiftWithCheckIn): boolean => {
    return shifts.some(
      (s) =>
        s.shift.job_id === assignment.shift.job_id &&
        s.shift.shift_date > assignment.shift.shift_date,
    );
  };

  const getRemainingShiftsCount = (assignment: ShiftWithCheckIn): number => {
    return shifts.filter(
      (s) =>
        s.shift.job_id === assignment.shift.job_id &&
        s.shift.shift_date >= assignment.shift.shift_date,
    ).length;
  };

  // Calculate next shift and time remaining
  const nextShift = shifts.length > 0 ? shifts[0] : null;
  const timeUntilNext = nextShift
    ? nextShift.shiftStartDateTime.getTime() - currentTime.getTime()
    : null;

  const getTimeMessage = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);

    if (hours >= 6) return null; // Don't show if more than 6 hours
    if (hours > 0)
      return `Your next shift starts in ${hours} hour${hours > 1 ? "s" : ""}`;
    if (minutes >= 30) return `Your next shift starts in ${minutes} minutes`;
    if (minutes >= 10) return `Your next shift starts in ${minutes} minutes`;
    return `Your next shift starts in ${minutes} minute${minutes > 1 ? "s" : ""}!`;
  };

  const timeMessage =
    timeUntilNext && timeUntilNext > 0 ? getTimeMessage(timeUntilNext) : null;

  if (shifts.length === 0) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("noShifts")}</p>
        </CardContent>
      </Card>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <>
      <Card className="h-fit">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>{t("title")}</CardTitle>
            {timeMessage && (
              <p className="text-sm font-semibold text-primary flex items-center gap-2">
                <Timer className="h-4 w-4" />
                {timeMessage}
              </p>
            )}
          </div>
          <Badge variant="secondary">{shifts.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto">
          {shifts.map((assignment) => {
            const shift = assignment.shift;
            const isToday = shift.shift_date === today;
            const isNext = nextShift?.id === assignment.id;
            const timeUntil =
              assignment.shiftStartDateTime.getTime() - currentTime.getTime();
            const hoursUntil = Math.floor(timeUntil / 3600000);
            const isHighlighted = hoursUntil >= 0 && hoursUntil < 6;

            return (
              <div
                key={assignment.id}
                className={`border rounded-lg p-4 space-y-3 ${
                  isHighlighted ? "border-primary bg-primary/5 border-2" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{shift.job.position}</h3>
                    <div className="flex gap-2">
                      {isToday && <Badge variant="default">{t("today")}</Badge>}
                      {isNext && isHighlighted && (
                        <Badge variant="default" className="bg-primary">
                          <Timer className="h-3 w-3 mr-1" />
                          Starting Soon
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelClick(assignment)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {t("cancel.button")}
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {new Date(shift.shift_date).toLocaleDateString(
                    i18n.language,
                    {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    },
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                </div>

                {shift.job.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {shift.job.location.name}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancel.title")}</DialogTitle>
            <DialogDescription>
              {selectedAssignment &&
                `${selectedAssignment.shift.job.position} - ${new Date(
                  selectedAssignment.shift.shift_date,
                ).toLocaleDateString(i18n.language)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
                <SelectTrigger>
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

            {(cancellationReason === "sick" ||
              cancellationReason === "accident") && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{t("cancel.proofWarning")}</AlertDescription>
              </Alert>
            )}

            {selectedAssignment && hasRemainingShifts(selectedAssignment) && (
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="cancel-all"
                  checked={cancelAllRemaining}
                  onCheckedChange={(checked) =>
                    setCancelAllRemaining(checked === true)
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="cancel-all"
                    className="text-sm font-medium leading-none"
                  >
                    {t("cancel.cancelAllLabel")}
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {t("cancel.cancelAllDescription", {
                      count: getRemainingShiftsCount(selectedAssignment),
                    })}
                  </p>
                </div>
              </div>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {cancelAllRemaining
                  ? t("cancel.confirmMultiple", {
                      count: selectedAssignment
                        ? getRemainingShiftsCount(selectedAssignment)
                        : 0,
                    })
                  : t("cancel.confirmSingle")}
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
                disabled={cancelling}
                className="flex-1"
              >
                {t("cancel.back")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelShift}
                disabled={cancelling}
                className="flex-1"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("cancel.cancelling")}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    {t("cancel.confirm")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
