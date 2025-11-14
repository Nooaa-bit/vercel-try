//hype-hire/vercel/app/api/job-accept/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // ✅ 1. Find invitation by token
    const { data: invitation, error: inviteError } = await supabase
      .from("job_invitation")
      .select("*, job(*)")
      .eq("token", token)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 404 }
      );
    }

    // ✅ 2. Check if already responded
    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: `Invitation already ${invitation.status}` },
        { status: 400 }
      );
    }

    // ✅ 3. Check if shifts are still available
    const shiftIds: number[] = invitation.shift_ids as number[];

    if (!shiftIds || shiftIds.length === 0) {
      return NextResponse.json(
        { error: "No shifts in invitation" },
        { status: 400 }
      );
    }

    // Get current assignment counts for these shifts
    const { data: shifts } = await supabase
      .from("shift")
      .select("id, workers_needed")
      .in("id", shiftIds)
      .is("deleted_at", null);

    if (!shifts || shifts.length === 0) {
      return NextResponse.json(
        { error: "Shifts no longer available" },
        { status: 410 }
      );
    }

    // Check each shift's availability
    const availabilityChecks = await Promise.all(
      shifts.map(async (shift: { id: number; workers_needed: number }) => {
        const { count } = await supabase
          .from("shift_assignment")
          .select("*", { count: "exact", head: true })
          .eq("shift_id", shift.id)
          .is("cancelled_at", null)
          .is("deleted_at", null);

        return {
          shiftId: shift.id,
          isFull: (count || 0) >= shift.workers_needed,
        };
      })
    );

    const fullShifts = availabilityChecks.filter((check) => check.isFull);

    // ✅ 4. If any shifts are full, mark invitation as spots_filled
    if (fullShifts.length > 0) {
      await supabase
        .from("job_invitation")
        .update({
          status: "spots_filled",
          spots_filled_at: new Date().toISOString(),
          responded_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      return NextResponse.json(
        {
          error: "Some shifts are now full",
          fullShifts: fullShifts.map((s) => s.shiftId),
        },
        { status: 410 }
      );
    }

    // ✅ 5. All shifts available - create assignments (with proper types)
    const now = new Date().toISOString();
    const assignments = shiftIds.map((shiftId: number) => ({
      shift_id: shiftId,
      user_id: invitation.user_id as number,
      assigned_by: invitation.invited_by as number,
      assigned_at: now,
    }));

    const { error: assignError } = await supabase
      .from("shift_assignment")
      .insert(assignments);

    if (assignError) {
      console.error("Error creating assignments:", assignError);
      return NextResponse.json(
        { error: "Failed to create assignments" },
        { status: 500 }
      );
    }

    // ✅ 6. Update invitation status
    await supabase
      .from("job_invitation")
      .update({
        status: "accepted",
        responded_at: now,
      })
      .eq("id", invitation.id);

    return NextResponse.json({
      success: true,
      message: "Invitation accepted successfully",
      shiftsAssigned: shiftIds.length,
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
