"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calendar,
  MapPin,
  Clock,
  Loader2,
  CheckCircle,
  AlertTriangle,
  LogIn,
  LogOut,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { checkIn, checkOut } from "../actions";
import type { ShiftWithCheckIn } from "../page";

interface CheckInCardProps {
  shift: ShiftWithCheckIn;
  userId: number;
  currentTime: Date;
}

export function CheckInCard({ shift, userId, currentTime }: CheckInCardProps) {
  const { i18n } = useTranslation();
  const [processing, setProcessing] = useState(false);
  const [showEarlyCheckoutDialog, setShowEarlyCheckoutDialog] = useState(false);

  const isCheckedIn = !!shift.checkInData?.checkInTime;
  const isCheckedOut = !!shift.checkInData?.checkOutTime;

  const checkInTime = shift.checkInData?.checkInTime;
  const workingTime = checkInTime
    ? currentTime.getTime() - checkInTime.getTime()
    : 0;

  const shiftDuration =
    shift.shiftEndDateTime.getTime() - shift.shiftStartDateTime.getTime();
  const progressPercentage = isCheckedIn
    ? Math.min((workingTime / shiftDuration) * 100, 100)
    : 0;

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

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset =
    circumference - (progressPercentage / 100) * circumference;

  return (
    <>
      <Card className="h-fit border-2 border-primary shadow-lg hover:shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            {isCheckedIn ? "Current Shift" : "Check In Now"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    },
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative w-64 h-64">
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

          {shift.shift.job.location && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {shift.shift.job.location.name}
            </div>
          )}

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

      <Dialog
        open={showEarlyCheckoutDialog}
        onOpenChange={setShowEarlyCheckoutDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out Early?</DialogTitle>
            <DialogDescription>
              You are checking out before your scheduled shift end time. Are you
              sure?
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
