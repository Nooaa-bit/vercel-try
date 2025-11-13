//hype-hire/vercel/app/[lang]/dashboard/calendar/DayView.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import JobDialog from "./JobDialog";
import { ShiftEditDialog } from "./ShiftEditDialog";

interface Shift {
  id: number;
  job_id: number;
  position: string;
  start_date: string;
  end_date: string;
  workers_needed: number;
  location: string;
  status: "draft" | "active" | "completed";
  startTime: string;
  endTime: string;
  assignmentCount?: number;
}

interface Location {
  id: number;
  name: string;
}

interface DayViewProps {
  date: Date;
  shifts: Shift[];
  locations: Location[];
  onClose: () => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onSave: () => void;
  activeRole: {
    role: string;
  };
  targetCompanyId: number;
}

interface ShiftFromDB {
  id: number;
  job_id: number;
  shift_date: string;
  start_time: string;
  end_time: string;
  workers_needed: number;
}

const SWIMLANE_WIDTH_PX = 140;
const SWIMLANE_GAP_PX = 8;

export function DayView({
  date,
  shifts,
  locations,
  onClose,
  onPreviousDay,
  onNextDay,
  onSave,
  activeRole,
  targetCompanyId,
}: DayViewProps) {
  const { t } = useTranslation("jobs");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shiftEditDialogOpen, setShiftEditDialogOpen] = useState(false);
  const [editingShiftData, setEditingShiftData] = useState<ShiftFromDB | null>(
    null
  );
  const [shiftAssignmentCount, setShiftAssignmentCount] = useState(0);
  const [shiftPosition, setShiftPosition] = useState("");
  const shiftsScrollRef = useRef<HTMLDivElement>(null);
  const hoursScrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // ✅ Check if user can edit (only company_admin and superadmin)
  const canEdit =
    activeRole.role === "company_admin" || activeRole.role === "superadmin";

  useEffect(() => {
    const shiftsDiv = shiftsScrollRef.current;
    if (!shiftsDiv) return;

    const handleScroll = () => {
      if (hoursScrollRef.current) {
        hoursScrollRef.current.scrollTop = shiftsDiv.scrollTop;
      }
    };

    shiftsDiv.addEventListener("scroll", handleScroll);
    return () => shiftsDiv.removeEventListener("scroll", handleScroll);
  }, []);

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;

  const dayShifts = shifts.filter((shift) => shift.start_date === dateStr);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getShiftPosition = (startTime: string) => {
    const [hours, minutes] = startTime.split(":").map(Number);
    return hours + minutes / 60;
  };

  const getShiftHeight = (startTime: string, endTime: string) => {
    const start = getShiftPosition(startTime);
    const end = getShiftPosition(endTime);
    const duration = end - start;
    return Math.max(duration, 0.5);
  };

  const getSwimlanesLayout = () => {
    const swimlanes: Array<{
      id: number;
      shifts: Shift[];
      swimlaneIndex: number;
    }> = [];

    const sortedShifts = [...dayShifts].sort(
      (a, b) => getShiftPosition(a.startTime) - getShiftPosition(b.startTime)
    );

    const gapInHours = SWIMLANE_GAP_PX / 64;

    sortedShifts.forEach((shift) => {
      const shiftStart = getShiftPosition(shift.startTime);
      const shiftHeight = getShiftHeight(shift.startTime, shift.endTime);
      const shiftEnd = shiftStart + shiftHeight;

      let swimlaneIndex = 0;
      let placed = false;

      for (let i = 0; i < swimlanes.length; i++) {
        let canPlace = true;

        for (const existingShift of swimlanes[i].shifts) {
          const existingStart = getShiftPosition(existingShift.startTime);
          const existingHeight = getShiftHeight(
            existingShift.startTime,
            existingShift.endTime
          );
          const existingEnd = existingStart + existingHeight + gapInHours;

          if (shiftStart < existingEnd && shiftEnd > existingStart) {
            canPlace = false;
            break;
          }
        }

        if (canPlace) {
          swimlanes[i].shifts.push(shift);
          swimlaneIndex = i;
          placed = true;
          break;
        }
      }

      if (!placed) {
        swimlanes.push({
          id: swimlanes.length,
          shifts: [shift],
          swimlaneIndex: swimlanes.length,
        });
      }
    });

    return swimlanes;
  };

  const swimlanes = getSwimlanesLayout();

  const dayName = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
  };

  // ✅ Handle shift click - only allow editing for admins
  const handleShiftClick = async (shift: Shift) => {
    // ✅ Prevent editing for talent and supervisor
    if (!canEdit) {
      return;
    }

    try {
      const { data: shiftData, error: shiftError } = await supabase
        .from("shift")
        .select("id, job_id, shift_date, start_time, end_time, workers_needed")
        .eq("id", shift.id)
        .single();

      if (shiftError) throw shiftError;

      const { count, error: countError } = await supabase
        .from("shift_assignment")
        .select("*", { count: "exact", head: true })
        .eq("shift_id", shift.id)
        .is("cancelled_at", null)
        .is("marked_no_show_at", null)
        .is("deleted_at", null);

      if (countError) throw countError;

      setEditingShiftData(shiftData);
      setShiftAssignmentCount(count || 0);
      setShiftPosition(shift.position);
      setShiftEditDialogOpen(true);
    } catch (error) {
      console.error("Error fetching shift data:", error);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={onPreviousDay}
                className="h-8 w-8"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="text-xl min-w-fit">{dayName}</CardTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={onNextDay}
                className="h-8 w-8"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              {/* ✅ Only show "Add Job" button for admins */}
              {canEdit && (
                <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary hover:bg-primary/90">
                      <Plus className="w-4 h-4 mr-2" />
                      {t("card.addButton")}
                    </Button>
                  </DialogTrigger>
                  {dialogOpen && (
                    <JobDialog
                      editingJob={null}
                      locations={locations}
                      defaultStartDate={dateStr}
                      onSave={async () => {
                        setDialogOpen(false);
                        onSave();
                      }}
                      onCancel={() => {
                        setDialogOpen(false);
                      }}
                      companyId={targetCompanyId}
                    />
                  )}
                </Dialog>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0 flex">
          <div
            ref={hoursScrollRef}
            className="w-20 border-r bg-muted/30 flex flex-col overflow-y-scroll scrollbar-hide"
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-16 border-b px-2 py-1 text-xs font-medium text-muted-foreground flex items-start justify-center flex-shrink-0"
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          <div
            ref={shiftsScrollRef}
            className="flex-1 overflow-y-scroll overflow-x-auto relative"
          >
            {hours.map((hour) => (
              <div
                key={`divider-${hour}`}
                className="h-16 border-b border-muted/50 relative flex-shrink-0"
              >
                <div className="absolute top-1/2 w-full border-t border-muted/30" />
              </div>
            ))}

            {dayShifts.length > 0 ? (
              <div className="absolute inset-0 flex">
                {swimlanes.map((swimlane) => (
                  <div
                    key={`swimlane-${swimlane.id}`}
                    className="relative flex-shrink-0 border-r border-muted/30"
                    style={{
                      width: `${SWIMLANE_WIDTH_PX}px`,
                      marginRight: `${SWIMLANE_GAP_PX}px`,
                    }}
                  >
                    {swimlane.shifts.map((shift) => {
                      const startPosition = getShiftPosition(shift.startTime);
                      const height = getShiftHeight(
                        shift.startTime,
                        shift.endTime
                      );

                      const assignmentCount = shift.assignmentCount ?? 0;
                      const workersNeeded = shift.workers_needed;
                      const isFullyStaffed = assignmentCount === workersNeeded;
                      const isOverstaffed = assignmentCount > workersNeeded;

                      return (
                        <div
                          key={shift.id}
                          className={`absolute bg-primary text-primary-foreground rounded-lg p-2 border border-primary/20 transition-shadow overflow-hidden left-1 right-1 ${
                            canEdit
                              ? "hover:shadow-lg cursor-pointer"
                              : "cursor-default"
                          }`}
                          style={{
                            top: `${startPosition * 64}px`,
                            height: `${height * 64}px`,
                          }}
                          title={
                            canEdit
                              ? `${shift.position} - ${shift.location} (Click to edit)`
                              : `${shift.position} - ${shift.location}`
                          }
                          onClick={() => handleShiftClick(shift)}
                        >
                          <div className="text-xs font-semibold truncate">
                            {shift.position}
                          </div>
                          <div className="text-xs text-primary-foreground/80">
                            {shift.startTime.slice(0, 5)} -{" "}
                            {shift.endTime.slice(0, 5)}
                          </div>
                          <div className="text-xs text-primary-foreground/70 mt-1 truncate">
                            {shift.location}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <div
                              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                isFullyStaffed
                                  ? "bg-green-500 text-white"
                                  : isOverstaffed
                                  ? "bg-red-500 text-white"
                                  : "bg-orange-500 text-white"
                              }`}
                            >
                              {assignmentCount}/{workersNeeded}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <p>No shifts scheduled for this day</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ✅ Only render edit dialog for admins */}
      {canEdit && shiftEditDialogOpen && editingShiftData && (
        <Dialog
          open={shiftEditDialogOpen}
          onOpenChange={setShiftEditDialogOpen}
        >
          <ShiftEditDialog
            shift={{
              ...editingShiftData,
              position: shiftPosition,
            }}
            assignmentCount={shiftAssignmentCount}
            onSave={() => {
              setShiftEditDialogOpen(false);
              setEditingShiftData(null);
              onSave();
            }}
            onCancel={() => {
              setShiftEditDialogOpen(false);
              setEditingShiftData(null);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}
