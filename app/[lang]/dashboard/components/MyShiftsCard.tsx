"use client";

import { useState } from "react";
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
  Loader2,
  XCircle,
  AlertTriangle,
  Info,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { cancelShift } from "../actions";
import type { ShiftWithCheckIn } from "../page";

type CancellationReason = "other_job" | "personal" | "sick" | "accident";

interface MyShiftsCardProps {
  shifts: ShiftWithCheckIn[];
  userId: number;
  currentTime: Date;
}

export function MyShiftsCard({
  shifts,
  userId,
  currentTime,
}: MyShiftsCardProps) {
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

  const nextShift = shifts.length > 0 ? shifts[0] : null;
  const timeUntilNext = nextShift
    ? nextShift.shiftStartDateTime.getTime() - currentTime.getTime()
    : null;

  const getTimeMessage = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);

    if (hours >= 6) return null;
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
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancelClick(assignment)}
                    className="text-white border-destructive/30 bg-red-400/90 hover:bg-destructive/20 hover:border-destructive/50 hover:text-destructive font-medium"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
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
