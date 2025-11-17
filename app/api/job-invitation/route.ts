// app/api/job-invitation/route.ts
//import { Ratelimit } from "@upstash/ratelimit";
//import { Redis } from "@upstash/redis";
//const redis = new Redis({
  //url: process.env.UPSTASH_REDIS_REST_URL!,
 // token: process.env.UPSTASH_REDIS_REST_TOKEN!,
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(); // ✅ Added await

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get inviter's user ID
    const { data: inviterData } = await supabase
      .from("user")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!inviterData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { jobId, userIds, shiftIds } = await request.json();

    if (!jobId || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
      return NextResponse.json(
        { error: "Must specify at least one shift" },
        { status: 400 }
      );
    }

    // ✅ Create invitations with shift IDs
    const invitations = userIds.map((userId) => ({
      job_id: jobId,
      user_id: userId,
      invited_by: inviterData.id,
      shift_ids: shiftIds, // PostgreSQL array
      status: "pending",
    }));

    const { data, error } = await supabase
      .from("job_invitation")
      .insert(invitations)
      .select();

    if (error) {
      console.error("Error creating invitations:", error);
      return NextResponse.json(
        { error: "Failed to create invitations" },
        { status: 500 }
      );
    }

    // ✅ TODO: Send emails/SMS with magic links
    // For each invitation, send email with: https://yourapp.com/invite/accept/{token}

    return NextResponse.json({
      success: true,
      invitations: data,
    });
  } catch (error) {
    console.error("Error in job invitation API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
