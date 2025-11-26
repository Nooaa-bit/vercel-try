// app/api/job-invitation/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendJobInvitationEmail } from "@/lib/email/job-invitation";
import { sendJobInvitationSMS } from "@/lib/sms/job-invitation";

interface UserData {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface JobData {
  id: number;
  position: string;
  company_id: number;
}

interface InvitationRow {
  id: number;
  shift_ids: number[];
  user: UserData | UserData[];
  job: JobData | JobData[];
  invited_by_user: UserData | UserData[];
}

interface ShiftRow {
  id: number;
  shift_date: string;
}

export async function POST(request: NextRequest) {
  console.log("🚀 Job Invitation API called");

  try {
    const body = await request.json();
    const { invitationIds, language } = body;

    if (!invitationIds || invitationIds.length === 0) {
      return NextResponse.json(
        { error: "No invitation IDs provided" },
        { status: 400 }
      );
    }

    const emailLanguage: "en" | "el" = language === "en" ? "en" : "el";
    console.log("📧 Email language:", emailLanguage);
    console.log("📧 Processing invitations:", invitationIds);

    const supabase = await createClient();

    // Fetch invitations with user and job data
    const { data: invitations, error } = await supabase
      .from("job_invitation")
      .select(
        `
        id,
        shift_ids,
        user:user_id (
          id,
          email,
          first_name,
          last_name,
          phone
        ),
        job:job_id (
          id,
          position,
          company_id
        ),
        invited_by_user:invited_by (
          id,
          email,
          first_name,
          last_name
        )
      `
      )
      .in("id", invitationIds);

    if (error) throw error;
    if (!invitations || invitations.length === 0) {
      return NextResponse.json(
        { error: "No invitations found" },
        { status: 404 }
      );
    }

    console.log(`📬 Sending notifications to ${invitations.length} users`);

    const results = await Promise.allSettled(
      (invitations as InvitationRow[]).map(async (inv) => {
        const user = Array.isArray(inv.user) ? inv.user[0] : inv.user;
        const job = Array.isArray(inv.job) ? inv.job[0] : inv.job;
        const inviter = Array.isArray(inv.invited_by_user)
          ? inv.invited_by_user[0]
          : inv.invited_by_user;

        if (!user || !job || !inviter) {
          console.warn(`⚠️ Missing data for invitation ${inv.id}`);
          return;
        }

        // Fetch company name
        const { data: company } = await supabase
          .from("company")
          .select("name")
          .eq("id", job.company_id)
          .single();

        // Fetch shifts for this invitation
        const { data: shifts } = await supabase
          .from("shift")
          .select("id, shift_date")
          .in("id", inv.shift_ids)
          .order("shift_date", { ascending: true });

        if (!shifts || shifts.length === 0) {
          console.warn(`⚠️ No shifts found for invitation ${inv.id}`);
          return;
        }

        // Calculate date range from shifts
        const shiftDates = (shifts as ShiftRow[]).map((s) => s.shift_date);
        const startDate = shiftDates[0];
        const endDate = shiftDates[shiftDates.length - 1];

        const userName = user.first_name || user.email.split("@")[0];
        const inviterName = inviter.first_name
          ? `${inviter.first_name} ${inviter.last_name || ""}`.trim()
          : inviter.email;

        const companyName = company?.name || "Hype Hire";

        // Send email
        await sendJobInvitationEmail({
          to: user.email,
          jobPosition: job.position,
          companyName,
          jobStartDate: startDate,
          jobEndDate: endDate,
          inviterName: inviterName,
          language: emailLanguage,
        });

        console.log(`✅ Email sent to ${user.email} (${emailLanguage})`);

        // Send SMS if phone number exists
        if (user.phone) {
          const smsResult = await sendJobInvitationSMS({
            to: user.phone,
            jobPosition: job.position,
            companyName,
            shiftCount: shifts.length,
            startDate,
            endDate,
            language: emailLanguage,
          });

          if (smsResult.success) {
            console.log(`✅ SMS sent to ${user.phone}`);
          } else {
            console.warn(`⚠️ SMS failed for ${user.phone}: ${smsResult.error}`);
          }
        } else {
          console.log(`ℹ️ No phone number for ${user.email}, skipping SMS`);
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`✅ Sent: ${successful}, ❌ Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      sent: successful,
      failed: failed,
    });
  } catch (error) {
    console.error("❌ API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to send invitations",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
