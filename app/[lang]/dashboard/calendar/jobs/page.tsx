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
  workers_needed: number;
  start_date: string;
  end_date: string;
  created_at: string;
  created_by: number;
  deleted_at: string | null;
  deleted_by: number | null;
  // ✅ NEW: Added shift and assignment counts
  total_shifts?: number;
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

  // ✅ Fetch jobs with shift and assignment counts
  const fetchData = useCallback(async () => {
    if (!targetCompanyId || targetCompanyId <= 0) return;

    setLoading(true);
    try {
      // Fetch jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from("job")
        .select("*")
        .eq("company_id", targetCompanyId)
        .is("deleted_at", null)
        .order("start_date", { ascending: false });

      if (jobsError) throw jobsError;

      if (jobsData && jobsData.length > 0) {
        const jobIds = jobsData.map((job) => job.id);

        // ✅ Get shift counts for all jobs
        const { data: shiftsData } = await supabase
          .from("shift")
          .select("id, job_id")
          .in("job_id", jobIds)
          .is("deleted_at", null);

        // ✅ Get assignment counts for all shifts
        const shiftIds = (shiftsData || []).map((s) => s.id);
        const { data: assignmentsData } = await supabase
          .from("shift_assignment")
          .select("shift_id")
          .in("shift_id", shiftIds)
          .is("cancelled_at", null)
          .is("deleted_at", null);

        // ✅ Group counts by job
        const shiftCountsByJob: Record<number, number> = {};
        const assignmentCountsByJob: Record<number, number> = {};

        (shiftsData || []).forEach((shift) => {
          shiftCountsByJob[shift.job_id] =
            (shiftCountsByJob[shift.job_id] || 0) + 1;
        });

        // Map assignments to jobs through shifts
        (assignmentsData || []).forEach((assignment) => {
          const shift = shiftsData?.find((s) => s.id === assignment.shift_id);
          if (shift) {
            assignmentCountsByJob[shift.job_id] =
              (assignmentCountsByJob[shift.job_id] || 0) + 1;
          }
        });

        // ✅ Attach counts to jobs
        const jobsWithCounts = jobsData.map((job) => ({
          ...job,
          total_shifts: shiftCountsByJob[job.id] || 0,
          total_assignments: assignmentCountsByJob[job.id] || 0,
        }));

        setJobs(jobsWithCounts);
      } else {
        setJobs([]);
      }

      // Fetch locations
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
      const today = new Date().toISOString().split("T")[0];
      const jobHasStarted = job.start_date <= today;

      const confirmMessage = jobHasStarted
        ? `Cancel all remaining shifts for "${job.position}"? The job end date will be updated to yesterday. This cannot be undone.`
        : `Delete the job "${job.position}"? This will delete the job and all its shifts. This cannot be undone.`;

      if (!confirm(confirmMessage)) {
        return;
      }

      const actionMessage = jobHasStarted ? "Cancelling" : "Deleting";
      const successMessage = jobHasStarted
        ? `All remaining shifts cancelled for ${job.position}`
        : `Job "${job.position}" and all shifts deleted successfully`;

      toast.promise(
        async () => {
          const now = new Date().toISOString();

          if (jobHasStarted) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split("T")[0];

            const { error: shiftError } = await supabase
              .from("shift")
              .update({
                deleted_at: now,
              })
              .eq("job_id", job.id)
              .gte("shift_date", today)
              .is("deleted_at", null);

            if (shiftError) throw shiftError;

            const { error: jobError } = await supabase
              .from("job")
              .update({
                end_date: yesterdayStr,
              })
              .eq("id", job.id);

            if (jobError) throw jobError;
          } else {
            const { error: jobError } = await supabase
              .from("job")
              .update({
                deleted_at: now,
                deleted_by: activeRole?.id || null,
              })
              .eq("id", job.id);

            if (jobError) throw jobError;

            const { error: shiftError } = await supabase
              .from("shift")
              .update({
                deleted_at: now,
              })
              .eq("job_id", job.id)
              .is("deleted_at", null);

            if (shiftError) {
              console.error("Error deleting shifts:", shiftError);
            }
          }

          await fetchData();
        },
        {
          loading: `${actionMessage} "${job.position}"...`,
          success: successMessage,
          error: `Failed to ${actionMessage.toLowerCase()} job`,
        }
      );
    },
    [supabase, fetchData, activeRole]
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
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Location</label>
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id.toString()}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={filterJobStatus} onValueChange={setFilterJobStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                <SelectItem value="active">Active Jobs</SelectItem>
                <SelectItem value="past">Past Jobs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0 pt-3">
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-0.5">
                  Active Jobs
                </p>
                <p className="text-lg font-bold text-primary">{stats.active}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 pt-3">
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-0.5">
                  Past Jobs
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

                    // ✅ Calculate total positions needed
                    const totalPositionsNeeded =
                      (job.total_shifts || 0) * job.workers_needed;
                    const totalAssignments = job.total_assignments || 0;
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
                              {job.seniority}
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
                                  )?.name || "Unknown Location"}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">
                                {job.start_date} - {job.end_date}
                              </span>
                            </div>
                            {/* ✅ Workers with shift and assignment counts */}
                            {/* ✅ Workers with shift count and staffing counter inline */}
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex items-center gap-2 flex-1">
                                <span>{job.workers_needed} per shift</span>
                                {job.total_shifts !== undefined && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground">
                                      ({job.total_shifts} shifts)
                                    </span>
                                    {job.total_shifts > 0 && (
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
                                    )}
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
                                        ? "Cancel all remaining shifts"
                                        : "Delete job and all shifts"
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

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                      {Math.min(
                        currentPage * ITEMS_PER_PAGE,
                        filteredJobs.length
                      )}{" "}
                      of {filteredJobs.length} jobs
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
                        Previous
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
                        Next
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
