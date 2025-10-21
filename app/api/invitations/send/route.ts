import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/email/send-invitation-email";

export async function POST(request: Request) {
  try {
    const { invitationId, language = "en" } = await request.json();

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        company: true,
        inviter: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Send the actual email
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

    return NextResponse.json({
      success: true,
      message: "Invitation sent!",
    });
  } catch (error) {
    console.error("Email sending error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send email";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
