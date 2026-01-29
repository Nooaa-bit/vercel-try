"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/server-auth";
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
    const userIdResult = await getCurrentUserId();
    if (!userIdResult.success) {
      return { success: false, error: "Unauthorized" };
    }

    // ✅ Verify user owns this assignment
    if (userIdResult.data !== userId) {
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
    const userIdResult = await getCurrentUserId();
    if (!userIdResult.success) {
      return { success: false, error: "Unauthorized" };
    }

    // ✅ Verify user owns this invitation
    if (userIdResult.data !== userId) {
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
    const userIdResult = await getCurrentUserId();
    if (!userIdResult.success) {
      return { success: false, error: "Unauthorized" };
    }

    // ✅ Verify user owns this invitation
    if (userIdResult.data !== userId) {
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
// CHECK-IN ACTION
// ============================================================================

export async function checkIn(assignmentId: number, userId: number) {
  try {
    // ✅ Verify authentication
    const userIdResult = await getCurrentUserId();
    if (!userIdResult.success || userIdResult.data !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServer();

    // ✅ Verify user owns this assignment
    const { data: assignment } = await supabase
      .from("shift_assignment")
      .select("id, user_id, shift_id")
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

    const now = new Date().toISOString();

    // ✅ Create check-in record
    const { error: insertError } = await supabase.from("check_in_out").insert({
      assignment_id: assignmentId,
      check_in_time: now,
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
    const userIdResult = await getCurrentUserId();
    if (!userIdResult.success || userIdResult.data !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServer();

    // ✅ Verify user owns this assignment
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
