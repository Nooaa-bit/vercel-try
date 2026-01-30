// app/[lang]/dashboard/calendar/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import JobDialog from "./JobDialog";
import { DayView } from "./DayView";

interface Job {
  id: number;
  position: string;
  seniority: "junior" | "senior";
  description: string | null;
  start_date: string;
  end_date: string;
  location_id: number | null;
}

interface ShiftFromDB {
  id: number;
  shift_date: string;
  start_time: string;
  end_time: string;
  workers_needed: number;
  job_id: number;
  job: {
    id: number;
    position: string;
    seniority: "junior" | "senior";
    description: string | null;
    start_date: string;
    end_date: string;
    location_id: number | null;
    location: {
      id: number;
      name: string;
    } | null;
  };
}

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

export default function CalendarPage() {
  const { t, ready, i18n } = useTranslation("jobs");
  const { activeRole, loading, isSuperAdmin, selectedCompanyForAdmin } =
    useActiveRole();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const supabase = createClient();

  const targetCompanyId = isSuperAdmin
    ? selectedCompanyForAdmin
    : activeRole?.companyId;

  // ✅ Memoize today
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  // ✅ OPTIMIZED: Fetch with parallel queries
  const fetchShifts = useCallback(async () => {
    if (!targetCompanyId || targetCompanyId <= 0) {
      return;
    }

    setPageLoading(true);
    setError(null);

    try {
      if (
        activeRole.role === "company_admin" ||
        activeRole.role === "superadmin"
      ) {
        // ✅ Admin: Fetch jobs, shifts, locations, and assignments in parallel
        const [jobsResponse, locationsResponse] = await Promise.all([
          supabase
            .from("job")
            .select("id")
            .eq("company_id", targetCompanyId)
            .is("deleted_at", null),
          supabase
            .from("location")
            .select("id, name")
            .eq("company_id", targetCompanyId)
            .is("deleted_at", null)
            .order("name", { ascending: true }),
        ]);

        if (jobsResponse.error) throw jobsResponse.error;

        if (!jobsResponse.data || jobsResponse.data.length === 0) {
          setShifts([]);
          setLocations(locationsResponse.data || []);
          setPageLoading(false);
          return;
        }

        const jobIds = jobsResponse.data.map((job) => job.id);

        // ✅ Fetch shifts with job details
        const shiftsResponse = await supabase
          .from("shift")
          .select(
            `
            id, shift_date, start_time, end_time, workers_needed, job_id,
            job:job_id(
              id, position, seniority, description, start_date, end_date, location_id,
              location:location_id(id, name)
            )
          `
          )
          .in("job_id", jobIds)
          .is("deleted_at", null)
          .order("shift_date", { ascending: true });

        if (shiftsResponse.error) throw shiftsResponse.error;

        const transformedShifts = await transformShifts(
          (shiftsResponse.data as unknown as ShiftFromDB[]) || []
        );

        setShifts(transformedShifts);
        setLocations(locationsResponse.data || []);
      } else {
        // ✅ Talent: Fetch assignments and shifts
        const assignmentsResponse = await supabase
          .from("shift_assignment")
          .select("shift_id")
          .eq("user_id", activeRole.userId)
          .is("cancelled_at", null)
          .is("deleted_at", null);

        if (assignmentsResponse.error) throw assignmentsResponse.error;

        if (
          !assignmentsResponse.data ||
          assignmentsResponse.data.length === 0
        ) {
          setShifts([]);
          setPageLoading(false);
          return;
        }

        const shiftIds = assignmentsResponse.data.map((a) => a.shift_id);

        const shiftsResponse = await supabase
          .from("shift")
          .select(
            `
            id, shift_date, start_time, end_time, workers_needed, job_id,
            job:job_id(
              id, position, seniority, description, start_date, end_date, location_id,
              location:location_id(id, name)
            )
          `
          )
          .in("id", shiftIds)
          .is("deleted_at", null)
          .order("shift_date", { ascending: true });

        if (shiftsResponse.error) throw shiftsResponse.error;

        if (!shiftsResponse.data || shiftsResponse.data.length === 0) {
          setShifts([]);
          setPageLoading(false);
          return;
        }

        const transformedShifts = await transformShifts(
          (shiftsResponse.data as unknown as ShiftFromDB[]) || []
        );
        setShifts(transformedShifts);
      }
    } catch (err) {
      console.error("Error in fetchShifts:", err);
      setError(t("calendar.loadError"));
    } finally {
      setPageLoading(false);
    }
  }, [targetCompanyId, activeRole, supabase, t]);

  // ✅ OPTIMIZED: Batch fetch assignments for all shifts
  const transformShifts = useCallback(
    async (shiftsData: ShiftFromDB[]): Promise<Shift[]> => {
      const shiftIds = shiftsData.map((s) => s.id);
      const assignmentCounts: Record<number, number> = {};

      if (shiftIds.length > 0) {
        const { data: assignmentsData } = await supabase
          .from("shift_assignment")
          .select("shift_id")
          .in("shift_id", shiftIds)
          .is("cancelled_at", null)
          .is("deleted_at", null)
          .is("marked_no_show_at", null);

        if (assignmentsData) {
          assignmentsData.forEach((assignment: { shift_id: number }) => {
            assignmentCounts[assignment.shift_id] =
              (assignmentCounts[assignment.shift_id] || 0) + 1;
          });
        }
      }

      const transformed = shiftsData.map((shift) => {
        const jobData = shift.job;
        if (!jobData) {
          return {
            id: shift.id,
            job_id: shift.job_id,
            position: t("calendar.unknownPosition"),
            start_date: shift.shift_date,
            end_date: shift.shift_date,
            workers_needed: shift.workers_needed,
            location: t("calendar.unspecified"),
            startTime: shift.start_time,
            endTime: shift.end_time,
            assignmentCount: assignmentCounts[shift.id] || 0,
          };
        }

        const locationName = jobData.location?.name || t("calendar.noLocation");
        const displayTitle = `${jobData.position}`;

        return {
          id: shift.id,
          job_id: shift.job_id,
          position: displayTitle,
          start_date: shift.shift_date,
          end_date: shift.shift_date,
          workers_needed: shift.workers_needed,
          location: locationName,
          startTime: shift.start_time,
          endTime: shift.end_time,
          assignmentCount: assignmentCounts[shift.id] || 0,
        };
      });

      return transformed;
    },
    [supabase, t]
  );

  useEffect(() => {
    if (loading || !ready || !activeRole || !targetCompanyId) {
      return;
    }

    fetchShifts();
  }, [loading, ready, activeRole, targetCompanyId, fetchShifts]);

  // ✅ Memoize locations from shifts
  const locationsFromShifts = useMemo(() => {
    return [...new Set(shifts.map((shift) => shift.location))];
  }, [shifts]);

  // ✅ Memoize stats with optimized filtering
  const stats = useMemo(() => {
    const now = new Date();

    const totalEvents = shifts.filter((shift) => {
      const shiftDate = new Date(shift.start_date);
      return shiftDate >= today;
    }).length;

    const todaysEvents = shifts.filter((shift) => {
      const shiftDate = new Date(shift.start_date);
      shiftDate.setHours(0, 0, 0, 0);

      if (shiftDate.getTime() !== today.getTime()) return false;

      const [hours, minutes, seconds] = shift.startTime.split(":").map(Number);
      const shiftStartTime = new Date();
      shiftStartTime.setHours(hours, minutes, seconds || 0);

      return shiftStartTime > now;
    }).length;

    return { totalEvents, todaysEvents };
  }, [shifts, today]);

  // ✅ Memoize calendar calculations
  const getDaysInMonth = useCallback((date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }, []);

  const getFirstDayOfMonth = useCallback((date: Date): number => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1;
  }, []);

  const daysInMonth = useMemo(
    () => getDaysInMonth(currentDate),
    [currentDate, getDaysInMonth]
  );
  const firstDay = useMemo(
    () => getFirstDayOfMonth(currentDate),
    [currentDate, getFirstDayOfMonth]
  );

  // ✅ Memoize shifts by date (only recalculate when shifts or filter changes)
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();

    shifts.forEach((shift) => {
      const matchesLocation =
        filterLocation === "all" || shift.location === filterLocation;

      if (matchesLocation) {
        const dateStr = shift.start_date;
        if (!map.has(dateStr)) {
          map.set(dateStr, []);
        }
        map.get(dateStr)!.push(shift);
      }
    });

    return map;
  }, [shifts, filterLocation]);

  const getShiftsForDate = useCallback(
    (day: number): Shift[] => {
      const dateStr = `${currentDate.getFullYear()}-${String(
        currentDate.getMonth() + 1
      ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      return shiftsByDate.get(dateStr) || [];
    },
    [currentDate, shiftsByDate]
  );

  const previousMonth = useCallback(() => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    );
  }, [currentDate]);

  const nextMonth = useCallback(() => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    );
  }, [currentDate]);

  const handleNextDay = useCallback(() => {
    if (selectedDay) {
      const nextDay = new Date(selectedDay);
      nextDay.setDate(nextDay.getDate() + 1);
      setSelectedDay(nextDay);
    }
  }, [selectedDay]);

  const handlePreviousDay = useCallback(() => {
    if (selectedDay) {
      const prevDay = new Date(selectedDay);
      prevDay.setDate(prevDay.getDate() - 1);
      setSelectedDay(prevDay);
    }
  }, [selectedDay]);

  const monthName = useMemo(
    () =>
      currentDate.toLocaleDateString(i18n.language, {
        month: "long",
        year: "numeric",
      }),
    [currentDate, i18n.language]
  );

  const weekDays = useMemo(
    () => [
      t("calendar.weekDays.mon"),
      t("calendar.weekDays.tue"),
      t("calendar.weekDays.wed"),
      t("calendar.weekDays.thu"),
      t("calendar.weekDays.fri"),
      t("calendar.weekDays.sat"),
      t("calendar.weekDays.sun"),
    ],
    [t]
  );

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
  }, []);

  const handleDayClick = useCallback((dayDate: Date) => {
    setSelectedDay(dayDate);
  }, []);

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 py-0">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">
            {t("calendar.location")}
          </label>
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("calendar.allLocations")}</SelectItem>
              {Array.from(new Set(locationsFromShifts)).map((location) => (
                <SelectItem key={location} value={location}>
                  {location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0 pt-3">
            <div className="text-center">
              <p className="text-muted-foreground text-xs mb-0.5">
                {t("calendar.upcomingShifts")}
              </p>
              <p className="text-lg font-bold text-primary">
                {stats.totalEvents}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 pt-3">
            <div className="text-center">
              <p className="text-muted-foreground text-xs mb-0.5">
                {t("calendar.todaysShifts")}
              </p>
              <p className="text-lg font-bold text-primary">
                {stats.todaysEvents}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{monthName}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={previousMonth}
                className="h-8 w-8"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={nextMonth}
                className="h-8 w-8"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {pageLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center font-semibold text-sm text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="aspect-square bg-muted/30 rounded-lg"
                  />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayDate = new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth(),
                    day
                  );
                  const dayShifts = getShiftsForDate(day);
                  const hasEvents = dayShifts.length > 0;

                  const isToday =
                    day === today.getDate() &&
                    currentDate.getMonth() === today.getMonth() &&
                    currentDate.getFullYear() === today.getFullYear();

                  return (
                    <div
                      key={day}
                      className={`aspect-square rounded-lg border-2 p-2 flex flex-col overflow-hidden cursor-pointer ${
                        isToday
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                          : hasEvents
                          ? "border-primary/40 bg-primary/5"
                          : "border-muted bg-background"
                      } hover:border-primary/60 transition-colors`}
                      onClick={() => handleDayClick(dayDate)}
                    >
                      <div
                        className={`text-xs font-semibold mb-1 ${
                          isToday ? "text-primary font-bold" : "text-foreground"
                        }`}
                      >
                        {day}
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-1">
                        {dayShifts.slice(0, 3).map((shift) => {
                          const assignmentCount = shift.assignmentCount ?? 0;
                          const workersNeeded = shift.workers_needed;
                          const isFullyStaffed =
                            assignmentCount === workersNeeded;
                          const isOverstaffed = assignmentCount > workersNeeded;

                          return (
                            <div
                              key={shift.id}
                              className="text-xs p-1.5 rounded bg-primary hover:bg-primary/90 text-primary-foreground truncate hover:shadow-md transition-all cursor-pointer group"
                              title={`${shift.position} - ${shift.startTime}`}
                            >
                              <div className="truncate font-medium">
                                {shift.position}
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <div className="text-primary-foreground/80 text-xs">
                                  {shift.startTime.slice(0, 5)}
                                </div>
                                {(activeRole.role === "company_admin" ||
                                  activeRole.role === "superadmin") && (
                                  <div
                                    className={`text-xs px-1 rounded font-medium ${
                                      isFullyStaffed
                                        ? "bg-green-500 text-white"
                                        : isOverstaffed
                                        ? "bg-red-500 text-white"
                                        : "bg-orange-500 text-white"
                                    }`}
                                  >
                                    {assignmentCount}/{workersNeeded}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {dayShifts.length > 3 && (
                          <div className="text-xs text-accent font-semibold px-1">
                            {t("calendar.more", {
                              count: dayShifts.length - 3,
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(activeRole.role === "company_admin" ||
        activeRole.role === "superadmin") &&
        targetCompanyId &&
        targetCompanyId > 0 && (
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <button className="button-primary fixed bottom-8 right-8 h-14 w-14 rounded-full p-0 flex items-center justify-center">
                <Plus className="w-6 h-6" />
              </button>
            </DialogTrigger>
            {dialogOpen && (
              <JobDialog
                editingJob={null}
                locations={locations}
                onSave={async () => {
                  setDialogOpen(false);
                  await fetchShifts();
                }}
                onCancel={() => {
                  setDialogOpen(false);
                }}
                companyId={targetCompanyId as number}
              />
            )}
          </Dialog>
        )}

      {selectedDay && (
        <DayView
          date={selectedDay}
          shifts={shifts}
          locations={locations}
          onClose={() => setSelectedDay(null)}
          onPreviousDay={handlePreviousDay}
          onNextDay={handleNextDay}
          onSave={fetchShifts}
          activeRole={activeRole}
          targetCompanyId={targetCompanyId as number}
        />
      )}
    </div>
  );
}
