import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sendJobInvitationEmail } from "@/lib/email/send-job-invitation-email";

const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(
  userId: string,
  maxRequests = 100,
  windowMs = 60000
): boolean {
  const now = Date.now();
  const userRequests = rateLimitMap.get(userId) || [];
  const recentRequests = userRequests.filter((time) => now - time < windowMs);

  if (recentRequests.length >= maxRequests) {
    return false;
  }

  recentRequests.push(now);
  rateLimitMap.set(userId, recentRequests);
  return true;
}

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

    // ✅ 2. Rate limiting
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
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
        // If superadmin, no authorization needed. Otherwise check permissions
        OR: isSuperAdmin
          ? undefined // Superadmins can access any job
          : [
              // User created the job
              { createdBy: inviterUser.id },
              // OR user is admin of this company
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

      // Debug: Check if job exists at all
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

    // ✅ 7. Verify target users exist in some company (superadmins can invite anyone)
    let targetUsers;

    if (isSuperAdmin) {
      // Superadmins can invite any users
      targetUsers = await prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
    } else {
      // Regular users can only invite from their company
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

    // ✅ 9. Create invitations in transaction
    console.log("🔄 Creating invitations in transaction...");

    const createdInvitations = await prisma.$transaction(async (tx) => {
      const invitations = [];

      for (const targetUser of targetUsers) {
        try {
          const invitation = await tx.jobInvitation.create({
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
          });

          console.log("✅ Created invitation for:", targetUser.email);
          invitations.push(invitation);
        } catch (err) {
          console.error(
            "❌ Error creating invitation for",
            targetUser.email,
            err
          );
          throw err;
        }
      }

      return invitations;
    });

    console.log("✅ All invitations created:", createdInvitations.length);

    // ✅ 10. Send notifications (fire and forget)
    Promise.allSettled(
      createdInvitations.map((invitation) =>
        sendJobInvitationNotifications(
          invitation,
          job,
          inviterUser,
          expiresAt
        ).catch((err) => {
          console.error(
            `Failed to send notification for user ${invitation.userId}:`,
            err
          );
        })
      )
    );

    // ✅ 11. Return success
    return NextResponse.json({
      success: true,
      message: `Invitations sent to ${createdInvitations.length} employee(s)`,
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
      jobStartDate: new Date().toISOString().split("T")[0], // TODO: Get from job
      jobEndDate: new Date().toISOString().split("T")[0], // TODO: Get from job
      inviterName,
      expiresAt: expiresAt.toISOString(),
      language: "en", // TODO: Get from user preferences
    });

    console.log("✅ Job invitation email sent to:", invitation.invitee.email);
  } catch (error) {
    console.error("❌ Failed to send job invitation email:", error);
    // Don't throw - invitation was created successfully
  }
}

