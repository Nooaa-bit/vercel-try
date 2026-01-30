// app/[lang]/dashboard/calendar/jobs/page.tsx (NO "use client")
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { JobsClient } from "./jobs-client";

// ============================================================================
// TYPES
// ============================================================================

interface Job {
  id: number;
  company_id: number;
  location_id: number | null;
  position: string;
  title: string | null;
  seniority: "junior" | "senior";
  description: string | null;
  start_date: string;
  end_date: string;
  hourly_rate: string | null;
  shift_rate: string | null;
  check_in_radius_job: number | null;
  check_in_window_minutes: number;
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

// ============================================================================
// SUPABASE SERVER CLIENT
// ============================================================================

async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can't set cookies
          }
        },
      },
    },
  );
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchJobsData(
  companyId: number,
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
): Promise<{ jobs: Job[]; locations: Location[] }> {
  try {
    // ✅ Step 1: Fetch jobs and locations in parallel
    const [jobsResponse, locationsResponse] = await Promise.all([
      supabase
        .from("job")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("start_date", { ascending: false }),
      supabase
        .from("location")
        .select("id, name")
        .eq("company_id", companyId)
        .is("deleted_at", null),
    ]);

    if (jobsResponse.error) {
      console.error("[fetchJobsData] Jobs query failed:", jobsResponse.error);
      return { jobs: [], locations: [] };
    }

    if (locationsResponse.error) {
      console.error(
        "[fetchJobsData] Locations query failed:",
        locationsResponse.error,
      );
      return { jobs: jobsResponse.data || [], locations: [] };
    }

    const jobsData = jobsResponse.data;
    const locationsData = locationsResponse.data || [];

    if (!jobsData || jobsData.length === 0) {
      return { jobs: [], locations: locationsData };
    }

    const jobIds = jobsData.map((job) => job.id);

    // ✅ Step 2: Fetch shifts and assignments in parallel
    const [shiftsResponse, assignmentsResponse] = await Promise.all([
      supabase
        .from("shift")
        .select("id, job_id, workers_needed")
        .in("job_id", jobIds)
        .is("deleted_at", null),
      supabase
        .from("shift_assignment")
        .select("shift_id")
        .is("cancelled_at", null)
        .is("deleted_at", null),
    ]);

    const shiftsData = shiftsResponse.data || [];
    const allAssignmentsData = assignmentsResponse.data || [];

    // ✅ Step 3: Build shift ID set for filtering assignments
    const shiftIdSet = new Set(shiftsData.map((s) => s.id));
    const assignmentsData = allAssignmentsData.filter((a) =>
      shiftIdSet.has(a.shift_id),
    );

    // ✅ Step 4: Calculate aggregates in memory
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

    shiftsData.forEach((shift) => {
      const agg = jobAggregates[shift.job_id];
      agg.shiftCount++;
      agg.totalPositionsNeeded += shift.workers_needed;
      agg.maxWorkersPerShift = Math.max(
        agg.maxWorkersPerShift,
        shift.workers_needed,
      );
    });

    assignmentsData.forEach((assignment) => {
      const shift = shiftsData.find((s) => s.id === assignment.shift_id);
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

    return { jobs: jobsWithCounts, locations: locationsData };
  } catch (error) {
    console.error("[fetchJobsData] Unexpected error:", error);
    return { jobs: [], locations: [] };
  }
}

// ============================================================================
// MAIN PAGE COMPONENT (Server Component)
// ============================================================================

export default async function JobsPage({
  params,
}: {
  params: { lang: string };
}) {
  // ✅ STEP 1: Authenticate user
  const authResult = await getAuthenticatedUser();

  if (!authResult.success) {
    redirect(`/${params.lang}/login`);
  }

  const { userId, roles } = authResult.data;

  // ✅ STEP 2: Check if user has at least one role
  if (roles.length === 0) {
    redirect(`/${params.lang}/no-access`);
  }

  // ✅ STEP 3: Determine active role - must be admin
  const activeRole = roles[0];
  const isAdmin =
    activeRole.role === "company_admin" || activeRole.role === "superadmin";

  // ✅ STEP 4: Enforce admin-only access
  if (!isAdmin) {
    redirect(`/${params.lang}/dashboard/calendar`);
  }

  // ✅ STEP 5: Create Supabase client
  const supabase = await createSupabaseServer();

  // ✅ STEP 6: Fetch data
  const { jobs, locations } = await fetchJobsData(
    activeRole.companyId,
    supabase,
  );

  // ✅ STEP 7: Pass to client component
  return (
    <JobsClient
      jobs={jobs}
      locations={locations}
      userId={userId}
      companyId={activeRole.companyId}
    />
  );
}
