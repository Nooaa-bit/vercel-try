"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser, hasMinimumRole } from "@/lib/server-auth";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
// CANCEL SHIFT ACTION
// ============================================================================

type CancellationReason = "other_job" | "personal" | "sick" | "accident";

export async function cancelShift({
  assignmentId,
  userId,
  jobId,
  cancellationReason,
  cancelAllRemaining,
}: {
  assignmentId: number;
  userId: number;
  jobId: number;
  cancellationReason: CancellationReason;
  cancelAllRemaining: boolean;
}) {
  try {
    // ✅ Verify authentication
    const authResult = await getAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: "Unauthorized" };
    }

    // ✅ Verify user owns this assignment
    if (authResult.data.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServer();
    const now = new Date().toISOString();
    const shiftsToCancel: number[] = [];

    if (cancelAllRemaining) {
      const today = new Date().toISOString().split("T")[0];

      // Get all future shifts for this job
      const { data: futureAssignments } = await supabase
        .from("shift_assignment")
        .select("id, shift_id, shift:shift_id(shift_date, job_id)")
        .eq("user_id", userId)
        .is("cancelled_at", null)
        .is("deleted_at", null);

      if (futureAssignments) {
        const relevantAssignments = futureAssignments
          .filter((assignment) => {
            const shift = Array.isArray(assignment.shift)
              ? assignment.shift[0]
              : assignment.shift;
            return shift && shift.job_id === jobId && shift.shift_date >= today;
          })
          .map((a) => a.id);

        shiftsToCancel.push(...relevantAssignments);
      }
    } else {
      shiftsToCancel.push(assignmentId);
    }

    // ✅ Update all selected assignments
    const { error } = await supabase
      .from("shift_assignment")
      .update({
        cancelled_at: now,
        cancelled_by: userId,
        cancellation_reason: cancellationReason,
      })
      .in("id", shiftsToCancel);

    if (error) {
      console.error("[cancelShift] Update failed:", error);
      return { success: false, error: "Failed to cancel shift" };
    }

    // ✅ Revalidate the dashboard page
    revalidatePath("/[lang]/dashboard", "page");

    return {
      success: true,
      cancelledCount: shiftsToCancel.length,
    };
  } catch (error) {
    console.error("[cancelShift] Unexpected error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================================================
// ACCEPT INVITATION ACTION
// ============================================================================

export async function acceptInvitation({
  invitationId,
  userId,
  shiftIds,
  invitedBy,
}: {
  invitationId: number;
  userId: number;
  shiftIds: number[];
  invitedBy: number;
}) {
  try {
    // ✅ Verify authentication
    const authResult = await getAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: "Unauthorized" };
    }

    // ✅ Verify user owns this invitation
    if (authResult.data.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServer();
    const now = new Date().toISOString();
    const shiftsToAssign: number[] = [];

    // ✅ Check each shift for availability
    for (const shiftId of shiftIds) {
      const { data: shift } = await supabase
        .from("shift")
        .select("workers_needed")
        .eq("id", shiftId)
        .is("deleted_at", null)
        .single();

      if (!shift) continue;

      const { count } = await supabase
        .from("shift_assignment")
        .select("*", { count: "exact", head: true })
        .eq("shift_id", shiftId)
        .is("cancelled_at", null)
        .is("deleted_at", null);

      if ((count || 0) < shift.workers_needed) {
        shiftsToAssign.push(shiftId);
      }
    }

    if (shiftsToAssign.length === 0) {
      // All positions filled
      await supabase
        .from("job_invitation")
        .update({
          status: "spots_filled",
          spots_filled_at: now,
          responded_at: now,
          updated_at: now,
        })
        .eq("id", invitationId);

      return { success: false, error: "spots_filled" };
    }

    // ✅ Process each shift - reactivate or create
    for (const shiftId of shiftsToAssign) {
      const { data: existingAssignment } = await supabase
        .from("shift_assignment")
        .select("id, deleted_at, cancelled_at")
        .eq("shift_id", shiftId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingAssignment) {
        // Reactivate
        await supabase
          .from("shift_assignment")
          .update({
            cancelled_at: null,
            cancelled_by: null,
            cancellation_reason: null,
            deleted_at: null,
            assigned_by: invitedBy,
            assigned_at: now,
          })
          .eq("id", existingAssignment.id);
      } else {
        // Create new
        await supabase.from("shift_assignment").insert({
          shift_id: shiftId,
          user_id: userId,
          assigned_by: invitedBy,
          assigned_at: now,
        });
      }
    }

    // ✅ Update invitation status
    await supabase
      .from("job_invitation")
      .update({
        status: "accepted",
        responded_at: now,
        updated_at: now,
      })
      .eq("id", invitationId);

    // ✅ Revalidate the dashboard page
    revalidatePath("/[lang]/dashboard", "page");

    return {
      success: true,
      assignedCount: shiftsToAssign.length,
    };
  } catch (error) {
    console.error("[acceptInvitation] Unexpected error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================================================
// DECLINE INVITATION ACTION
// ============================================================================

export async function declineInvitation(invitationId: number, userId: number) {
  try {
    // ✅ Verify authentication
    const authResult = await getAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: "Unauthorized" };
    }

    // ✅ Verify user owns this invitation
    if (authResult.data.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServer();

    const { error } = await supabase
      .from("job_invitation")
      .update({
        status: "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", invitationId);

    if (error) {
      console.error("[declineInvitation] Update failed:", error);
      return { success: false, error: "Failed to decline invitation" };
    }

    // ✅ Revalidate the dashboard page
    revalidatePath("/[lang]/dashboard", "page");

    return { success: true };
  } catch (error) {
    console.error("[declineInvitation] Unexpected error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================================================
// CHECK-IN ACTION (WITH SERVER-SIDE VALIDATION)
// ============================================================================

export async function checkIn(assignmentId: number, userId: number) {
  try {
    // ✅ Verify authentication
    const authResult = await getAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: "Unauthorized" };
    }

    // ✅ Verify user owns this assignment
    if (authResult.data.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServer();

    // ✅ Verify assignment exists and get shift details
    const { data: assignment } = await supabase
      .from("shift_assignment")
      .select(
        `
        id, 
        user_id, 
        shift_id,
        shift:shift_id (
          id,
          shift_date,
          start_time,
          end_time,
          job_id,
          job:job_id (
            check_in_window_minutes
          )
        )
      `,
      )
      .eq("id", assignmentId)
      .eq("user_id", userId)
      .is("cancelled_at", null)
      .is("deleted_at", null)
      .single();

    if (!assignment) {
      return { success: false, error: "Assignment not found" };
    }

    // ✅ Check if already checked in
    const { data: existingCheckIn } = await supabase
      .from("check_in_out")
      .select("id")
      .eq("assignment_id", assignmentId)
      .maybeSingle();

    if (existingCheckIn) {
      return { success: false, error: "Already checked in" };
    }

    // ✅ SERVER-SIDE TIME VALIDATION
    const shift = Array.isArray(assignment.shift)
      ? assignment.shift[0]
      : assignment.shift;

    if (!shift) {
      return { success: false, error: "Shift data not found" };
    }

    const job = Array.isArray(shift.job) ? shift.job[0] : shift.job;

    // Calculate shift start date-time
    const [startHours, startMinutes] = shift.start_time.split(":");
    const shiftStartDateTime = new Date(shift.shift_date);
    shiftStartDateTime.setHours(
      parseInt(startHours),
      parseInt(startMinutes),
      0,
    );

    // Get check-in window from job (default 5 minutes)
    const checkInWindowMinutes = job?.check_in_window_minutes || 5;

    // Calculate earliest allowed check-in time
    const earliestCheckInTime = new Date(
      shiftStartDateTime.getTime() - checkInWindowMinutes * 60000,
    );

    const now = new Date();

    // ✅ Validate check-in window
    if (now < earliestCheckInTime) {
      const minutesUntilCheckIn = Math.ceil(
        (earliestCheckInTime.getTime() - now.getTime()) / 60000,
      );
      return {
        success: false,
        error: `Check-in opens in ${minutesUntilCheckIn} minute${minutesUntilCheckIn !== 1 ? "s" : ""}`,
      };
    }

    // Calculate shift end date-time
    const [endHours, endMinutes] = shift.end_time.split(":");
    const shiftEndDateTime = new Date(shift.shift_date);
    shiftEndDateTime.setHours(parseInt(endHours), parseInt(endMinutes), 0);

    if (now > shiftEndDateTime) {
      return {
        success: false,
        error: "Cannot check in after shift has ended",
      };
    }

    const nowISO = now.toISOString();

    // ✅ Create check-in record
    const { error: insertError } = await supabase.from("check_in_out").insert({
      assignment_id: assignmentId,
      check_in_time: nowISO,
      check_in_method: "app_self",
      checked_in_by: userId,
    });

    if (insertError) {
      console.error("[checkIn] Insert failed:", insertError);
      return { success: false, error: "Failed to check in" };
    }

    // ✅ Revalidate the dashboard page
    revalidatePath("/[lang]/dashboard", "page");

    return { success: true };
  } catch (error) {
    console.error("[checkIn] Unexpected error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================================================
// CHECK-OUT ACTION
// ============================================================================

export async function checkOut(assignmentId: number, userId: number) {
  try {
    // ✅ Verify authentication
    const authResult = await getAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: "Unauthorized" };
    }

    // ✅ Verify user owns this assignment
    if (authResult.data.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServer();

    // ✅ Verify assignment exists
    const { data: assignment } = await supabase
      .from("shift_assignment")
      .select("id, user_id")
      .eq("id", assignmentId)
      .eq("user_id", userId)
      .is("cancelled_at", null)
      .is("deleted_at", null)
      .single();

    if (!assignment) {
      return { success: false, error: "Assignment not found" };
    }

    // ✅ Get existing check-in
    const { data: checkIn } = await supabase
      .from("check_in_out")
      .select("id, check_in_time, check_out_time")
      .eq("assignment_id", assignmentId)
      .single();

    if (!checkIn) {
      return { success: false, error: "No check-in found" };
    }

    if (checkIn.check_out_time) {
      return { success: false, error: "Already checked out" };
    }

    const now = new Date().toISOString();

    // ✅ Update check-out
    const { error: updateError } = await supabase
      .from("check_in_out")
      .update({
        check_out_time: now,
        check_out_method: "app_self",
        checked_out_by: userId,
      })
      .eq("id", checkIn.id);

    if (updateError) {
      console.error("[checkOut] Update failed:", updateError);
      return { success: false, error: "Failed to check out" };
    }

    // ✅ Revalidate the dashboard page
    revalidatePath("/[lang]/dashboard", "page");

    return { success: true };
  } catch (error) {
    console.error("[checkOut] Unexpected error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================================================
// ADMIN CHECK-IN ACTION (Bypasses time validation)
// ============================================================================

export async function adminCheckIn(assignmentId: number, workerId: number) {
  try {
    // ✅ Verify admin/manager authorization
    const authResult = await getAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: "Unauthorized" };
    }

    // ✅ Check if user has supervisor or higher role
    const isAuthorized = authResult.data.roles.some((role) =>
      hasMinimumRole(role.role, "supervisor"),
    );

    if (!isAuthorized) {
      console.error(
        `[adminCheckIn] User ${authResult.data.userId} attempted admin check-in without proper role`,
      );
      return { success: false, error: "Insufficient permissions" };
    }

    const supabase = await createSupabaseServer();

    // ✅ Verify assignment exists and belongs to worker
    const { data: assignment } = await supabase
      .from("shift_assignment")
      .select("id, user_id")
      .eq("id", assignmentId)
      .eq("user_id", workerId)
      .is("cancelled_at", null)
      .is("deleted_at", null)
      .single();

    if (!assignment) {
      return { success: false, error: "Assignment not found" };
    }

    // ✅ Check if already checked in
    const { data: existingCheckIn } = await supabase
      .from("check_in_out")
      .select("id")
      .eq("assignment_id", assignmentId)
      .maybeSingle();

    if (existingCheckIn) {
      return { success: false, error: "Already checked in" };
    }

    const now = new Date().toISOString();

    // ✅ Create check-in record (admin override - no time validation)
    const { error: insertError } = await supabase.from("check_in_out").insert({
      assignment_id: assignmentId,
      check_in_time: now,
      check_in_method: "manual", // Indicates admin override
      checked_in_by: authResult.data.userId, // Admin's ID, not worker's
    });

    if (insertError) {
      console.error("[adminCheckIn] Insert failed:", insertError);
      return { success: false, error: "Failed to check in worker" };
    }

    // ✅ Log the admin action for audit trail
    console.log(
      `[AUDIT] Admin ${authResult.data.userId} checked in worker ${workerId} for assignment ${assignmentId} at ${now}`,
    );

    // ✅ Revalidate the dashboard page
    revalidatePath("/[lang]/dashboard", "page");

    return { success: true };
  } catch (error) {
    console.error("[adminCheckIn] Unexpected error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================================================
// ADMIN CHECK-OUT ACTION
// ============================================================================

export async function adminCheckOut(checkInId: number) {
  try {
    // ✅ Verify admin/manager authorization
    const authResult = await getAuthenticatedUser();
    if (!authResult.success) {
      return { success: false, error: "Unauthorized" };
    }

    // ✅ Check if user has supervisor or higher role
    const isAuthorized = authResult.data.roles.some((role) =>
      hasMinimumRole(role.role, "supervisor"),
    );

    if (!isAuthorized) {
      console.error(
        `[adminCheckOut] User ${authResult.data.userId} attempted admin check-out without proper role`,
      );
      return { success: false, error: "Insufficient permissions" };
    }

    const supabase = await createSupabaseServer();

    // ✅ Get existing check-in
    const { data: checkIn } = await supabase
      .from("check_in_out")
      .select("id, check_in_time, check_out_time, assignment_id")
      .eq("id", checkInId)
      .single();

    if (!checkIn) {
      return { success: false, error: "Check-in record not found" };
    }

    if (checkIn.check_out_time) {
      return { success: false, error: "Already checked out" };
    }

    const now = new Date().toISOString();

    // ✅ Update check-out
    const { error: updateError } = await supabase
      .from("check_in_out")
      .update({
        check_out_time: now,
        check_out_method: "manual", // Indicates admin override
        checked_out_by: authResult.data.userId, // Admin's ID
      })
      .eq("id", checkInId);

    if (updateError) {
      console.error("[adminCheckOut] Update failed:", updateError);
      return { success: false, error: "Failed to check out worker" };
    }

    // ✅ Log the admin action for audit trail
    console.log(
      `[AUDIT] Admin ${authResult.data.userId} checked out check-in ${checkInId} for assignment ${checkIn.assignment_id} at ${now}`,
    );

    // ✅ Revalidate the dashboard page
    revalidatePath("/[lang]/dashboard", "page");

    return { success: true };
  } catch (error) {
    console.error("[adminCheckOut] Unexpected error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
