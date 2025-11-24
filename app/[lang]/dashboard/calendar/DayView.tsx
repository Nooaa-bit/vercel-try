// app/[lang]/dashboard/calendar/DayView.tsx
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import JobDialog from "./JobDialog";
import { ShiftEditDialog } from "./ShiftEditDialog";
import { ProfileAvatar } from "./ProfileAvatar";
import { type Employee } from "./staffing-utils";

interface Shift {
  id: number;
  job_id: number;
  position: string;
  start_date: string;
  end_date: string;
  workers_needed: number;
  location: string;
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

function getShiftPosition(startTime: string): number {
  const [hours, minutes] = startTime.split(":").map(Number);
  return hours + minutes / 60;
}

function getShiftHeight(startTime: string, endTime: string): number {
  const start = getShiftPosition(startTime);
  const end = getShiftPosition(endTime);
  const duration = end - start;
  return Math.max(duration, 0.5);
}

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
  const { t, i18n } = useTranslation("jobs");
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

  const [assignedStaffMap, setAssignedStaffMap] = useState<
    Map<number, Employee[]>
  >(new Map());
  const fetchedDateRef = useRef("");

  const canEdit =
    activeRole.role === "company_admin" || activeRole.role === "superadmin";

  const dateStr = useMemo(() => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
  }, [date]);

  const dayShifts = useMemo(() => {
    return shifts.filter((shift) => shift.start_date === dateStr);
  }, [shifts, dateStr]);

  const dayName = useMemo(
    () =>
      date.toLocaleDateString(i18n.language, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [date, i18n.language]
  );

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const swimlanes = useMemo(() => {
    const lanes: Array<{
      id: number;
      shifts: Shift[];
      swimlaneIndex: number;
    }> = [];

    if (dayShifts.length === 0) return lanes;

    const sortedShifts = [...dayShifts].sort(
      (a, b) => getShiftPosition(a.startTime) - getShiftPosition(b.startTime)
    );

    const gapInHours = SWIMLANE_GAP_PX / 64;

    sortedShifts.forEach((shift) => {
      const shiftStart = getShiftPosition(shift.startTime);
      const shiftHeight = getShiftHeight(shift.startTime, shift.endTime);
      const shiftEnd = shiftStart + shiftHeight;

      let placed = false;

      for (let i = 0; i < lanes.length; i++) {
        let canPlace = true;

        for (const existingShift of lanes[i].shifts) {
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
          lanes[i].shifts.push(shift);
          placed = true;
          break;
        }
      }

      if (!placed) {
        lanes.push({
          id: lanes.length,
          shifts: [shift],
          swimlaneIndex: lanes.length,
        });
      }
    });

    return lanes;
  }, [dayShifts]);

  // ✅ Pre-calculate all shift styles
  const shiftStyles = useMemo(() => {
    const styles = new Map<
      number,
      {
        top: number;
        height: number;
        isFullyStaffed: boolean;
        isOverstaffed: boolean;
      }
    >();

    swimlanes.forEach((swimlane) => {
      swimlane.shifts.forEach((shift) => {
        const startPosition = getShiftPosition(shift.startTime);
        const height = getShiftHeight(shift.startTime, shift.endTime);
        const assignmentCount = shift.assignmentCount ?? 0;
        const workersNeeded = shift.workers_needed;

        styles.set(shift.id, {
          top: startPosition * 64,
          height: height * 64,
          isFullyStaffed: assignmentCount === workersNeeded,
          isOverstaffed: assignmentCount > workersNeeded,
        });
      });
    });

    return styles;
  }, [swimlanes]);

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

  // ✅ Fetch staff data
  useEffect(() => {
    if (fetchedDateRef.current !== dateStr) {
      setAssignedStaffMap(new Map());
      fetchedDateRef.current = "";
    }

    if (
      !canEdit ||
      dayShifts.length === 0 ||
      fetchedDateRef.current === dateStr
    ) {
      return;
    }

    fetchedDateRef.current = dateStr;
    let isCancelled = false;

    const loadStaff = async () => {
      try {
        const staffMap = new Map<number, Employee[]>();

        await Promise.all(
          dayShifts.map(async (shift) => {
            const { data, error } = await supabase
              .from("shift_assignment")
              .select(
                `
                user_id,
                user:user_id (
                  id,
                  email,
                  first_name,
                  last_name,
                  profile_picture
                )
              `
              )
              .eq("shift_id", shift.id)
              .is("cancelled_at", null)
              .is("deleted_at", null);

            if (!error && data && !isCancelled) {
              const employees: Employee[] = data.map((item) => {
                const user = item.user as unknown as {
                  id: number;
                  email: string;
                  first_name: string | null;
                  last_name: string | null;
                  profile_picture: string | null;
                };

                return {
                  userId: user.id,
                  email: user.email,
                  firstName: user.first_name,
                  lastName: user.last_name,
                  profilePicture: user.profile_picture,
                  role: "talent",
                };
              });

              staffMap.set(shift.id, employees);
            }
          })
        );

        if (!isCancelled) {
          setAssignedStaffMap(staffMap);
        }
      } catch (error) {
        console.error("Error loading staff:", error);
      }
    };

    loadStaff();

    return () => {
      isCancelled = true;
    };
  }, [dateStr, canEdit, dayShifts, supabase]);

  const handleShiftClick = async (shift: Shift) => {
    if (!canEdit) return;

    try {
      const [shiftResponse, countResponse] = await Promise.all([
        supabase
          .from("shift")
          .select(
            "id, job_id, shift_date, start_time, end_time, workers_needed"
          )
          .eq("id", shift.id)
          .single(),
        supabase
          .from("shift_assignment")
          .select("*", { count: "exact", head: true })
          .eq("shift_id", shift.id)
          .is("cancelled_at", null)
          .is("deleted_at", null),
      ]);

      if (shiftResponse.error) throw shiftResponse.error;
      if (countResponse.error) throw countResponse.error;

      setEditingShiftData(shiftResponse.data);
      setShiftAssignmentCount(countResponse.count || 0);
      setShiftPosition(shift.position);
      setShiftEditDialogOpen(true);
    } catch (error) {
      console.error("Error fetching shift data:", error);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 flex items-start justify-center p-4 pt-16 overflow-y-auto"
        onClick={onClose}
      >
        <Card
          className="w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col my-4"
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
                {canEdit && (
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-primary hover:bg-primary/90">
                        <Plus className="w-4 h-4 mr-2" />
                        {t("dayView.addButton")}
                      </Button>
                    </DialogTrigger>
                    {dialogOpen && (
                      <JobDialog
                        editingJob={null}
                        locations={locations}
                        defaultStartDate={dateStr}
                        onSave={async () => {
                          setDialogOpen(false);
                          fetchedDateRef.current = "";
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
              className="flex-1 overflow-y-scroll overflow-x-auto relative bg-background"
            >
              {hours.map((hour) => (
                <div
                  key={`divider-${hour}`}
                  className="h-16 border-b border-border relative flex-shrink-0"
                >
                  <div className="absolute top-1/2 w-full border-t border-border/50" />
                </div>
              ))}

              {dayShifts.length > 0 ? (
                <div className="absolute inset-0 flex">
                  {swimlanes.map((swimlane) => (
                    <div
                      key={`swimlane-${swimlane.id}`}
                      className="relative flex-shrink-0 border-r border-border/30"
                      style={{
                        width: `${SWIMLANE_WIDTH_PX}px`,
                        marginRight: `${SWIMLANE_GAP_PX}px`,
                      }}
                    >
                      {swimlane.shifts.map((shift) => {
                        const style = shiftStyles.get(shift.id)!;
                        const assignmentCount = shift.assignmentCount ?? 0;
                        const workersNeeded = shift.workers_needed;
                        const assignedStaff =
                          assignedStaffMap.get(shift.id) || [];
                        const maxAvatarsToShow = 6;
                        const remainingCount = Math.max(
                          0,
                          assignedStaff.length - maxAvatarsToShow
                        );

                        return (
                          <div
                            key={shift.id}
                            className={`absolute rounded-lg p-2 border overflow-hidden left-1 right-1 bg-primary text-primary-foreground border-primary/30 ${
                              canEdit
                                ? "cursor-pointer hover:shadow-lg"
                                : "cursor-default"
                            }`}
                            style={{
                              top: `${style.top}px`,
                              height: `${style.height}px`,
                              willChange: "auto",
                            }}
                            title={
                              canEdit
                                ? `${shift.position} - ${shift.location} (${t(
                                    "dayView.clickToEdit"
                                  )})`
                                : `${shift.position} - ${shift.location}`
                            }
                            onClick={() => handleShiftClick(shift)}
                          >
                            <div className="text-xs font-semibold truncate">
                              {shift.position}
                            </div>
                            <div className="text-xs opacity-90">
                              {shift.startTime.slice(0, 5)} -{" "}
                              {shift.endTime.slice(0, 5)}
                            </div>
                            <div className="text-xs opacity-80 mt-1 truncate">
                              {shift.location}
                            </div>

                            {canEdit && (
                              <div className="mt-1 space-y-1">
                                <div className="flex items-center gap-1">
                                  <div
                                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                      style.isFullyStaffed
                                        ? "bg-green-600 text-white dark:bg-green-500"
                                        : style.isOverstaffed
                                        ? "bg-red-600 text-white dark:bg-red-500"
                                        : "bg-orange-600 text-white dark:bg-orange-500"
                                    }`}
                                  >
                                    {assignmentCount}/{workersNeeded}
                                  </div>
                                </div>

                                {assignedStaff.length > 0 && (
                                  <div className="flex items-start gap-0.5 flex-wrap max-w-full">
                                    {assignedStaff
                                      .slice(0, maxAvatarsToShow)
                                      .map((staff, index) => (
                                        <div
                                          key={staff.userId}
                                          className="relative flex-shrink-0"
                                          style={{
                                            marginLeft:
                                              index > 0 && index % 4 !== 0
                                                ? "-6px"
                                                : "0",
                                            zIndex:
                                              maxAvatarsToShow - (index % 4),
                                          }}
                                        >
                                          <ProfileAvatar
                                            firstName={staff.firstName}
                                            lastName={staff.lastName}
                                            email={staff.email}
                                            profilePicture={
                                              staff.profilePicture
                                            }
                                            size="sm"
                                            className="ring-2 ring-primary"
                                          />
                                        </div>
                                      ))}
                                    {remainingCount > 0 && (
                                      <div
                                        className="w-6 h-6 bg-primary-foreground/20 text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-semibold ring-2 ring-primary flex-shrink-0"
                                        style={{
                                          marginLeft:
                                            assignedStaff.length > 0
                                              ? "-6px"
                                              : "0",
                                          zIndex: 0,
                                        }}
                                      >
                                        +{remainingCount}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <p>{t("dayView.noShifts")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
              fetchedDateRef.current = "";
              onSave();
            }}
            onCancel={() => {
              setShiftEditDialogOpen(false);
              setEditingShiftData(null);
            }}
          />
        </Dialog>
      )}
    </>
  );
}
