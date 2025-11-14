//hype-hire/vercel/app/api/job-invitation/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sendJobInvitationEmail } from "@/lib/email/send-job-invitation-email";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ✅ FIX #1: Use Vercel KV for rate limiting (works in serverless)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(100, "60 s"), // 100 requests per 60 seconds
  prefix: "ratelimit:job-invitations",
});

async function getUserByAuthId(authUserId: string) {
  return prisma.user.findUnique({
    where: { authUserId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
}

export async function POST(request: Request) {
  try {
    console.log("🚀 Job invitation API called");

    // ✅ 1. Authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("❌ Auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("✅ Auth user:", user.id);

    // ✅ 2. Rate limiting (now works in serverless)
    try {
      const { success } = await ratelimit.limit(user.id);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
    } catch (rateLimitError) {
      console.warn("⚠️ Rate limit check failed:", rateLimitError);
      // Don't block if rate limit service fails
    }

    // ✅ 3. Parse request
    const { jobId, userIds } = await request.json();

    console.log("📦 Request data:", { jobId, userIdsCount: userIds?.length });

    if (!jobId || isNaN(parseInt(jobId))) {
      console.log("❌ Invalid jobId:", jobId);
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      console.log("❌ Invalid userIds:", userIds);
      return NextResponse.json(
        { error: "Invalid or empty userIds array" },
        { status: 400 }
      );
    }

    // ✅ 4. Get inviter user
    const inviterUser = await getUserByAuthId(user.id);
    if (!inviterUser) {
      console.log("❌ Inviter user not found for authUserId:", user.id);
      return NextResponse.json(
        { error: "User not found in system" },
        { status: 401 }
      );
    }

    console.log("✅ Inviter user found:", {
      id: inviterUser.id,
      email: inviterUser.email,
    });

    // ✅ 5. Check if user is a superadmin
    const isSuperAdmin = await prisma.user_company_role.findFirst({
      where: {
        userId: inviterUser.id,
        role: "superadmin",
        revokedAt: null,
      },
    });

    console.log("🔑 Is superadmin:", !!isSuperAdmin);

    // ✅ 6. Find the job with authorization
    console.log("🔍 Looking for job with:");
    console.log("  - jobId:", parseInt(jobId));
    console.log("  - createdBy (inviterUser.id):", inviterUser.id);

    const job = await prisma.job.findFirst({
      where: {
        id: parseInt(jobId),
        deletedAt: null,
        OR: isSuperAdmin
          ? undefined
          : [
              { createdBy: inviterUser.id },
              {
                company: {
                  userCompanyRoles: {
                    some: {
                      userId: inviterUser.id,
                      revokedAt: null,
                      role: { in: ["company_admin", "superadmin"] },
                    },
                  },
                },
              },
            ],
      },
      include: {
        company: { select: { name: true, id: true } },
        shifts: { where: { deletedAt: null } },
      },
    });

    if (!job) {
      console.log("❌ Job not found or unauthorized");

      const jobExists = await prisma.job.findUnique({
        where: { id: parseInt(jobId) },
        select: { id: true, createdBy: true, position: true },
      });

      if (jobExists) {
        console.log("⚠️  Job exists but user not authorized:");
        console.log("  - Job createdBy:", jobExists.createdBy);
        console.log("  - Inviter id:", inviterUser.id);
        console.log("  - Is superadmin:", !!isSuperAdmin);
      } else {
        console.log("⚠️  Job doesn't exist at all");
      }

      return NextResponse.json(
        { error: "Job not found or unauthorized" },
        { status: 404 }
      );
    }

    console.log("✅ Job found:", {
      id: job.id,
      position: job.position,
      company: job.company.name,
    });

    // ✅ 7. Verify target users exist in some company
    let targetUsers;

    if (isSuperAdmin) {
      targetUsers = await prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
    } else {
      targetUsers = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          userCompanyRoles: {
            some: {
              companyId: job.companyId,
              revokedAt: null,
            },
          },
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
    }

    console.log("✅ Target users found:", targetUsers.length);

    if (targetUsers.length !== userIds.length) {
      console.log(
        "❌ Some users not found or not in company. Expected:",
        userIds.length,
        "Got:",
        targetUsers.length
      );
      return NextResponse.json(
        { error: "Some users are not part of this company" },
        { status: 400 }
      );
    }

    // ✅ 8. Set expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    console.log("📅 Invitations expire at:", expiresAt);

    // ✅ 9. Create invitations (FIX #2: Use Promise.all instead of loop)
    console.log("🔄 Creating invitations in transaction...");

    const createdInvitations = await prisma.$transaction(
      targetUsers.map((targetUser) =>
        prisma.jobInvitation.create({
          data: {
            jobId: parseInt(jobId),
            userId: targetUser.id,
            invitedBy: inviterUser.id,
            status: "pending",
            expiresAt,
          },
          include: {
            job: { select: { position: true } },
            invitee: { select: { email: true, firstName: true } },
          },
        })
      )
    );

    console.log("✅ All invitations created:", createdInvitations.length);

    // ✅ 10. Send notifications (FIX #3: Better error handling with partial success)
    const emailResults = await Promise.allSettled(
      createdInvitations.map((invitation) =>
        sendJobInvitationNotifications(invitation, job, inviterUser, expiresAt)
      )
    );

    // Count successes and failures
    const successfulEmails = emailResults.filter(
      (r) => r.status === "fulfilled"
    ).length;
    const failedEmails = emailResults.filter(
      (r) => r.status === "rejected"
    ).length;

    if (failedEmails > 0) {
      console.warn(
        `⚠️  ${failedEmails} email(s) failed to send out of ${createdInvitations.length}`
      );
    }

    // ✅ 11. Return success with email status
    return NextResponse.json({
      success: true,
      message: `Invitations sent to ${createdInvitations.length} employee(s)`,
      emailStatus: {
        successful: successfulEmails,
        failed: failedEmails,
      },
      invitations: createdInvitations.map((inv) => ({
        id: inv.id,
        userId: inv.userId,
        userEmail: inv.invitee.email,
      })),
    });
  } catch (error) {
    console.error("❌ Job invitation error:", error);

    if (
      error instanceof Error &&
      error.message.includes("Unique constraint failed")
    ) {
      return NextResponse.json(
        { error: "Some employees have already been invited to this job" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send invitations. Please try again." },
      { status: 500 }
    );
  }
}

async function sendJobInvitationNotifications(
  invitation: {
    id: number;
    jobId: number;
    userId: number;
    invitee: { email: string; firstName: string | null };
  },
  job: { position: string; company: { name: string } },
  inviter: { firstName: string | null; lastName: string | null },
  expiresAt: Date
) {
  const inviterName =
    `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim() || "Team";

  try {
    await sendJobInvitationEmail({
      to: invitation.invitee.email,
      invitationId: invitation.id,
      jobPosition: job.position,
      companyName: job.company.name,
      jobStartDate: new Date().toISOString().split("T")[0],
      jobEndDate: new Date().toISOString().split("T")[0],
      inviterName,
      expiresAt: expiresAt.toISOString(),
      language: "en",
    });

    console.log("✅ Job invitation email sent to:", invitation.invitee.email);
  } catch (error) {
    console.error("❌ Failed to send job invitation email:", error);
    throw error; // Now properly tracked by Promise.allSettled
  }
}
