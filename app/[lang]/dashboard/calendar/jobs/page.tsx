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
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Briefcase, Trash2, Pencil, Calendar, Users } from "lucide-react";
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
  const [filterSeniority, setFilterSeniority] = useState<string>("all");
  const supabase = createClient();

  // ✅ Get the correct company ID
  const targetCompanyId = isSuperAdmin
    ? selectedCompanyForAdmin
    : activeRole?.companyId;

  // ✅ Calculate stats
  const stats = useMemo(() => {
    const total = jobs.length;
    const draft = jobs.filter((job) => !job.start_date).length;

    return { total, draft };
  }, [jobs]);

  // ✅ Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const locationMatch =
        filterLocation === "all"
          ? true
          : job.location_id?.toString() === filterLocation;
      const seniorityMatch =
        filterSeniority === "all" ? true : job.seniority === filterSeniority;

      return locationMatch && seniorityMatch;
    });
  }, [jobs, filterLocation, filterSeniority]);

  // Fetch jobs and locations
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
        .order("start_date", { ascending: true });

      if (!jobsError && jobsData) {
        setJobs(jobsData);
      }

      // Fetch locations for dropdown
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
    if (activeRole.role === "supervisor" || activeRole.role === "talent") {
      return;
    }
    fetchData();
  }, [roleLoading, ready, activeRole.role, targetCompanyId, fetchData]);

  const handleEdit = useCallback((job: Job) => {
    setEditingJob(job);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (jobId: number, position: string) => {
      toast.promise(
        async () => {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from("job")
            .update({ deleted_at: now })
            .eq("id", jobId);

          if (error) throw error;
          await fetchData();
        },
        {
          loading: t("toast.deletingJob", { position }),
          success: t("toast.deleteSuccess", { position }),
          error: t("toast.deleteFailed"),
        }
      );
    },
    [supabase, fetchData, t]
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
        <div className="w-8 h-8 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ProtectedPage
      requiredRole="company_admin"
      redirectTo="/dashboard/calendar"
    >
      <div className="w-full space-y-4 py-0">
        {/* ✅ Filters and Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          {/* Location Filter */}
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

          {/* Seniority Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Seniority</label>
            <Select value={filterSeniority} onValueChange={setFilterSeniority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Total Jobs Stat */}
          <Card>
            <CardContent className="p-0 pt-3">
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-0.5">
                  Total Jobs
                </p>
                <p className="text-lg font-bold text-primary">{stats.total}</p>
              </div>
            </CardContent>
          </Card>

          {/* Draft Jobs Stat */}
          <Card>
            <CardContent className="p-0 pt-3">
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-0.5">
                  Draft Jobs
                </p>
                <p className="text-lg font-bold text-primary">{stats.draft}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ✅ Jobs Card */}
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
                  <Button className="bg-pulse-500 hover:bg-pulse-600">
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
                <div className="w-6 h-6 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin" />
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredJobs.map((job) => (
                  <Card
                    key={job.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-5 h-5 text-pulse-500" />
                          <CardTitle className="text-lg">
                            {job.position}
                          </CardTitle>
                        </div>
                        <span className="text-xs bg-muted px-2 py-1 rounded capitalize">
                          {job.seniority}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {job.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {job.description}
                        </p>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {new Date(job.start_date).toLocaleDateString()} -{" "}
                            {new Date(job.end_date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {job.workers_needed} {t("card.workersNeeded")}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEdit(job)}
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          {t("card.editButton")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(job.id, job.position)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
