// app/[lang]/dashboard/calendar/page.tsx (NO "use client")
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CalendarClient } from "./calendar-client";

// ============================================================================
// TYPES - Database response types
// ============================================================================

interface Location {
  id: number;
  name: string;
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
  assignmentCount: number;
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
    seniority: string;
    description: string | null;
    start_date: string;
    end_date: string;
    location_id: number | null;
    location: {
      id: number;
      name: string;
    } | null;
  } | null;
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
// DATA FETCHING - ADMIN PATH
// ============================================================================

async function fetchAdminData(
  companyId: number,
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
): Promise<{ shifts: Shift[]; locations: Location[] }> {
  try {
    const [jobsResponse, locationsResponse] = await Promise.all([
      supabase
        .from("job")
        .select("id")
        .eq("company_id", companyId)
        .is("deleted_at", null),
      supabase
        .from("location")
        .select("id, name")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
    ]);

    if (jobsResponse.error) {
      console.error("[fetchAdminData] Jobs query failed:", jobsResponse.error);
      return { shifts: [], locations: [] };
    }

    if (!jobsResponse.data || jobsResponse.data.length === 0) {
      return { shifts: [], locations: locationsResponse.data || [] };
    }

    const jobIds = jobsResponse.data.map((job) => job.id);

    const shiftsResponse = await supabase
      .from("shift")
      .select(
        `
        id, shift_date, start_time, end_time, workers_needed, job_id,
        job:job_id(
          id, position, seniority, description, start_date, end_date, location_id,
          location:location_id(id, name)
        )
      `,
      )
      .in("job_id", jobIds)
      .is("deleted_at", null)
      .order("shift_date", { ascending: true });

    if (shiftsResponse.error) {
      console.error(
        "[fetchAdminData] Shifts query failed:",
        shiftsResponse.error,
      );
      return { shifts: [], locations: locationsResponse.data || [] };
    }

    const shifts = await transformShifts(
      shiftsResponse.data as unknown as ShiftFromDB[],
      supabase,
    );

    return {
      shifts,
      locations: locationsResponse.data || [],
    };
  } catch (error) {
    console.error("[fetchAdminData] Unexpected error:", error);
    return { shifts: [], locations: [] };
  }
}

// ============================================================================
// DATA FETCHING - TALENT PATH
// ============================================================================

async function fetchTalentData(
  userId: number,
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
): Promise<{ shifts: Shift[]; locations: Location[] }> {
  try {
    const assignmentsResponse = await supabase
      .from("shift_assignment")
      .select("shift_id")
      .eq("user_id", userId)
      .is("cancelled_at", null)
      .is("deleted_at", null);

    if (assignmentsResponse.error) {
      console.error(
        "[fetchTalentData] Assignments query failed:",
        assignmentsResponse.error,
      );
      return { shifts: [], locations: [] };
    }

    if (!assignmentsResponse.data || assignmentsResponse.data.length === 0) {
      return { shifts: [], locations: [] };
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
      `,
      )
      .in("id", shiftIds)
      .is("deleted_at", null)
      .order("shift_date", { ascending: true });

    if (shiftsResponse.error) {
      console.error(
        "[fetchTalentData] Shifts query failed:",
        shiftsResponse.error,
      );
      return { shifts: [], locations: [] };
    }

    const shifts = await transformShifts(
      shiftsResponse.data as unknown as ShiftFromDB[],
      supabase,
    );

    return { shifts, locations: [] };
  } catch (error) {
    console.error("[fetchTalentData] Unexpected error:", error);
    return { shifts: [], locations: [] };
  }
}

// ============================================================================
// TRANSFORM SHIFTS
// ============================================================================

async function transformShifts(
  shiftsData: ShiftFromDB[],
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
): Promise<Shift[]> {
  if (shiftsData.length === 0) return [];

  const shiftIds = shiftsData.map((s) => s.id);
  const assignmentCounts: Record<number, number> = {};

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

  return shiftsData.map((shift) => {
    const jobData = shift.job;

    if (!jobData) {
      return {
        id: shift.id,
        job_id: shift.job_id,
        position: "Unknown Position",
        start_date: shift.shift_date,
        end_date: shift.shift_date,
        workers_needed: shift.workers_needed,
        location: "Unspecified",
        startTime: shift.start_time,
        endTime: shift.end_time,
        assignmentCount: assignmentCounts[shift.id] || 0,
      };
    }

    const locationName = jobData.location?.name || "No Location";
    const displayTitle = jobData.position;

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
}

// ============================================================================
// MAIN PAGE COMPONENT (Server Component)
// ============================================================================

export default async function CalendarPage({
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

  // ✅ STEP 3: Determine active role and company
  const activeRole = roles[0];
  const isAdmin =
    activeRole.role === "company_admin" || activeRole.role === "superadmin";

  // ✅ STEP 4: Create Supabase client
  const supabase = await createSupabaseServer();

  // ✅ STEP 5: Fetch data based on role
  let calendarData: { shifts: Shift[]; locations: Location[] };

  if (isAdmin) {
    calendarData = await fetchAdminData(activeRole.companyId, supabase);
  } else {
    calendarData = await fetchTalentData(userId, supabase);
  }

  // ✅ STEP 6: Pass data to client component (including userRole)
  return (
    <CalendarClient
      shifts={calendarData.shifts}
      locations={calendarData.locations}
      isAdmin={isAdmin}
      userId={userId}
      companyId={activeRole.companyId}
      companyName={activeRole.companyName}
      userRole={activeRole.role} // ✅ Added missing prop
    />
  );
}
