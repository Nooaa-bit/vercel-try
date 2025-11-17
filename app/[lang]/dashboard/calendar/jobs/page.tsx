//hype-hire/vercel/app/[lang]/dashboard/calendar/jobs/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { ProtectedPage } from "@/components/ProtectedPage";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  Plus,
  Briefcase,
  Pencil,
  Calendar,
  Users,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import JobDialog from "../JobDialog";

interface Job {
  id: number;
  company_id: number;
  location_id: number | null;
  position: string;
  seniority: "junior" | "senior";
  description: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  created_by: number;
  deleted_at: string | null;
  deleted_by: number | null;
  max_workers_per_shift?: number;
  total_shifts?: number;
  total_positions_needed?: number;
  total_assignments?: number;
}

interface Location {
  id: number;
  name: string;
}

export default function JobsPage() {
  const { t, ready } = useTranslation("jobs");
  const {
    activeRole,
    loading: roleLoading,
    isSuperAdmin,
    selectedCompanyForAdmin,
  } = useActiveRole();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterJobStatus, setFilterJobStatus] = useState<string>("active");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;
  const supabase = createClient();

  const targetCompanyId = isSuperAdmin
    ? selectedCompanyForAdmin
    : activeRole?.companyId;

  const stats = useMemo(() => {
    const total = jobs.length;
    const today = new Date().toISOString().split("T")[0];
    const active = jobs.filter((job) => job.end_date >= today).length;
    const past = jobs.filter((job) => job.end_date < today).length;
    return { total, active, past };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return jobs.filter((job) => {
      const locationMatch =
        filterLocation === "all"
          ? true
          : job.location_id?.toString() === filterLocation;
      const statusMatch =
        filterJobStatus === "all"
          ? true
          : filterJobStatus === "active"
          ? job.end_date >= today
          : job.end_date < today;
      return locationMatch && statusMatch;
    });
  }, [jobs, filterLocation, filterJobStatus]);

  const paginatedJobs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredJobs.slice(startIndex, endIndex);
  }, [filteredJobs, currentPage]);

  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterLocation, filterJobStatus]);

  const fetchData = useCallback(async () => {
    if (!targetCompanyId || targetCompanyId <= 0) return;
    setLoading(true);

    try {
      const { data: jobsData, error: jobsError } = await supabase
        .from("job")
        .select("*")
        .eq("company_id", targetCompanyId)
        .is("deleted_at", null)
        .order("start_date", { ascending: false });

      if (jobsError) throw jobsError;

      if (jobsData && jobsData.length > 0) {
        const jobIds = jobsData.map((job) => job.id);

        const { data: shiftsData } = await supabase
          .from("shift")
          .select("id, job_id, workers_needed")
          .in("job_id", jobIds)
          .is("deleted_at", null);

        const shiftIds = (shiftsData || []).map((s) => s.id);
        const { data: assignmentsData } = await supabase
          .from("shift_assignment")
          .select("shift_id")
          .in("shift_id", shiftIds)
          .is("cancelled_at", null)
          .is("deleted_at", null);

        const jobAggregates: Record<
          number,
          {
            shiftCount: number;
            maxWorkersPerShift: number;
            totalPositionsNeeded: number;
            assignmentCount: number;
          }
        > = {};

        jobIds.forEach((jobId) => {
          jobAggregates[jobId] = {
            shiftCount: 0,
            maxWorkersPerShift: 0,
            totalPositionsNeeded: 0,
            assignmentCount: 0,
          };
        });

        (shiftsData || []).forEach((shift) => {
          const agg = jobAggregates[shift.job_id];
          agg.shiftCount++;
          agg.totalPositionsNeeded += shift.workers_needed;
          agg.maxWorkersPerShift = Math.max(
            agg.maxWorkersPerShift,
            shift.workers_needed
          );
        });

        (assignmentsData || []).forEach((assignment) => {
          const shift = shiftsData?.find((s) => s.id === assignment.shift_id);
          if (shift) {
            jobAggregates[shift.job_id].assignmentCount++;
          }
        });

        const jobsWithCounts = jobsData.map((job) => {
          const agg = jobAggregates[job.id];
          return {
            ...job,
            total_shifts: agg.shiftCount,
            max_workers_per_shift: agg.maxWorkersPerShift,
            total_positions_needed: agg.totalPositionsNeeded,
            total_assignments: agg.assignmentCount,
          };
        });

        setJobs(jobsWithCounts);
      } else {
        setJobs([]);
      }

      const { data: locationsData, error: locationsError } = await supabase
        .from("location")
        .select("id, name")
        .eq("company_id", targetCompanyId)
        .is("deleted_at", null);

      if (!locationsError && locationsData) {
        setLocations(locationsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }

    setLoading(false);
  }, [targetCompanyId, supabase]);

  useEffect(() => {
    if (roleLoading || !ready || !targetCompanyId) return;
    fetchData();
  }, [roleLoading, ready, targetCompanyId, fetchData]);

  const handleEdit = useCallback((job: Job) => {
    setEditingJob(job);
    setDialogOpen(true);
  }, []);

  const handleCancelJob = useCallback(
    async (job: Job) => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const today = `${year}-${month}-${day}`;

      const jobHasStartedOrStartsToday = job.start_date <= today;

      let canCancelToday = true;
      let todayShiftStartTime = null;
      let todayHasAssignments = false;

      if (jobHasStartedOrStartsToday) {
        const { data: todayShift } = await supabase
          .from("shift")
          .select("id, start_time")
          .eq("job_id", job.id)
          .eq("shift_date", today)
          .is("deleted_at", null)
          .single();

        if (todayShift) {
          const { count } = await supabase
            .from("shift_assignment")
            .select("id", { count: "exact", head: true })
            .eq("shift_id", todayShift.id)
            .is("cancelled_at", null)
            .is("deleted_at", null);

          todayHasAssignments = (count || 0) > 0;

          const [hours, minutes, seconds] = todayShift.start_time.split(":");
          const shiftStartDateTime = new Date();
          shiftStartDateTime.setHours(
            parseInt(hours),
            parseInt(minutes),
            parseInt(seconds || "0"),
            0
          );

          const timeDiffInHours =
            (shiftStartDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

          if (todayHasAssignments && timeDiffInHours < 1) {
            canCancelToday = false;
            todayShiftStartTime = todayShift.start_time;
          }
        }
      }

      // ✅ Updated with translations
      let confirmMessage = "";
      let actionDescription = "";
      let toastLoadingKey = "";
      let toastSuccessKey = "";

      if (!jobHasStartedOrStartsToday) {
        confirmMessage = t("confirmations.deleteJob", {
          position: job.position,
        });
        actionDescription = t("toast.deleting", { position: job.position });
        toastLoadingKey = "toast.deleting";
        toastSuccessKey = "toast.deleteSuccess";
      } else if (canCancelToday) {
        const noAssignmentsNote = !todayHasAssignments
          ? t("confirmations.noAssignmentsNote")
          : "";
        confirmMessage = t("confirmations.cancelAllShifts", {
          position: job.position,
          noAssignments: noAssignmentsNote,
        });
        actionDescription = t("toast.cancelling", { position: job.position });
        toastLoadingKey = "toast.cancelling";
        toastSuccessKey = "toast.cancelSuccess";
      } else {
        confirmMessage = t("confirmations.cancelFutureShifts", {
          position: job.position,
          time: todayShiftStartTime,
        });
        actionDescription = t("toast.cancellingFutureShifts", {
          position: job.position,
        });
        toastLoadingKey = "toast.cancellingFutureShifts";
        toastSuccessKey = "toast.cancelFutureSuccess";
      }

      if (!confirm(confirmMessage)) {
        return;
      }

      let deleteFromDate = today;
      if (jobHasStartedOrStartsToday && !canCancelToday) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowYear = tomorrow.getFullYear();
        const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, "0");
        const tomorrowDay = String(tomorrow.getDate()).padStart(2, "0");
        deleteFromDate = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;
      }

      toast.promise(
        async () => {
          if (!jobHasStartedOrStartsToday) {
            const { data, error } = await supabase.rpc(
              "delete_job_and_shifts",
              {
                p_job_id: job.id,
                p_deleted_by: activeRole?.userId || null,
              }
            );
            if (error) throw error;
          } else {
            const endDate = new Date(deleteFromDate);
            endDate.setDate(endDate.getDate() - 1);
            const endYear = endDate.getFullYear();
            const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
            const endDay = String(endDate.getDate()).padStart(2, "0");
            const endDateStr = `${endYear}-${endMonth}-${endDay}`;

            const { data, error } = await supabase.rpc(
              "cancel_shifts_from_date",
              {
                p_job_id: job.id,
                p_from_date: deleteFromDate,
                p_new_end_date: endDateStr,
              }
            );
            if (error) throw error;
          }
          await fetchData();
        },
        {
          loading: actionDescription,
          success: t(toastSuccessKey, { position: job.position }),
          error: t("toast.deleteFailed"),
        }
      );
    },
    [supabase, fetchData, activeRole, t]
  );

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setEditingJob(null);
    }
    setDialogOpen(open);
  };

  if (!ready || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ProtectedPage
      requiredRole="company_admin"
      redirectTo="/dashboard/calendar"
    >
      <div className="w-full space-y-8 py-2">
        {/* ✅ Filters with translations */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("filters.location")}
            </label>
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allLocations")}</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id.toString()}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("filters.status")}
            </label>
            <Select value={filterJobStatus} onValueChange={setFilterJobStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allJobs")}</SelectItem>
                <SelectItem value="active">
                  {t("filters.activeJobs")}
                </SelectItem>
                <SelectItem value="past">{t("filters.pastJobs")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0 pt-3">
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-0.5">
                  {t("stats.activeJobs")}
                </p>
                <p className="text-lg font-bold text-primary">{stats.active}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 pt-3">
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-0.5">
                  {t("stats.pastJobs")}
                </p>
                <p className="text-lg font-bold text-primary">{stats.past}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("card.title")}</CardTitle>
                <CardDescription>
                  {t("card.description", { count: filteredJobs.length })}
                </CardDescription>
              </div>

              <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" />
                    {t("card.addButton")}
                  </Button>
                </DialogTrigger>
                {dialogOpen && (
                  <JobDialog
                    editingJob={editingJob}
                    locations={locations}
                    onSave={async () => {
                      setDialogOpen(false);
                      setEditingJob(null);
                      await fetchData();
                    }}
                    onCancel={() => {
                      setDialogOpen(false);
                      setEditingJob(null);
                    }}
                    companyId={targetCompanyId as number}
                  />
                )}
              </Dialog>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg mb-2">
                  {t("emptyState.title")}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("emptyState.description")}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedJobs.map((job) => {
                    const isPast =
                      job.end_date < new Date().toISOString().split("T")[0];

                    const totalPositionsNeeded =
                      job.total_positions_needed || 0;
                    const totalAssignments = job.total_assignments || 0;
                    const maxWorkersPerShift = job.max_workers_per_shift || 0;

                    const isFullyStaffed =
                      totalAssignments === totalPositionsNeeded &&
                      totalPositionsNeeded > 0;
                    const isOverstaffed =
                      totalAssignments > totalPositionsNeeded;
                    const isUnderstaffed =
                      totalAssignments < totalPositionsNeeded &&
                      totalAssignments > 0;

                    return (
                      <Card
                        key={job.id}
                        className={`hover:shadow-md transition-shadow flex flex-col ${
                          isPast ? "opacity-75" : ""
                        }`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Briefcase className="w-5 h-5 text-primary flex-shrink-0" />
                              <CardTitle className="text-lg truncate">
                                {job.position}
                              </CardTitle>
                            </div>
                            <span className="text-xs bg-muted px-2 py-1 rounded capitalize flex-shrink-0">
                              {t(`fields.${job.seniority}`)}
                            </span>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3 flex-1">
                          {job.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                              {job.description}
                            </p>
                          )}

                          <div className="space-y-2">
                            {job.location_id && (
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">
                                  {locations.find(
                                    (loc) => loc.id === job.location_id
                                  )?.name || t("fields.noLocation")}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">
                                {job.start_date} - {job.end_date}
                              </span>
                            </div>

                            {/* ✅ Translated workers display */}
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex items-center gap-2 flex-1">
                                <span>
                                  {maxWorkersPerShift > 0
                                    ? `${t(
                                        "card.upTo"
                                      )} ${maxWorkersPerShift} ${t(
                                        "card.perShift"
                                      )}`
                                    : t("emptyState.title")}
                                </span>
                                {job.total_shifts !== undefined &&
                                  job.total_shifts > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-muted-foreground">
                                        ({job.total_shifts}{" "}
                                        {job.total_shifts === 1
                                          ? t("card.shifts")
                                          : t("card.shifts_plural")}
                                        )
                                      </span>
                                      <div
                                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                          isFullyStaffed
                                            ? "bg-green-500 text-white"
                                            : isOverstaffed
                                            ? "bg-red-500 text-white"
                                            : isUnderstaffed
                                            ? "bg-orange-500 text-white"
                                            : "bg-gray-400 text-white"
                                        }`}
                                      >
                                        {totalAssignments}/
                                        {totalPositionsNeeded}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        </CardContent>

                        <CardFooter className="pt-3 border-t">
                          <div className="flex gap-2 w-full">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleEdit(job)}
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              {t("card.editButton")}
                            </Button>

                            {!isPast &&
                              (() => {
                                const today = new Date()
                                  .toISOString()
                                  .split("T")[0];
                                const jobHasStarted = job.start_date <= today;

                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={
                                      jobHasStarted
                                        ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                        : "text-red-600 hover:text-red-700 hover:bg-red-50"
                                    }
                                    onClick={() => handleCancelJob(job)}
                                    title={
                                      jobHasStarted
                                        ? t("card.cancelShifts")
                                        : t("card.deleteButton")
                                    }
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                );
                              })()}
                          </div>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>

                {/* ✅ Translated pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t">
                    <p className="text-sm text-muted-foreground">
                      {t("pagination.showing", {
                        from: (currentPage - 1) * ITEMS_PER_PAGE + 1,
                        to: Math.min(
                          currentPage * ITEMS_PER_PAGE,
                          filteredJobs.length
                        ),
                        total: filteredJobs.length,
                      })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        {t("pagination.previous")}
                      </Button>

                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: totalPages },
                          (_, i) => i + 1
                        ).map((page) => (
                          <Button
                            key={page}
                            variant={
                              currentPage === page ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        {t("pagination.next")}
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
