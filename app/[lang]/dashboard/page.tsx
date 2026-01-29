// app/[lang]/dashboard/page.tsx (Server Component - NO "use client")

import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { DashboardClient } from "./dashboard-client-big";

// ============================================================================
// TYPES
// ============================================================================

interface Location {
  name: string;
}

interface Job {
  position: string;
  location: Location | null;
  start_date?: string;
  end_date?: string;
  checkInWindowMinutes?: number;
}

interface Shift {
  id: number;
  shift_date: string;
  start_time: string;
  end_time: string;
  job_id: number;
  job: Job;
}

export interface ShiftAssignment {
  id: number;
  shift: Shift;
}

export interface CheckInData {
  id: number;
  checkInTime: Date | null;
  checkOutTime: Date | null;
}

export interface ShiftWithCheckIn extends ShiftAssignment {
  canCheckIn: boolean;
  checkInOpensAt: Date | null;
  checkInWindowMinutes: number;
  shiftStartDateTime: Date;
  shiftEndDateTime: Date;
  checkInData: CheckInData | null;
}

export interface JobInvitation {
  id: number;
  job_id: number;
  shift_ids: number[];
  status: string;
  invited_by: number;
  created_at: string;
  job: Job;
  shifts: Shift[];
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
          } catch {}
        },
      },
    },
  );
}

// ============================================================================
// DATA FETCHING - MY SHIFTS
// ============================================================================

async function fetchMyShifts(
  userId: number,
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
): Promise<ShiftWithCheckIn[]> {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from("shift_assignment")
      .select("id, shift_id")
      .eq("user_id", userId)
      .is("cancelled_at", null)
      .is("deleted_at", null);

    if (assignmentsError || !assignmentsData || assignmentsData.length === 0) {
      return [];
    }

    const shiftIds = assignmentsData.map((a) => a.shift_id);

    const { data: shiftsData, error: shiftsError } = await supabase
      .from("shift")
      .select("id, shift_date, start_time, end_time, job_id")
      .in("id", shiftIds)
      .gte("shift_date", today)
      .is("deleted_at", null)
      .order("shift_date", { ascending: true });

    if (shiftsError || !shiftsData || shiftsData.length === 0) {
      return [];
    }

    const jobIds = [...new Set(shiftsData.map((s) => s.job_id))];

    const { data: jobsData } = await supabase
      .from("job")
      .select(
        `
        id, 
        position, 
        check_in_window_minutes,
        location_id, 
        location:location_id (name)
      `,
      )
      .in("id", jobIds);

    const jobsMap = new Map(
      (jobsData || []).map((job) => [
        job.id,
        {
          position: job.position,
          checkInWindowMinutes: job.check_in_window_minutes || 5,
          location:
            Array.isArray(job.location) && job.location.length > 0
              ? { name: job.location[0].name }
              : null,
        },
      ]),
    );

    // Fetch check-in data for all assignments
    const assignmentIds = assignmentsData.map((a) => a.id);
    const { data: checkInsData } = await supabase
      .from("check_in_out")
      .select("id, assignment_id, check_in_time, check_out_time")
      .in("assignment_id", assignmentIds);

    const checkInsMap = new Map(
      (checkInsData || []).map((ci) => [
        ci.assignment_id,
        {
          id: ci.id,
          checkInTime: ci.check_in_time ? new Date(ci.check_in_time) : null,
          checkOutTime: ci.check_out_time ? new Date(ci.check_out_time) : null,
        },
      ]),
    );

    const now = new Date();

    const results: ShiftWithCheckIn[] = [];

    for (const assignment of assignmentsData) {
      const shiftData = shiftsData.find((s) => s.id === assignment.shift_id);
      if (!shiftData) continue;

      const job = jobsMap.get(shiftData.job_id) || {
        position: "Unknown Position",
        location: null,
        checkInWindowMinutes: 45,
      };

      // Calculate shift start and end date-times
      const [startHours, startMinutes] = shiftData.start_time.split(":");
      const shiftStartDateTime = new Date(shiftData.shift_date);
      shiftStartDateTime.setHours(
        parseInt(startHours),
        parseInt(startMinutes),
        0,
      );

      const [endHours, endMinutes] = shiftData.end_time.split(":");
      const shiftEndDateTime = new Date(shiftData.shift_date);
      shiftEndDateTime.setHours(parseInt(endHours), parseInt(endMinutes), 0);

      // Calculate check-in window
      const checkInWindowMinutes = job.checkInWindowMinutes;
      const checkInOpensAt = new Date(
        shiftStartDateTime.getTime() - checkInWindowMinutes * 60000,
      );
      const canCheckIn = now >= checkInOpensAt && now <= shiftEndDateTime;

      // Get check-in data
      const checkInData = checkInsMap.get(assignment.id) || null;

      results.push({
        id: assignment.id,
        shift: {
          id: shiftData.id,
          shift_date: shiftData.shift_date,
          start_time: shiftData.start_time,
          end_time: shiftData.end_time,
          job_id: shiftData.job_id,
          job,
        },
        canCheckIn,
        checkInOpensAt,
        checkInWindowMinutes,
        shiftStartDateTime,
        shiftEndDateTime,
        checkInData,
      });
    }

    return results;

  } catch (error) {
    console.error("[fetchMyShifts] Error:", error);
    return [];
  }
}

// ============================================================================
// DATA FETCHING - PENDING INVITATIONS
// ============================================================================

async function fetchPendingInvitations(
  userId: number,
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
): Promise<JobInvitation[]> {
  try {
    const { data: invitationsData, error: invitationsError } = await supabase
      .from("job_invitation")
      .select("id, job_id, shift_ids, status, invited_by, created_at")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (invitationsError || !invitationsData || invitationsData.length === 0) {
      return [];
    }

    const jobIds = [...new Set(invitationsData.map((inv) => inv.job_id))];

    const { data: jobsData } = await supabase
      .from("job")
      .select(
        `id, position, start_date, end_date, location_id, location:location_id (name)`,
      )
      .in("id", jobIds);

    const jobsMap = new Map(
      (jobsData || []).map((job) => [
        job.id,
        {
          position: job.position,
          start_date: job.start_date,
          end_date: job.end_date,
          location:
            Array.isArray(job.location) && job.location.length > 0
              ? { name: job.location[0].name }
              : null,
        },
      ]),
    );

    const allShiftIds = invitationsData.flatMap((inv) => inv.shift_ids || []);
    const uniqueShiftIds = [...new Set(allShiftIds)];

    const { data: shiftsData } = await supabase
      .from("shift")
      .select("id, shift_date, start_time, end_time")
      .in("id", uniqueShiftIds)
      .is("deleted_at", null)
      .order("shift_date", { ascending: true });

    const shiftsMap = new Map(
      (shiftsData || []).map((shift) => [shift.id, shift]),
    );

    return invitationsData.map((invitation) => {
      const job = jobsMap.get(invitation.job_id) || {
        position: "Unknown Position",
        start_date: "",
        end_date: "",
        location: null,
      };

      const shifts = (invitation.shift_ids || [])
        .map((shiftId: number) => {
          const shift = shiftsMap.get(shiftId);
          if (!shift) return null;
          return {
            id: shift.id,
            shift_date: shift.shift_date,
            start_time: shift.start_time,
            end_time: shift.end_time,
            job_id: invitation.job_id,
            job,
          };
        })
        .filter((s: Shift | null): s is Shift => s !== null);

      return {
        id: invitation.id,
        job_id: invitation.job_id,
        shift_ids: invitation.shift_ids || [],
        status: invitation.status,
        invited_by: invitation.invited_by,
        created_at: invitation.created_at,
        job,
        shifts,
      };
    });
  } catch (error) {
    console.error("[fetchInvitations] Error:", error);
    return [];
  }
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default async function DashboardPage({
  params,
}: {
  params: { lang: string };
}) {
  // ✅ Authenticate
  const authResult = await getAuthenticatedUser();
  if (!authResult.success) {
    redirect(`/${params.lang}/login`);
  }

  const { userId } = authResult.data;
  const supabase = await createSupabaseServer();

  // ✅ Fetch all data in parallel
  const [myShifts, pendingInvitations] = await Promise.all([
    fetchMyShifts(userId, supabase),
    fetchPendingInvitations(userId, supabase),
  ]);

  // ✅ Pass everything to one client component
  return (
    <DashboardClient
      userId={userId}
      myShifts={myShifts}
      pendingInvitations={pendingInvitations}
    />
  );
}
