//hype-hire/vercel/app/api/invitations/send/route.ts //could add rate limit or accepted checks
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/email/send-invitation-email";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// SIMPLE IN-MEMORY RATE LIMITER
// ============================================================
// ⚠️ NOTE: This resets on server restart. For production, consider:
// - Upstash Redis: npm install @upstash/redis @upstash/ratelimit
// - https://upstash.com (free tier: 10,000 requests/day)
// ============================================================

const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(
  userId: string,
  maxRequests = 50, // ✅ CHANGED: Increased from 5 to 50 for bulk operations
  windowMs = 60000
): boolean {
  const now = Date.now();
  const userRequests = rateLimitMap.get(userId) || [];

  // Remove requests older than the time window
  const recentRequests = userRequests.filter((time) => now - time < windowMs);

  if (recentRequests.length >= maxRequests) {
    return false; // Rate limit exceeded
  }

  // Add current request timestamp
  recentRequests.push(now);
  rateLimitMap.set(userId, recentRequests);
  return true;
}

// ============================================================
// API ROUTE
// ============================================================

export async function POST(request: Request) {
  try {
    // ✅ 1. Authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ 2. Rate limiting (50 emails per minute per user)
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // ✅ 3. Parse and validate request
    const { invitationId, language = "en" } = await request.json();

    if (!invitationId || typeof invitationId !== "number") {
      return NextResponse.json(
        { error: "Invalid invitation ID" },
        { status: 400 }
      );
    }

    // ✅ 4. Fetch invitation WITH authorization check in ONE query
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: invitationId,
        OR: [
          // User is the inviter
          { inviter: { authUserId: user.id } },
          // OR user is admin of this company
          {
            company: {
              userCompanyRoles: {
                some: {
                  user: { authUserId: user.id },
                  revokedAt: null,
                  role: { in: ["company_admin", "superadmin"] },
                },
              },
            },
          },
        ],
      },
      include: {
        company: {
          select: { name: true, id: true },
        },
        inviter: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    // ✅ 5. Validation checks
    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found or unauthorized" },
        { status: 404 }
      );
    }

    // ✅ Check if invitation is still pending
    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "Invitation already processed" },
        { status: 400 }
      );
    }

    // ✅ Check if invitation was revoked
    if (invitation.deletedAt) {
      return NextResponse.json(
        { error: "Invitation was revoked" },
        { status: 410 }
      );
    }

    // ✅ Check if invitation expired
    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Invitation expired" },
        { status: 410 }
      );
    }

    // ✅ 6. Send email
    await sendInvitationEmail({
      to: invitation.email,
      invitationToken: invitation.token,
      companyName: invitation.company.name,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      inviterName:
        `${invitation.inviter.firstName || ""} ${
          invitation.inviter.lastName || ""
        }`.trim() || "Team",
      language: language as "en" | "el",
    });

    // ✅ 7. Return success
    return NextResponse.json({
      success: true,
      message: "Invitation sent successfully",
    });
  } catch (error) {
    console.error("Email sending error:", error);

    // Don't expose internal errors to users
    return NextResponse.json(
      { error: "Failed to send invitation. Please try again." },
      { status: 500 }
    );
  }
}