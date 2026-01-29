"use client";

import { useState, useEffect } from "react";
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
}

export function CheckInCard({ shift, userId }: CheckInCardProps) {
  const { i18n } = useTranslation();
  const [processing, setProcessing] = useState(false);
  const [showEarlyCheckoutDialog, setShowEarlyCheckoutDialog] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Client-side timer with tab visibility optimization
  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());
    const interval = setInterval(updateTime, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateTime(); // Sync immediately when tab becomes visible
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{isCheckedIn ? "Current Shift" : "Check In Now"}</span>
            <span className="text-lg font-normal text-muted-foreground">
              {shift.shift.job.position}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Time & Date */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {currentTime.toLocaleTimeString(i18n.language, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
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

          {/* Circular Timer */}
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative w-64 h-64">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="text-primary transition-all duration-1000"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Timer className="h-8 w-8 text-muted-foreground mb-2" />
                <div className="text-4xl font-bold font-mono">
                  {isCheckedIn ? formatWorkingTime(workingTime) : "00:00:00"}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Working Hours
                </div>
              </div>
            </div>
          </div>

          {/* Clock In/Out Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <LogIn className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-xs text-muted-foreground">Clock In</div>
                <div className="font-semibold">
                  {isCheckedIn && checkInTime
                    ? checkInTime.toLocaleTimeString(i18n.language, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : shift.shift.start_time.slice(0, 5)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <LogOut className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-xs text-muted-foreground">Clock Out</div>
                <div className="font-semibold">
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
          </div>

          {/* Location */}
          {shift.shift.job.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{shift.shift.job.location.name}</span>
            </div>
          )}

          {/* Action Buttons */}
          {!isCheckedOut && (
            <Button
              onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
              disabled={processing || (!isCheckedIn && !shift.canCheckIn)}
              className="w-full"
              size="lg"
              variant={isCheckedIn ? "destructive" : "default"}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isCheckedIn ? "Checking Out..." : "Checking In..."}
                </>
              ) : isCheckedIn ? (
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  Check Out
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Check In
                  {!shift.canCheckIn && ` (Opens in ${minutesUntilStart} min)`}
                </>
              )}
            </Button>
          )}

          {/* Completion Message */}
          {isCheckedOut && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
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

      {/* Early Checkout Dialog */}
      <Dialog
        open={showEarlyCheckoutDialog}
        onOpenChange={setShowEarlyCheckoutDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Check Out Early?
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                You are checking out before your scheduled shift end time. Are you
                sure?
              </p>
              <Alert>
                <AlertDescription>
                  Your shift is only {Math.floor(progressPercentage)}% complete.
                  Standard shift duration is {Math.floor(shiftDuration / 3600000)}{" "}
                  hours and {Math.floor((shiftDuration % 3600000) / 60000)}{" "}
                  minutes.
                </AlertDescription>
              </Alert>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowEarlyCheckoutDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={performCheckOut}
              disabled={processing}
              className="flex-1"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking Out...
                </>
              ) : (
                "Confirm Check Out"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
