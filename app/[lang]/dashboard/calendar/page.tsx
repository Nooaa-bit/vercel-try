"use client";

import { useState, useEffect } from "react";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Briefcase } from "lucide-react";

interface Job {
  id: number;
  position: string;
  start_date: string;
  end_date: string;
  workers_needed: number;
}

export default function CalendarPage() {
  const { t, ready } = useTranslation("jobs");
  const { activeRole, loading } = useActiveRole();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (loading || !ready || !activeRole) return;

    const fetchJobs = async () => {
      setPageLoading(true);

      if (
        activeRole.role === "company_admin" ||
        activeRole.role === "superadmin"
      ) {
        // Admins see all jobs in their company
        const { data } = await supabase
          .from("job")
          .select("id, position, start_date, end_date, workers_needed")
          .eq("company_id", activeRole.companyId)
          .is("deleted_at", null)
          .order("start_date", { ascending: true });

        if (data) {
          setJobs(data as Job[]);
        }
      } else {
        // Talent and supervisors see only jobs they're assigned to
        const { data: assignments } = await supabase
          .from("shift_assignment")
          .select("shift_id")
          .eq("user_id", activeRole.id)
          .is("cancelled_at", null);

        if (!assignments || assignments.length === 0) {
          setJobs([]);
          setPageLoading(false);
          return;
        }

        const shiftIds = assignments.map(
          (a: { shift_id: number }) => a.shift_id
        );

        const { data: shifts } = await supabase
          .from("shift")
          .select("job_id")
          .in("id", shiftIds);

        if (!shifts) {
          setJobs([]);
          setPageLoading(false);
          return;
        }

        const jobIds = [
          ...new Set(shifts.map((s: { job_id: number }) => s.job_id)),
        ];

        const { data: jobsData } = await supabase
          .from("job")
          .select("id, position, start_date, end_date, workers_needed")
          .in("id", jobIds)
          .is("deleted_at", null);

        if (jobsData) {
          setJobs(jobsData as Job[]);
        }
      }

      setPageLoading(false);
    };

    fetchJobs();
  }, [loading, ready, activeRole, supabase]);

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          {t("calendar.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pageLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t("calendar.noJobs")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 border rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{job.position}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(job.start_date).toLocaleDateString()} -{" "}
                      {new Date(job.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm bg-muted px-2 py-1 rounded">
                    {job.workers_needed} {t("card.workersNeeded")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
